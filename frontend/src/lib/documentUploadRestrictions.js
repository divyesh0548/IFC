export const DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES = 25 * 1024 * 1024

export const DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB = 25

export const ALLOWED_DOCUMENT_EXTENSIONS = new Set([
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
])

export const DOCUMENT_UPLOAD_ACCEPT = Array.from(ALLOWED_DOCUMENT_EXTENSIONS).join(',')

export const DOCUMENT_UPLOAD_INVALID_TYPE_MESSAGE =
  'Only PDF, Excel, PowerPoint, Word, TXT, and image files are allowed'

export const DOCUMENT_UPLOAD_INVALID_SIZE_MESSAGE =
  `Each uploaded document must be ${DOCUMENT_UPLOAD_MAX_FILE_SIZE_MB} MB or smaller`

export function getFileExtension(fileName) {
  const lastDotIndex = String(fileName || '').lastIndexOf('.')
  if (lastDotIndex < 0) return ''
  return String(fileName).slice(lastDotIndex).toLowerCase()
}

export function validateDocumentUploadFiles(files) {
  const validFiles = []
  const invalidTypeFiles = []
  const invalidSizeFiles = []

  ;(files || []).forEach((file) => {
    const extension = getFileExtension(file.name)
    if (!ALLOWED_DOCUMENT_EXTENSIONS.has(extension)) {
      invalidTypeFiles.push(file)
      return
    }

    if (file.size > DOCUMENT_UPLOAD_MAX_FILE_SIZE_BYTES) {
      invalidSizeFiles.push(file)
      return
    }

    validFiles.push(file)
  })

  return { validFiles, invalidTypeFiles, invalidSizeFiles }
}
