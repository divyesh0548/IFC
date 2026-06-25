const path = require('path');

const ALLOWED_DOCUMENT_EXTENSIONS = new Set([
  '.pdf',
  '.xls',
  '.xlsx',
  '.xlsm',
  '.xlsb',
  '.xlt',
  '.xltx',
  '.xltm',
  '.xlam',
  '.csv',
  '.doc',
  '.docx',
  '.docm',
  '.dot',
  '.dotx',
  '.dotm',
  '.ppt',
  '.pptx',
  '.pptm',
  '.pot',
  '.potx',
  '.potm',
  '.pps',
  '.ppsx',
  '.ppsm',
  '.txt',
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.bmp',
  '.webp',
  '.tif',
  '.tiff',
]);

const DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024;

const DOCUMENT_UPLOAD_INVALID_TYPE_MESSAGE =
  'Invalid file type. Allowed file types: PDF, Excel, PowerPoint, Word, TXT, and image files.';

const DOCUMENT_UPLOAD_INVALID_SIZE_MESSAGE =
  'Each uploaded document must be 25 MB or smaller';

const DEFICIENCY_RESPONSE_INVALID_SIZE_MESSAGE =
  'Each deficiency response document must be 25 MB or smaller';

function documentUploadFileFilter(req, file, cb) {
  const extension = path.extname(String(file?.originalname || '')).toLowerCase();
  if (ALLOWED_DOCUMENT_EXTENSIONS.has(extension)) {
    cb(null, true);
    return;
  }

  cb(new Error(DOCUMENT_UPLOAD_INVALID_TYPE_MESSAGE));
}

module.exports = {
  ALLOWED_DOCUMENT_EXTENSIONS,
  DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES,
  DOCUMENT_UPLOAD_INVALID_TYPE_MESSAGE,
  DOCUMENT_UPLOAD_INVALID_SIZE_MESSAGE,
  DEFICIENCY_RESPONSE_INVALID_SIZE_MESSAGE,
  documentUploadFileFilter,
};
