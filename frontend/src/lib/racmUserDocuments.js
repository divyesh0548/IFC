export function normalizeRacmUserDocument(doc, index = 0) {
  return {
    id: doc?.id || `user-doc-${index}`,
    doc_uploaded_by_user: doc?.doc_uploaded_by_user,
    user_id: doc?.user_id ?? null,
    created_at: doc?.created_at ?? null,
  }
}

export function normalizeRacmUserDocuments(docs, legacyDocUrl = null) {
  const normalizedDocs = (Array.isArray(docs) ? docs : [])
    .map((doc, index) => normalizeRacmUserDocument(doc, index))
    .filter((doc) => String(doc.doc_uploaded_by_user || '').trim() !== '')

  if (normalizedDocs.length > 0) return normalizedDocs

  const legacyDoc = String(legacyDocUrl || '').trim()
  return legacyDoc
    ? [{ id: 'user-doc-current', doc_uploaded_by_user: legacyDoc, user_id: null, created_at: null }]
    : []
}

export function formatRacmUserDocumentSubtitle(doc, formatDateTime) {
  const parts = []

  if (doc?.created_at && typeof formatDateTime === 'function') {
    const formattedDate = formatDateTime(doc.created_at)
    if (formattedDate && formattedDate !== 'N/A') {
      parts.push(formattedDate)
    }
  }

  const email = String(doc?.user_id || '').trim()
  if (email) {
    parts.push(`Uploaded by ${email}`)
  }

  if (parts.length > 0) return parts.join(' · ')
  return 'Uploaded document'
}

export function normalizeSampleDocument(doc, index = 0) {
  return {
    id: doc?.id || `sample-doc-${index}`,
    sample_doc: doc?.sample_doc,
    user_id: doc?.user_id ?? null,
    created_at: doc?.created_at ?? null,
  }
}

export function normalizeSampleDocuments(docs, legacyDocUrl = null) {
  const normalizedDocs = (Array.isArray(docs) ? docs : [])
    .map((doc, index) => normalizeSampleDocument(doc, index))
    .filter((doc) => String(doc.sample_doc || '').trim() !== '')

  if (normalizedDocs.length > 0) return normalizedDocs

  const legacyDoc = String(legacyDocUrl || '').trim()
  return legacyDoc
    ? [{ id: 'sample-doc-current', sample_doc: legacyDoc, user_id: null, created_at: null }]
    : []
}

export const formatRacmSampleDocumentSubtitle = formatRacmUserDocumentSubtitle
