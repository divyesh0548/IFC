const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const { downloadFileFromS3 } = require('../utils/s3Upload');
const { pool } = require('../utils/db');
const {
  transformExcelData,
  insertRacmRowsFromTransformedData,
} = require('../utils/racm_bulk_import_from_rows');

// Keywords to identify header row (case-insensitive)
const headerKeywords = [
  'control number',
  'sub process',
  'risk',
  'risk heat',
  'control objective',
  'standard control description',
  'ipe reference',
  'control frequency',
  'nature of control',
  'control performer',
  'control owner',
];

// Function to normalize text for comparison
function normalizeText(text) {
  if (!text) return '';
  return String(text).toLowerCase().trim()
    .replace(/[\/\(\)&-]/g, ' ')
    .replace(/\s+/g, ' ');
}

// Function to find header row location
function findHeaderRow(worksheet) {
  // Convert worksheet to 2D array
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const maxRow = range.e.r;
  const maxCol = range.e.c;
  
  let bestHeaderRow = -1;
  let bestMatchCount = 0;
  let headerStartCol = -1;
  let headerEndCol = -1;
  
  // Search through rows (check first 50 rows)
  const searchLimit = Math.min(50, maxRow + 1);
  
  for (let row = 0; row < searchLimit; row++) {
    let matchCount = 0;
    let firstNonEmptyCol = -1;
    let lastNonEmptyCol = -1;
    
    // Check each cell in the row
    for (let col = 0; col <= maxCol; col++) {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: col });
      const cell = worksheet[cellAddress];
      
      if (cell && cell.v) {
        const cellValue = normalizeText(cell.v);
        
        // Track first and last non-empty columns
        if (firstNonEmptyCol === -1) {
          firstNonEmptyCol = col;
        }
        lastNonEmptyCol = col;
        
        // Check if cell value matches any header keyword
        for (const keyword of headerKeywords) {
          if (cellValue.includes(keyword) || keyword.includes(cellValue)) {
            matchCount++;
            break; // Count each cell only once
          }
        }
      }
    }
    
    // If this row has more matches than previous best, update
    if (matchCount > bestMatchCount && matchCount >= 4) {
      bestMatchCount = matchCount;
      bestHeaderRow = row;
      headerStartCol = firstNonEmptyCol;
      headerEndCol = lastNonEmptyCol;
    }
  }
  
  if (bestHeaderRow === -1) {
    throw new Error('Could not find header row. Make sure the Excel file contains recognizable column headers.');
  }
  
  console.log(`\n=== Header Detection ===`);
  console.log(`Header row found at row index: ${bestHeaderRow + 1} (0-based: ${bestHeaderRow})`);
  console.log(`Header start column: ${XLSX.utils.encode_col(headerStartCol)} (index: ${headerStartCol})`);
  console.log(`Header end column: ${XLSX.utils.encode_col(headerEndCol)} (index: ${headerEndCol})`);
  console.log(`Matched ${bestMatchCount} header keywords`);
  
  return {
    row: bestHeaderRow,
    startCol: headerStartCol,
    endCol: headerEndCol
  };
}

// Function to extract headers from the identified header row
function extractHeaders(worksheet, headerLocation) {
  const headers = [];
  const headerRow = headerLocation.row;
  
  for (let col = headerLocation.startCol; col <= headerLocation.endCol; col++) {
    const cellAddress = XLSX.utils.encode_cell({ r: headerRow, c: col });
    const cell = worksheet[cellAddress];
    const headerValue = cell && cell.v ? String(cell.v).trim() : `Column_${col}`;
    headers.push({
      colIndex: col,
      name: headerValue
    });
  }
  
  console.log(`\nExtracted ${headers.length} headers:`);
  headers.forEach((h, idx) => {
    console.log(`  ${idx + 1}. Column ${XLSX.utils.encode_col(h.colIndex)}: "${h.name}"`);
  });
  
  return headers;
}

// Function to extract data rows below the header
function extractDataRows(worksheet, headers, headerLocation) {
  const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
  const maxRow = range.e.r;
  const dataStartRow = headerLocation.row + 1;
  const dataRows = [];
  
  for (let row = dataStartRow; row <= maxRow; row++) {
    const rowData = {};
    let hasData = false;
    
    headers.forEach(header => {
      const cellAddress = XLSX.utils.encode_cell({ r: row, c: header.colIndex });
      const cell = worksheet[cellAddress];
      const value = cell && cell.v !== undefined && cell.v !== null && cell.v !== '' 
        ? String(cell.v).trim() 
        : null;
      
      if (value !== null) {
        hasData = true;
      }
      
      rowData[header.name] = value;
    });
    
    // Only add row if it has at least one non-empty value
    if (hasData) {
      dataRows.push(rowData);
    }
  }
  
  console.log(`\nExtracted ${dataRows.length} data rows (starting from row ${dataStartRow + 1})`);
  
  return dataRows;
}

