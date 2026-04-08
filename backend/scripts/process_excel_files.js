const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizeColumnName } = require('../utils/column_mapping');
const { downloadFileFromS3 } = require('../utils/s3Upload');
const { logAuditEvent } = require('../utils/auditLog');
const { calculateSampleRequired, getSampleSizeByFrequency } = require('../utils/sample_required');
const { pool } = require('../utils/db');

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

// Function to generate a random 15-character alphanumeric string
function generateFormId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 15; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Function to generate a unique form_id that doesn't exist in the database
async function generateUniqueFormId(client) {
  let formId;
  let isUnique = false;
  let attempts = 0;
  const maxAttempts = 100; // Prevent infinite loop
  
  while (!isUnique && attempts < maxAttempts) {
    formId = generateFormId();
    
    // Check if form_id already exists
    const checkQuery = 'SELECT id FROM control_forms WHERE form_id = $1';
    const result = await client.query(checkQuery, [formId]);
    
    if (result.rows.length === 0) {
      isUnique = true;
    } else {
      attempts++;
    }
  }
  
  if (!isUnique) {
    // Fallback: use crypto random bytes if we can't find a unique one
    formId = crypto.randomBytes(8).toString('hex').toUpperCase().substring(0, 15);
    // Pad with random chars if needed
    while (formId.length < 15) {
      formId += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789'.charAt(Math.floor(Math.random() * 36));
    }
  }
  
  return formId;
}

// Function to count empty values in a row
function countEmptyValues(row) {
  let emptyCount = 0;
  Object.keys(row).forEach(key => {
    const value = row[key];
    if (value === null || value === undefined || value === '' || String(value).trim() === '') {
      emptyCount++;
    }
  });
  return emptyCount;
}

// Assertion columns stored as booleans in DB.
// Rule: default false; true only when that specific cell has a real value.
// Also ignore header-like/placeholder strings that can appear due to row shifts.
function normalizeExcelTruthyToBoolean(value, columnName) {
  if (value === null || value === undefined) return false;
  const raw = String(value).trim();
  if (raw === '') return false;

  const normalized = raw.toLowerCase().replace(/[&/()-]/g, ' ').replace(/\s+/g, ' ').trim();
  const placeholders = new Set(['na', 'n a', 'n/a', 'none', '-', '--']);
  if (placeholders.has(normalized)) return false;

  const headerLikeByColumn = {
    completeness: new Set(['completeness']),
    existence_occurrence: new Set(['existence occurrence', 'existence and occurrence', 'existence  occurrence']),
    rights_and_obligation: new Set(['rights and obligations', 'rights obligations', 'rights and obligation']),
    valuation_and_allocation: new Set(['valuation and allocation', 'valuation allocation']),
    presentation_and_disclosure: new Set(['presentation and disclosure', 'presentation disclosure']),
  };

  const disallowed = headerLikeByColumn[columnName];
  if (disallowed && disallowed.has(normalized)) return false;

  return true;
}

// Duplicate prevention for RACM creation:
// company_identifier + business_process + financial_year + control_number
// Applies only when all key fields are present.
async function checkDuplicateForm(client, row, companyIdentifier, businessProcess, financialYear) {
  try {
    const bpKey = businessProcess != null ? String(businessProcess).trim() : '';
    const fyKey = row['financial_year'] !== null && row['financial_year'] !== undefined && row['financial_year'] !== ''
      ? String(row['financial_year']).trim()
      : (financialYear != null ? String(financialYear).trim() : '');
    const cnKey = row['control_number'] !== null && row['control_number'] !== undefined && row['control_number'] !== ''
      ? String(row['control_number']).trim()
      : '';

    if (!companyIdentifier || !bpKey || !fyKey || !cnKey) {
      return false;
    }

    const result = await client.query(
      `
        SELECT 1
        FROM control_forms
        WHERE company_identifier = $1
          AND LOWER(TRIM(business_process)) = LOWER(TRIM($2))
          AND TRIM(financial_year) = TRIM($3)
          AND TRIM(control_number) = TRIM($4)
        LIMIT 1;
      `,
      [companyIdentifier, bpKey, fyKey, cnKey]
    );

    return result.rows.length > 0;
  } catch (error) {
    console.error('Error checking for duplicate form:', error);
    // If error occurs, assume not duplicate to allow insertion
    return false;
  }
}

