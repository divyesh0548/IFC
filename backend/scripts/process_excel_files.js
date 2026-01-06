const { Pool } = require('pg');
const XLSX = require('xlsx');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { normalizeColumnName } = require('../utils/column_mapping');

// Database connection pool
const pool = new Pool({
  user: process.env.DB_USER || 'divyesh',
  host: process.env.DB_HOST || 'localhost',
  database: process.env.DB_NAME || 'ifc_dev',
  password: String(process.env.DB_PASSWORD || '0548'),
  port: parseInt(process.env.DB_PORT || '5432', 10),
});

// Set timezone to IST for all connections
pool.on('connect', async (client) => {
  await client.query("SET timezone = 'Asia/Kolkata'");
});

// Keywords to identify header row (case-insensitive)
const headerKeywords = [
  'description of control',
  'process',
  'sub-process',
  'risk description',
  'control objective',
  'control to address',
  'mrc',
  'ipe',
  'type of control',
  'nature of control',
  'process owner',
  'control frequency',
  'financial reporting',
  'findings'
];

// Function to normalize text for comparison
function normalizeText(text) {
  if (!text) return '';
  return String(text).toLowerCase().trim().replace(/[\/\(\)&]/g, ' ').replace(/\s+/g, ' ');
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
    if (matchCount > bestMatchCount && matchCount >= 3) {
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
function parseExcelFile(filePath) {
  try {
    const workbook = XLSX.readFile(filePath);
    const sheetNames = workbook.SheetNames;
    
    if (!sheetNames || sheetNames.length === 0) {
      throw new Error('Excel file has no sheets');
    }
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`Excel File: ${path.basename(filePath)}`);
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
      SELECT id, file_path, file_name, company_identifier 
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

      console.log(`Processing file: ${fileName} (ID: ${fileId})`);
      if (companyIdentifier) {
        console.log(`  Company Identifier: ${companyIdentifier}`);
      } else {
        console.log(`  Warning: No company_identifier found for this file`);
      }

      try {
        await client.query('BEGIN');

        // Check if file exists
        if (!fs.existsSync(filePath)) {
          throw new Error(`File not found: ${filePath}`);
        }

        // Parse Excel file
        const excelData = parseExcelFile(filePath);
        
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
          'description_of_control', 'process', 'sub_process', 'risk_description',
          'whether_fraud_risks_exist', 'control_objective', 'control_to_address',
          'mrc_or_not', 'source_data_report_logic_report_parameters',
          'relevant_data_elements_of_ipe', 'type_of_control', 'nature_of_control',
          'type_of_risk_mitigation_method', 'process_owner', 'reviewer_process_supervisor',
          'control_frequency', 'basis_of_sampling', 'docs_to_review_for_dms_audit',
          'type_of_risk_associated', 'financial_reporting', 'checks_performed',
          'effective_or_not_effective', 'done', 'findings', 'gap_description_resolution',
          'doc_uploaded_by_user', 'active', 'approved_rejected', 'reason_by_approver',
          'company_identifier', 'form_id'
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
        
        for (let i = 0; i < transformedData.length; i++) {
          const row = transformedData[i];
          
          // Check if row has more than 10 empty values
          const emptyCount = countEmptyValues(row);
          if (emptyCount > 10) {
            skippedCount++;
            console.log(`  Skipping row ${i + 1}: ${emptyCount} empty values (threshold: 10)`);
            continue;
          }
          
          // Generate unique form_id for this row
          const formId = await generateUniqueFormId(client);
          
          const values = columns.map(col => {
            // Use company_identifier from excel_files table, not from Excel data
            if (col === 'company_identifier') {
              return companyIdentifier;
            }
            // Use generated form_id
            if (col === 'form_id') {
              return formId;
            }
            return row[col] || null;
          });
          
          // Insert row into database
          await client.query(insertQuery, values);
          insertedCount++;
          
          // Log progress for every 10 rows
          if ((i + 1) % 10 === 0 || i === transformedData.length - 1) {
            console.log(`  Processed ${i + 1}/${transformedData.length} rows (Inserted: ${insertedCount}, Skipped: ${skippedCount})...`);
          }
        }
        
        if (skippedCount > 0) {
          console.log(`\n  Total skipped rows: ${skippedCount} (rows with more than 10 empty values)`);
        }

        // Update excel_files table: set processed = 1
        const updateFileQuery = `
          UPDATE excel_files 
          SET processed = 1
          WHERE id = $1;
        `;

        await client.query(updateFileQuery, [fileId]);

        await client.query('COMMIT');

        console.log(`\n✓ Successfully processed ${fileName}: ${insertedCount} records imported.`);

      } catch (error) {
        await client.query('ROLLBACK');
        
        // Update excel_files table: set processed = 1 even on error
        // This prevents the file from being reprocessed indefinitely
        const updateErrorQuery = `
          UPDATE excel_files 
          SET processed = 1
          WHERE id = $1;
        `;

        try {
          await client.query(updateErrorQuery, [fileId]);
        } catch (updateError) {
          console.error(`Error updating processed flag: ${updateError.message}`);
        }

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