// Function to parse a single sheet with header detection
function parseSheet(worksheet, sheetName) {
  if (!worksheet['!ref']) {
    console.log(`Sheet "${sheetName}" is empty, skipping...`);
    return [];
  }
  
  console.log(`\n${'='.repeat(60)}`);
  console.log(`Processing Sheet: "${sheetName}"`);
  console.log('='.repeat(60));
  
  // Find header row location for this sheet
  const headerLocation = findHeaderRow(worksheet);
  
  // Extract headers from the identified row
  const headers = extractHeaders(worksheet, headerLocation);
  
  // Extract data rows below the header
  const dataRows = extractDataRows(worksheet, headers, headerLocation);
  
  if (dataRows.length === 0) {
    console.log(`No data rows found in sheet "${sheetName}"`);
    return [];
  }
  
  console.log(`✓ Successfully extracted ${dataRows.length} rows from sheet "${sheetName}"`);
  
  return dataRows;
}

// Function to parse Excel file with header detection for all sheets
// Accepts either a file path (string) or a buffer
function parseExcelFile(filePathOrBuffer) {
  try {
    let workbook;
    let fileName;
    
    // Check if input is a buffer or file path
    if (Buffer.isBuffer(filePathOrBuffer)) {
      // Read from buffer
      workbook = XLSX.read(filePathOrBuffer, { type: 'buffer' });
      fileName = 'uploaded_file';
    } else {
      // Read from file path (legacy support)
      workbook = XLSX.readFile(filePathOrBuffer);
      fileName = path.basename(filePathOrBuffer);
    }
    
    const sheetNames = workbook.SheetNames;
    
    if (!sheetNames || sheetNames.length === 0) {
      throw new Error('Excel file has no sheets');
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Excel File: ${fileName}`);
    console.log(`Total Sheets Found: ${sheetNames.length}`);
    console.log(`Sheet Names: ${sheetNames.join(', ')}`);
    console.log('='.repeat(60));
    
    const allDataRows = [];
    
    // Process each sheet separately
    for (let i = 0; i < sheetNames.length; i++) {
      const sheetName = sheetNames[i];
      const worksheet = workbook.Sheets[sheetName];
      
      try {
        const sheetData = parseSheet(worksheet, sheetName);
        allDataRows.push(...sheetData);
      } catch (error) {
        console.error(`Error processing sheet "${sheetName}": ${error.message}`);
        // Continue processing other sheets even if one fails
        continue;
      }
    }
    
    if (allDataRows.length === 0) {
      throw new Error('No data rows found in any sheet');
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Total rows extracted from all sheets: ${allDataRows.length}`);
    console.log('='.repeat(60));
    
    return allDataRows;
  } catch (error) {
    throw new Error(`Error parsing Excel file: ${error.message}`);
  }
}

