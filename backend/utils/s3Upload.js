const { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
require('dotenv').config();

// Get AWS credentials from environment
const AWS_ACCESS_KEY_ID = process.env.AWS_ACCESS_KEY_ID;
const AWS_SECRET_ACCESS_KEY = process.env.AWS_SECRET_ACCESS_KEY;
const AWS_REGION = process.env.AWS_REGION || 'us-east-1';
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'snt-nhit-data';

// Validate credentials
if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
  console.error('⚠️  AWS credentials not found in environment variables!');
  console.error('   Please ensure AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY are set in .env file');
}

// Initialize S3 client
const s3Client = new S3Client({
  region: AWS_REGION,
  credentials: {
    accessKeyId: AWS_ACCESS_KEY_ID,
    secretAccessKey: AWS_SECRET_ACCESS_KEY,
  },
});

console.log(`S3 Client initialized - Region: ${AWS_REGION}, Bucket: ${BUCKET_NAME}`);

/**
 * Upload a file buffer to S3
 * @param {Buffer} fileBuffer - The file buffer to upload
 * @param {string} fileName - The original file name
 * @param {string} folderPath - The folder path in S3 (e.g., 'IFC/control_form_excel_files')
 * @returns {Promise<string>} - The S3 key (full path) of the uploaded file
 */
async function uploadFileToS3(fileBuffer, fileName, folderPath = 'IFC/control_form_excel_files') {
  try {
    // Generate unique filename with timestamp
    const timestamp = Date.now();
    const randomSuffix = Math.round(Math.random() * 1E9);
    const ext = fileName.substring(fileName.lastIndexOf('.'));
    const uniqueFileName = `${timestamp}-${randomSuffix}${ext}`;
    
    // Construct S3 key (full path)
    const s3Key = `${folderPath}/${uniqueFileName}`;
    
    // Upload to S3
    const command = new PutObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
      Body: fileBuffer,
      ContentType: getContentType(fileName),
    });
    
    await s3Client.send(command);
    
    console.log(`✓ File uploaded to S3: ${s3Key}`);
    return s3Key;
  } catch (error) {
    console.error('Error uploading file to S3:', error);
    throw new Error(`Failed to upload file to S3: ${error.message}`);
  }
}

/**
 * Download a file from S3
 * @param {string} s3Key - The S3 key (full path) of the file
 * @returns {Promise<Buffer>} - The file buffer
 */
async function downloadFileFromS3(s3Key) {
  try {
    // Validate credentials before attempting download
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS credentials are not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your .env file.');
    }

    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });
    
    console.log(`[S3 Download] Attempting to download - Bucket: ${BUCKET_NAME}, Key: ${s3Key}`);
    const response = await s3Client.send(command);
    
    if (!response.Body) {
      throw new Error('No file content returned from S3');
    }
    
    // Convert stream to buffer
    const chunks = [];
    for await (const chunk of response.Body) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);
    
    console.log(`[S3 Download] ✓ Successfully downloaded: ${s3Key} (Size: ${buffer.length} bytes)`);
    return buffer;
  } catch (error) {
    console.error('[S3 Download] Error downloading file from S3:', error);
    console.error('[S3 Download] Error name:', error.name);
    console.error('[S3 Download] Error message:', error.message);
    console.error('[S3 Download] Error code:', error.Code || error.$metadata?.httpStatusCode);
    console.error('[S3 Download] Full error:', JSON.stringify(error, null, 2));
    
    // Check for specific AWS errors
    if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      throw new Error(`File not found in S3 bucket "${BUCKET_NAME}" with key "${s3Key}"`);
    } else if (error.name === 'AccessDenied' || error.Code === 'AccessDenied' || error.$metadata?.httpStatusCode === 403) {
      throw new Error(`Access denied to S3 file. Check your AWS credentials and bucket permissions.`);
    } else if (error.name === 'InvalidAccessKeyId' || error.name === 'SignatureDoesNotMatch') {
      throw new Error(`Invalid AWS credentials. Please verify your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.`);
    }
    
    throw new Error(`Failed to download file from S3: ${error.message || error.toString()}`);
  }
}

/**
 * Get content type based on file extension
 * @param {string} fileName - The file name
 * @returns {string} - The MIME type
 */
function getContentType(fileName) {
  const ext = fileName.toLowerCase().substring(fileName.lastIndexOf('.'));
  const contentTypes = {
    '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    '.xls': 'application/vnd.ms-excel',
    '.csv': 'text/csv',
  };
  return contentTypes[ext] || 'application/octet-stream';
}

/**
 * Delete a file from S3
 * @param {string} s3Key - The S3 key (full path) of the file to delete
 * @returns {Promise<void>}
 */
async function deleteFileFromS3(s3Key) {
  try {
    // Validate credentials before attempting delete
    if (!AWS_ACCESS_KEY_ID || !AWS_SECRET_ACCESS_KEY) {
      throw new Error('AWS credentials are not configured. Please set AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY in your .env file.');
    }

    const command = new DeleteObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });
    
    console.log(`[S3 Delete] Attempting to delete - Bucket: ${BUCKET_NAME}, Key: ${s3Key}`);
    await s3Client.send(command);
    
    console.log(`[S3 Delete] ✓ Successfully deleted: ${s3Key}`);
  } catch (error) {
    console.error('[S3 Delete] Error deleting file from S3:', error);
    console.error('[S3 Delete] Error name:', error.name);
    console.error('[S3 Delete] Error message:', error.message);
    
    // Check for specific AWS errors
    if (error.name === 'NoSuchKey' || error.Code === 'NoSuchKey' || error.$metadata?.httpStatusCode === 404) {
      console.warn(`[S3 Delete] ⚠️  File not found in S3 bucket "${BUCKET_NAME}" with key "${s3Key}" - continuing anyway`);
      return; // Don't throw error if file doesn't exist
    } else if (error.name === 'AccessDenied' || error.Code === 'AccessDenied' || error.$metadata?.httpStatusCode === 403) {
      throw new Error(`Access denied to S3 file. Check your AWS credentials and bucket permissions.`);
    } else if (error.name === 'InvalidAccessKeyId' || error.name === 'SignatureDoesNotMatch') {
      throw new Error(`Invalid AWS credentials. Please verify your AWS_ACCESS_KEY_ID and AWS_SECRET_ACCESS_KEY.`);
    }
    
    throw new Error(`Failed to delete file from S3: ${error.message || error.toString()}`);
  }
}

/**
 * Get a presigned URL for downloading a file (optional, for direct downloads)
 * @param {string} s3Key - The S3 key (full path) of the file
 * @param {number} expiresIn - URL expiration time in seconds (default: 3600 = 1 hour)
 * @returns {Promise<string>} - The presigned URL
 */
async function getPresignedUrl(s3Key, expiresIn = 3600) {
  try {
    const command = new GetObjectCommand({
      Bucket: BUCKET_NAME,
      Key: s3Key,
    });
    
    const url = await getSignedUrl(s3Client, command, { expiresIn });
    return url;
  } catch (error) {
    console.error('Error generating presigned URL:', error);
    throw new Error(`Failed to generate presigned URL: ${error.message}`);
  }
}

module.exports = {
  uploadFileToS3,
  downloadFileFromS3,
  deleteFileFromS3,
  getPresignedUrl,
  BUCKET_NAME,
};

