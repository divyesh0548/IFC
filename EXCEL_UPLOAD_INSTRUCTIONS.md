# Excel Upload Feature for Control Forms

## Overview
This feature allows you to upload Excel files (.xlsx, .xls, or .csv) containing control form data, which will be automatically imported into the `control_forms` database table.

## Installation

### Backend Dependencies
The following packages have been installed:
- `multer` - For handling file uploads
- `xlsx` - For parsing Excel files

```bash
cd backend
npm install multer xlsx
```

## How It Works

### 1. Excel File Format
Your Excel file should follow this structure:

- **First Row**: Column headers (field names)
- **Subsequent Rows**: Data rows (one control form per row)

### 2. Supported Column Names
The system automatically maps Excel column names to database columns. Supported column names include:

- Description of Control / Description_of_Control
- Process / process
- Sub-process / Sub_process / sub-process
- Risk Description / Risk_Description / risk_description
- Whether fraud risks exist / Whether_fraud_risks_exist
- Control Objective / Control_objective
- Control to address 'What could go wrong' / Control_to_address
- Whether Management Review Control (MRC) or not / MRC_or_not
- Source data/ Report logic/ Report parameters / Information Produced by the Entity (IPE)
- Relevant Data Elements of IPE / Relevant_data_elements_of_ipe
- Type of Control (Preventive, detective) / Type_of_Control
- Nature of Control (Manual or Automated) / Nature_of_Control
- Type of Risk Mitigation method / Type_of_risk_mitigation_method
- Process owner / Process_owner
- Reviewer/ Process Supervisor / Reviewer_Process_Supervisor
- Control frequency / Control_frequency
- Basis of sampling / Basis_of_sampling
- Documents to be reviewed as a part of DMS audit / Docs_to_review_for_DMS_audit
- Type of risk associated with the process flow / Type_of_risk_associated
- Financial Reporting - Head in BS & PL / Financial_reporting
- Checks performed / Checks_performed
- Effective or Not Effective / Effective_or_not_effective
- DONE / done
- Findings / findings
- Active / active
- Approved/Rejected / Approved_Rejected
- doc_uploaded_by_user
- reason_by_approver

**Note**: Column names are case-insensitive and spaces/special characters are automatically normalized.

### 3. Using the Feature

#### Frontend:
1. Navigate to Company Coordinator Dashboard
2. Click on "Upload Control Forms (Excel)" button
3. Select your Excel file (.xlsx, .xls, or .csv)
4. Click "Upload Excel File"
5. Wait for confirmation message showing how many records were imported

#### API Endpoint:
```
POST /api/control-forms/bulk-upload
Content-Type: multipart/form-data
Body: excelFile (file)
```

**Authentication**: Requires valid authentication token (cookie)

**Response**:
```json
{
  "success": true,
  "message": "Successfully imported 5 control form(s)",
  "count": 5
}
```

## Example Excel File Structure

| Description of Control | Process | Sub-process | Risk Description | ... |
|------------------------|---------|-------------|------------------|-----|
| Control 1 Description  | Process A | Sub-process 1 | Risk 1 | ... |
| Control 2 Description  | Process B | Sub-process 2 | Risk 2 | ... |

## Features

- ✅ Automatic column name mapping (flexible naming)
- ✅ Handles empty cells (stored as null)
- ✅ Transaction-based (all or nothing)
- ✅ File validation (type and size)
- ✅ Error handling and rollback
- ✅ Supports .xlsx, .xls, and .csv formats
- ✅ Maximum file size: 10MB

## Error Handling

- Invalid file type: Returns error message
- File too large: Returns error message
- Empty file: Returns error message
- Database errors: Transaction is rolled back, error message returned

## Technical Details

### Backend Route
- **File**: `backend/routes/control_forms.js`
- **Endpoint**: `/api/control-forms/bulk-upload`
- **Method**: POST
- **Middleware**: 
  - `verifyAuth` - Authentication check
  - `upload.single('excelFile')` - File upload handling

### Frontend Component
- **File**: `frontend/src/pages/forms/ExcelUpload.jsx`
- **Route**: `/company_co/upload-excel`
- **Access**: Company Coordinator role only

## Database Table
All data is inserted into the `control_forms` table with the following structure:
- All fields are VARCHAR(255) or TEXT (nullable)
- `id` - Auto-increment primary key
- `created_at` - Timestamp (IST timezone)