// Function to transform Excel data to database format
function transformExcelData(excelRows) {
  return excelRows.map(row => {
    const dbRow = {};
    
    // Map each Excel column to database column
    Object.keys(row).forEach(excelColumn => {
      const dbColumn = normalizeColumnName(excelColumn);
      if (dbColumn) {
        // Convert value to string or null (preserve original value, no truncation)
        const value = row[excelColumn];
        dbRow[dbColumn] = value !== null && value !== undefined && value !== '' 
          ? String(value).trim() 
          : null;
      }
    });
    
    return dbRow;
  });
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

        // Prepare insert query
        const columns = [
          'standard_control_description', 'sub_process', 'risk_description',
          'whether_fraud_risks_exist', 'control_objective', 'ipe_reference',
          'nature_of_control', 'control_frequency',
          'control_number', 'area', 'risk_heat',
          'process_walkthrough', 'control_relies_on_ipe', 'audit_evidence_accuracy',
          'key_control', 'application_name', 'control_performer', 'control_owner',
          'control_design_procs', 'control_design_conclusion', 'design_deficiency_desc',
          'sample_size', 'control_type_fo', 'control_type_ma',
          'doc_uploaded_by_user', 'active', 'status', 'reason_by_approver',
          'company_identifier', 'form_id', 'business_process', 'financial_year',
          'due_date', 'reminder_frequency',
          'sample_required',
          'completeness', 'existence_occurrence', 'rights_and_obligation',
          'valuation_and_allocation', 'presentation_and_disclosure'
        ];

        const columnList = columns.join(', ');
        const placeholders = columns.map((_, index) => `$${index + 1}`).join(', ');

        const insertQuery = `
          INSERT INTO control_forms (${columnList})
          VALUES (${placeholders})
          RETURNING id;
        `;

        console.log(`\n=== Inserting data into database ===`);
        let insertedCount = 0;
        let skippedCount = 0;
        let errorCount = 0;
        let duplicateCount = 0;
        
        for (let i = 0; i < transformedData.length; i++) {
          const row = transformedData[i];
          
          // Check if row has more than 15 empty values
          const emptyCount = countEmptyValues(row);
          if (emptyCount > 15) {
            skippedCount++;
            console.log(`  Skipping row ${i + 1}: ${emptyCount} empty values (threshold: 15)`);
            continue;
          }
          
          try {
            // Check for duplicate form before inserting
            const isDuplicate = await checkDuplicateForm(client, row, companyIdentifier, businessProcess, financialYear);
            if (isDuplicate) {
              duplicateCount++;
              console.log(`  Skipping row ${i + 1}: Duplicate form found (same values already exist)`);
              continue;
            }
            
            // Generate unique form_id for this row
            const formId = await generateUniqueFormId(client);
            
            // Calculate sample_required based on control_frequency and current timestamp
            // We use current timestamp which will match the created_at value set by the database
            const currentTimestamp = new Date();
            // Get control_frequency from row, normalize it
            const controlFrequencyRaw = row['control_frequency'] || null;
            const controlFrequency = controlFrequencyRaw ? String(controlFrequencyRaw).trim() : null;
            const sampleRequired = calculateSampleRequired(controlFrequency, currentTimestamp);
            const sampleSize = getSampleSizeByFrequency(controlFrequency);
            console.log(`[process_excel] Row ${i + 1} - control_frequency raw: "${controlFrequencyRaw}", normalized: "${controlFrequency}", sample_required result: "${sampleRequired}"`);
            
            const values = columns.map(col => {
              // Use company_identifier from excel_files table, not from Excel data
              if (col === 'company_identifier') {
                return companyIdentifier;
              }
              // Use generated form_id
              if (col === 'form_id') {
                return formId;
              }
              // Use business_process from excel_files table, not from Excel data
              if (col === 'business_process') {
                return businessProcess;
              }
              // Use financial_year from Excel data if available, otherwise fall back to excel_files table
              if (col === 'financial_year') {
                // Check if Excel row has financial_year column
                if (row['financial_year'] !== null && row['financial_year'] !== undefined && row['financial_year'] !== '') {
                  return String(row['financial_year']).trim();
                }
                // Fall back to value from excel_files table
                return financialYear || null;
              }
              // Use reminder settings from excel_files table (applies to all rows in the file)
              if (col === 'due_date') {
                return fileDueDate || null;
              }
              if (col === 'reminder_frequency') {
                return fileReminderFrequency || null;
              }
              // Calculate sample_required based on control_frequency
              if (col === 'sample_required') {
                return sampleRequired;
              }
              // Derive sample_size from control_frequency to keep it consistent.
              if (col === 'sample_size') {
                return sampleSize !== null ? String(sampleSize) : null;
              }

              // Assertions: store booleans in DB based on presence of any value in Excel cell.
              if (
                col === 'completeness' ||
                col === 'existence_occurrence' ||
                col === 'rights_and_obligation' ||
                col === 'valuation_and_allocation' ||
                col === 'presentation_and_disclosure'
              ) {
                return normalizeExcelTruthyToBoolean(row[col], col);
              }
              return row[col] || null;
            });
            
            // Insert row into database
            await client.query(insertQuery, values);
            insertedCount++;
            
        // Log audit event for RACM creation
            if (coordinatorEmailId) {
            await logAuditEvent('RACM created', coordinatorEmailId, formId);
            }
          } catch (rowError) {
            // Log error for this specific row but continue processing
            errorCount++;
            console.error(`  ✗ Error inserting row ${i + 1}: ${rowError.message}`);
            console.error(`    Row data: form_id would be generated, control_frequency: "${row['control_frequency'] || 'N/A'}"`);
            // Continue to next row instead of stopping
            continue;
          }
          
          // Log progress for every 10 rows
          if ((i + 1) % 10 === 0 || i === transformedData.length - 1) {
            console.log(`  Processed ${i + 1}/${transformedData.length} rows (Inserted: ${insertedCount}, Skipped: ${skippedCount}, Duplicates: ${duplicateCount}, Errors: ${errorCount})...`);
          }
        }
        
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