// Main processing function
async function processExcelFiles() {
  const client = await pool.connect();

  try {
    // Get all unprocessed files (processed = 0)
    const getUnprocessedQuery = `
      SELECT id, file_path, file_name, company_identifier, coordinator_email_id, business_process, financial_year,
             due_date, reminder_frequency
      FROM excel_files 
      WHERE processed = 0 
      ORDER BY id ASC;
    `;

    const unprocessedFiles = await client.query(getUnprocessedQuery);

    if (unprocessedFiles.rows.length === 0) {
      console.log('No unprocessed files found.');
      return;
    }

    console.log(`Found ${unprocessedFiles.rows.length} unprocessed file(s).`);

    // Process each file
    for (const file of unprocessedFiles.rows) {
      const fileId = file.id;
      const filePath = file.file_path;
      const fileName = file.file_name;
      const companyIdentifier = file.company_identifier;
      const coordinatorEmailId = file.coordinator_email_id;
      const businessProcess = file.business_process;
      const financialYear = file.financial_year;
      const fileDueDate = file.due_date;
      const fileReminderFrequency = file.reminder_frequency;

      console.log(`Processing file: ${fileName} (ID: ${fileId})`);
      if (companyIdentifier) {
        console.log(`  Company Identifier: ${companyIdentifier}`);
      } else {
        console.log(`  Warning: No company_identifier found for this file`);
      }
      if (coordinatorEmailId) {
        console.log(`  Coordinator Email: ${coordinatorEmailId}`);
      } else {
        console.log(`  Warning: No coordinator_email_id found for this file`);
      }
      if (businessProcess) {
        console.log(`  Business Process: ${businessProcess}`);
      } else {
        console.log(`  Warning: No business_process found for this file`);
      }
      if (financialYear) {
        console.log(`  Financial Year: ${financialYear}`);
      } else {
        console.log(`  Warning: No financial_year found for this file`);
      }

      try {
        await client.query('BEGIN');

        // Check if file path is an S3 key (starts with 'IFC/') or local path
        let fileBuffer;
        if (filePath.startsWith('IFC/')) {
          // Download file from S3
          console.log(`  Downloading file from S3: ${filePath}`);
          fileBuffer = await downloadFileFromS3(filePath);
        } else {
          // Legacy: Read from local filesystem
          if (!fs.existsSync(filePath)) {
            throw new Error(`File not found: ${filePath}`);
          }
          fileBuffer = fs.readFileSync(filePath);
        }

        // Parse Excel file from buffer
        const excelData = parseExcelFile(fileBuffer);
        
        if (excelData.length === 0) {
          throw new Error('Excel file is empty or has no data rows');
        }

        console.log(`\n=== DEBUG: Raw Excel Data (First 3 rows) ===`);
        console.log('Excel Column Headers:', Object.keys(excelData[0] || {}));
        console.log('Total rows in Excel:', excelData.length);
        if (excelData.length > 0) {
          console.log('\nFirst row (raw):', JSON.stringify(excelData[0], null, 2));
          if (excelData.length > 1) {
            console.log('\nSecond row (raw):', JSON.stringify(excelData[1], null, 2));
          }
          if (excelData.length > 2) {
            console.log('\nThird row (raw):', JSON.stringify(excelData[2], null, 2));
          }
        }

        // Transform Excel data to database format
        const transformedData = transformExcelData(excelData);

        console.log(`\n=== DEBUG: Transformed Data (What would be inserted) ===`);
        console.log('Total transformed rows:', transformedData.length);
        
        // Show column mapping for first row
        if (excelData.length > 0 && transformedData.length > 0) {
          console.log('\n--- Column Mapping Analysis (First Row) ---');
          const firstExcelRow = excelData[0];
          const firstTransformedRow = transformedData[0];
          
          Object.keys(firstExcelRow).forEach(excelCol => {
            const dbCol = normalizeColumnName(excelCol);
            const excelValue = firstExcelRow[excelCol];
            const dbValue = firstTransformedRow[dbCol];
            console.log(`Excel: "${excelCol}" -> DB: "${dbCol}" | Excel Value: "${excelValue}" | DB Value: "${dbValue}"`);
          });
          
          console.log('\n--- Transformed Row Data (First 3 rows) ---');
          console.log('\nFirst row (transformed):', JSON.stringify(transformedData[0], null, 2));
          if (transformedData.length > 1) {
            console.log('\nSecond row (transformed):', JSON.stringify(transformedData[1], null, 2));
          }
          if (transformedData.length > 2) {
            console.log('\nThird row (transformed):', JSON.stringify(transformedData[2], null, 2));
          }
          
          // Show null values analysis
          console.log('\n--- Null Values Analysis (First Row) ---');
          const firstRow = transformedData[0];
          const nullColumns = [];
          const nonNullColumns = [];
          Object.keys(firstRow).forEach(col => {
            if (firstRow[col] === null || firstRow[col] === undefined || firstRow[col] === '') {
              nullColumns.push(col);
            } else {
              nonNullColumns.push({ col, value: firstRow[col] });
            }
          });
          console.log('Null/Empty columns:', nullColumns);
          console.log('Non-null columns:', nonNullColumns);
        }

        console.log(`\n=== Inserting data into database ===`);
        const { insertedCount, skippedCount, duplicateCount, errorCount } =
          await insertRacmRowsFromTransformedData(client, {
            transformedData,
            companyIdentifier,
            coordinatorEmailId,
            businessProcess,
            financialYear,
            fileDueDate,
            fileReminderFrequency,
          });

        if (skippedCount > 0) {
          console.log(`\n  Total skipped rows: ${skippedCount} (rows with more than 15 empty values)`);
        }

        if (duplicateCount > 0) {
          console.log(`\n  Total duplicate rows: ${duplicateCount} (rows with same values already exist)`);
        }

        if (errorCount > 0) {
          console.log(`\n  Total error rows: ${errorCount} (rows that failed to insert)`);
        }

        // Only mark file as processed when at least one RACM row was inserted successfully.
        if (insertedCount > 0) {
          const updateFileQuery = `
            UPDATE excel_files
            SET processed = 1
            WHERE id = $1;
          `;
          await client.query(updateFileQuery, [fileId]);
          await client.query('COMMIT');
          console.log(`\n✓ Successfully processed ${fileName}: ${insertedCount} records imported.`);
        } else {
          // No inserts → do NOT mark processed, so the file can be fixed/retried.
          await client.query('ROLLBACK');
          console.error(`✗ No RACM rows inserted for ${fileName}. File not marked as processed.`);
        }

      } catch (error) {
        await client.query('ROLLBACK');

        console.error(`✗ Error processing ${fileName}: ${error.message}`);
        console.error('Stack trace:', error.stack);
      }
    }

  } catch (error) {
    console.error('Error in processExcelFiles:', error);
  } finally {
    client.release();
  }
}

// Run the processing function
if (require.main === module) {
  processExcelFiles()
    .then(() => {
      console.log('Processing completed.');
      process.exit(0);
    })
    .catch((error) => {
      console.error('Fatal error:', error);
      process.exit(1);
    });
}

module.exports = { processExcelFiles };

