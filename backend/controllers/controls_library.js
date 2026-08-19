const { prisma } = require('../lib/prisma');
const {
  SEARCHABLE_DB_FIELDS,
  DB_COLUMN_TO_PRISMA_FIELD,
  buildSuggestionsFromRows,
  normalizeLibraryIds,
} = require('../utils/controls_library');

async function getControlsLibrarySuggestions(req, res) {
  try {
    const businessProcess = String(req.query.business_process || '').trim();
    const field = String(req.query.field || '').trim();
    const searchText = String(req.query.q || '').trim();
    const subProcess = String(req.query.sub_process || '').trim();
    const prioritizeSubProcess = String(req.query.prioritize_sub_process || '').toLowerCase() === 'true';
    const prioritizeRisk = String(req.query.prioritize_risk || '').toLowerCase() === 'true';
    const librarySubProcessId = req.query.library_sub_process_id
      ? Number(req.query.library_sub_process_id)
      : null;
    const librarySubProcessIds = normalizeLibraryIds(
      String(req.query.library_sub_process_ids || '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
    );
    const libraryRiskIds = normalizeLibraryIds(
      String(req.query.library_risk_ids || req.query.library_risk_id || '')
        .split(',')
        .map((part) => part.trim())
        .filter(Boolean)
    );

    if (!businessProcess) {
      return res.status(400).json({
        success: false,
        message: 'business_process is required',
      });
    }

    if (!field || !SEARCHABLE_DB_FIELDS.includes(field)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid or missing field',
      });
    }

    const prismaField = DB_COLUMN_TO_PRISMA_FIELD[field];
    const rows = await prisma.controlsLibrary.findMany({
      where: {
        businessProcess: {
          equals: businessProcess,
          mode: 'insensitive',
        },
      },
      select: {
        id: true,
        subProcess: true,
        riskDescription: true,
        [prismaField]: true,
      },
      orderBy: { id: 'asc' },
    });

    const result = buildSuggestionsFromRows(rows, {
      field,
      searchText,
      subProcess,
      prioritizeSubProcess,
      prioritizeRisk: prioritizeRisk && libraryRiskIds.length > 0,
      librarySubProcessId: Number.isFinite(librarySubProcessId) ? librarySubProcessId : null,
      librarySubProcessIds,
      libraryRiskIds,
    });

    if (!result.ok) {
      return res.status(400).json({
        success: false,
        message: result.message,
      });
    }

    return res.json({
      success: true,
      data: {
        field,
        suggestions: result.suggestions,
      },
    });
  } catch (error) {
    console.error('getControlsLibrarySuggestions error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch controls library suggestions',
    });
  }
}

module.exports = {
  getControlsLibrarySuggestions,
};
