const XLSX = require('xlsx');
const { downloadFileFromS3, uploadFileToS3, deleteFileFromS3 } = require('../utils/s3Upload');
const { getSampleSizeByFrequency } = require('../utils/sample_required');
const { pool } = require('../utils/db');
require('dotenv').config();

/**
 * Process sampling Excel files from sampling_process_temp table
 */
async function processSamplingExcel() {
  const client = await pool.connect();
  
  try {
    console.log('='.repeat(70));
    console.log('Processing Sampling Excel Files');
    console.log('='.repeat(70));
    
    // Fetch records where processed is 0 or null
    const selectQuery = `
      SELECT id, excel_file_url, form_id, primary_columns
      FROM sampling_process_temp
      WHERE processed IS NULL OR processed = 0
      ORDER BY id ASC;
    `;
    
    const result = await client.query(selectQuery);
    
    if (result.rows.length === 0) {
      console.log('No unprocessed records found in sampling_process_temp table (processed IS NULL OR processed = 0).');
    } else {
      console.log(`Found ${result.rows.length} unprocessed record(s) to process.\n`);
    }
    
    // Process each unprocessed record
    for (const row of result.rows) {
      const { id, excel_file_url, form_id, primary_columns } = row;
      
      console.log(`\n[Processing Record ID: ${id}]`);
      console.log(`  Form ID: ${form_id}`);
      console.log(`  Excel File URL: ${excel_file_url}`);
      console.log(`  Primary Columns: ${primary_columns}`);
      
      try {
        await client.query('BEGIN');
        
        // Step 1: Download Excel file from S3
        console.log(`\n  Step 1: Downloading Excel file from S3...`);
        const fileBuffer = await downloadFileFromS3(excel_file_url);
        console.log(`  ✓ Downloaded ${fileBuffer.length} bytes`);
        
        // Step 2: Parse Excel file
        console.log(`\n  Step 2: Parsing Excel file...`);
        const workbook = XLSX.read(fileBuffer, { type: 'buffer' });
        const firstSheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[firstSheetName];
        
        // Convert to JSON to get all data
        const jsonData = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
        
        if (jsonData.length === 0) {
          throw new Error('Excel file is empty');
        }
        
        // Get headers from first row
        const headers = jsonData[0].map(h => String(h || '').trim()).filter(h => h !== '');
        
        if (headers.length === 0) {
          throw new Error('No headers found in Excel file');
        }
        
        console.log(`  ✓ Found ${headers.length} columns and ${jsonData.length - 1} data rows`);
        
        // Step 3: Parse primary columns
        console.log(`\n  Step 3: Parsing primary columns...`);
        const primaryCols = primary_columns.split(',').map(col => col.trim()).filter(col => col !== '');
        
        if (primaryCols.length !== 2) {
          throw new Error(`Expected 2 primary columns, but found ${primaryCols.length}`);
        }
        
        // Find column indices
        const colIndices = primaryCols.map(colName => {
          const index = headers.findIndex(h => 
            h.toLowerCase() === colName.toLowerCase() || 
            h.toLowerCase().includes(colName.toLowerCase()) ||
            colName.toLowerCase().includes(h.toLowerCase())
          );
          
          if (index === -1) {
            throw new Error(`Primary column "${colName}" not found in Excel headers`);
          }
          
          return index;
        });
        
        console.log(`  ✓ Found primary columns: "${primaryCols[0]}" (index ${colIndices[0]}) and "${primaryCols[1]}" (index ${colIndices[1]})`);
        
        // Step 4: Get control_frequency from control_forms table
        console.log(`\n  Step 4: Fetching control_frequency from control_forms table...`);
        const controlFrequencyQuery = `
          SELECT control_frequency
          FROM control_forms
          WHERE form_id = $1;
        `;
        
        const controlFrequencyResult = await client.query(controlFrequencyQuery, [form_id]);
        
        if (controlFrequencyResult.rows.length === 0) {
          throw new Error(`Control form with form_id "${form_id}" not found`);
        }
        
        const controlFrequency = controlFrequencyResult.rows[0].control_frequency || '';
        console.log(`  ✓ Found control_frequency: "${controlFrequency}"`);
        
        // Get number of samples from shared control_frequency -> sample_size mapping.
        const mappedSampleSize = getSampleSizeByFrequency(controlFrequency);
        const numSamples = mappedSampleSize ?? 5; // Default to 5 if no match found

        if (mappedSampleSize !== null) {
          console.log(`  ✓ Matched control_frequency -> ${numSamples} samples`);
        } else if (controlFrequency) {
          console.log(`  ⚠️  No match found for control_frequency "${controlFrequency}", using default: 5 samples`);
        } else {
          console.log(`  ⚠️  control_frequency is empty, using default: 5 samples`);
        }
        
        // Step 5: Get unique combinations and select random rows based on control_frequency
        console.log(`\n  Step 5: Selecting ${numSamples} random rows based on control_frequency...`);
        const dataRows = jsonData.slice(1); // Skip header row
        
        // Create a map of unique combinations
        const uniqueCombinations = new Map();
        
        dataRows.forEach((row, index) => {
          const val1 = String(row[colIndices[0]] || '').trim();
          const val2 = String(row[colIndices[1]] || '').trim();
          
          // Skip rows where both primary columns are empty
          if (val1 === '' && val2 === '') {
            return;
          }
          
          const combinationKey = `${val1}|||${val2}`;
          
          if (!uniqueCombinations.has(combinationKey)) {
            uniqueCombinations.set(combinationKey, index);
          }
        });
        
        if (uniqueCombinations.size === 0) {
          throw new Error('No valid rows found with non-empty primary column values');
        }
        
        console.log(`  ✓ Found ${uniqueCombinations.size} unique combinations`);
        
        // Select random combinations based on control_frequency
        const combinationArray = Array.from(uniqueCombinations.entries());
        const selectedIndices = new Set();
        const numToSelect = Math.min(numSamples, combinationArray.length);
        
        while (selectedIndices.size < numToSelect) {
          const randomIndex = Math.floor(Math.random() * combinationArray.length);
          selectedIndices.add(combinationArray[randomIndex][1]); // Store the original row index
        }
        
        const selectedRowIndices = Array.from(selectedIndices);
        console.log(`  ✓ Selected ${selectedRowIndices.length} random rows (requested: ${numSamples}, available: ${combinationArray.length})`);
        
        // Step 6: Create new Excel file with selected rows
        console.log(`\n  Step 6: Creating new Excel file with selected rows...`);
        
        // Build new data array with header and selected rows
        const newData = [headers]; // Start with header row
        
        selectedRowIndices.forEach(rowIndex => {
          newData.push(dataRows[rowIndex]);
        });
        
        // Create new worksheet
        const newWorksheet = XLSX.utils.aoa_to_sheet(newData);
        
        // Create new workbook
        const newWorkbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(newWorkbook, newWorksheet, firstSheetName);
        
        // Convert to buffer
        const newFileBuffer = XLSX.write(newWorkbook, { type: 'buffer', bookType: 'xlsx' });
        console.log(`  ✓ Created new Excel file with ${newData.length} rows (${newFileBuffer.length} bytes)`);
        
        // Step 7: Upload to S3
        console.log(`\n  Step 7: Uploading to S3...`);
        const fileName = `sampling_${form_id}_${Date.now()}.xlsx`;
        const s3Key = await uploadFileToS3(newFileBuffer, fileName, 'IFC/sample_docs');
        console.log(`  ✓ Uploaded to S3: ${s3Key}`);
        
        // Step 8: Update control_forms table
        console.log(`\n  Step 8: Updating control_forms table...`);
        const updateQuery = `
          UPDATE control_forms
          SET sampling_doc = $1
          WHERE form_id = $2;
        `;
        
        const updateResult = await client.query(updateQuery, [s3Key, form_id]);
        
        if (updateResult.rowCount === 0) {
          throw new Error(`Control form with form_id "${form_id}" not found`);
        }
        
        console.log(`  ✓ Updated control_forms.sampling_doc for form_id: ${form_id}`);
        
        // Step 9: Update processed flag to 1
        console.log(`\n  Step 9: Marking record as processed...`);
        const updateProcessedQuery = `
          UPDATE sampling_process_temp
          SET processed = 1
          WHERE id = $1;
        `;
        
        await client.query(updateProcessedQuery, [id]);
        console.log(`  ✓ Marked record ID ${id} as processed`);
        
        await client.query('COMMIT');
        
        console.log(`\n  ✓✓✓ Successfully processed record ID ${id} ✓✓✓`);
        
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`\n  ❌ Error processing record ID ${id}:`, error.message);
        console.error(`  Stack:`, error.stack);
        // Continue with next record
        continue;
      }
    }
    
    // Step 10: Clean up processed records (processed = 1)
    console.log('\n' + '='.repeat(70));
    console.log('Step 10: Cleaning up processed records...');
    console.log('='.repeat(70));
    
    const cleanupQuery = `
      SELECT id, excel_file_url
      FROM sampling_process_temp
      WHERE processed = 1;
    `;
    
    const cleanupResult = await client.query(cleanupQuery);
    
    if (cleanupResult.rows.length === 0) {
      console.log('No processed records to clean up.');
    } else {
      console.log(`Found ${cleanupResult.rows.length} processed record(s) to clean up.\n`);
      
      for (const row of cleanupResult.rows) {
        const { id, excel_file_url } = row;
        
        try {
          console.log(`\n[Cleaning up Record ID: ${id}]`);
          console.log(`  Excel File URL: ${excel_file_url}`);
          
          // Try to delete file from S3
          console.log(`  Attempting to delete file from S3...`);
          await deleteFileFromS3(excel_file_url);
          console.log(`  ✓ Successfully deleted file from S3`);
          
          // If S3 deletion succeeds, delete the row
          console.log(`  Deleting record from sampling_process_temp...`);
          const deleteQuery = `
            DELETE FROM sampling_process_temp
            WHERE id = $1;
          `;
          
          await client.query(deleteQuery, [id]);
          console.log(`  ✓ Deleted record ID ${id} from sampling_process_temp`);
          
        } catch (error) {
          // If S3 deletion fails, keep the row
          console.error(`  ❌ Failed to delete S3 file for record ID ${id}:`, error.message);
          console.error(`  ⚠️  Keeping record in database for manual cleanup`);
          // Continue with next record
          continue;
        }
      }
    }
    
    console.log('\n' + '='.repeat(70));
    console.log('Processing completed!');
    console.log('='.repeat(70));
    
  } catch (error) {
    console.error('\n❌ Fatal error:', error);
    throw error;
  } finally {
    client.release();
  }
}

// Run the script
if (require.main === module) {
  processSamplingExcel()
    .then(() => {
      console.log('\nScript completed successfully.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('\nScript failed:', error);
      process.exit(1);
    });
}

module.exports = { processSamplingExcel };

