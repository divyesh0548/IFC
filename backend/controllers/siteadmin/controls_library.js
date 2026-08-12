const multer = require('multer');
const { prisma, withPrismaRetry, isPrismaConnectionError } = require('../../lib/prisma');
const { getDatabaseUnavailableMessage } = require('../../utils/db');
const {
  parseControlsLibraryWorkbook,
  buildControlsLibraryTemplateBuffer,
  buildPrismaCreateRows,
} = require('../../utils/controls_library');

const uploadControlsLibraryExcel = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const name = String(file.originalname || '').toLowerCase();
    if (name.endsWith('.xlsx') || name.endsWith('.xls')) {
      cb(null, true);
      return;
    }
    cb(new Error('Only .xlsx or .xls files are allowed'));
  },
});

function handleControlsLibraryUpload(req, res, next) {
  uploadControlsLibraryExcel.single('file')(req, res, (error) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      return res.status(400).json({
        success: false,
        message: error.message || 'Failed to upload controls library file',
      });
    }

    return res.status(400).json({
      success: false,
      message: error.message || 'Failed to upload controls library file',
    });
  });
}

async function downloadControlsLibraryTemplate(req, res) {
  try {
    const buffer = buildControlsLibraryTemplateBuffer();
    res.setHeader(
      'Content-Type',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    );
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="controls_library_template.xlsx"'
    );
    return res.send(buffer);
  } catch (error) {
    console.error('downloadControlsLibraryTemplate error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to generate controls library template',
    });
  }
}

async function uploadControlsLibrary(req, res) {
  try {
    const businessProcess = String(req.body?.business_process || '').trim();
    if (!businessProcess) {
      return res.status(400).json({
        success: false,
        message: 'Business process is required',
      });
    }

    if (!req.file?.buffer) {
      return res.status(400).json({
        success: false,
        message: 'Excel file is required',
      });
    }

    let selectedSheetNames = [];
    if (req.body?.sheet_names) {
      try {
        const parsed = JSON.parse(String(req.body.sheet_names));
        if (Array.isArray(parsed)) {
          selectedSheetNames = parsed
            .map((name) => String(name || '').trim())
            .filter(Boolean);
        }
      } catch {
        return res.status(400).json({
          success: false,
          message: 'Invalid sheet_names payload',
        });
      }
    }

    const parsed = parseControlsLibraryWorkbook(
      req.file.buffer,
      selectedSheetNames.length ? selectedSheetNames : null
    );
    if (!parsed.ok) {
      return res.status(400).json({
        success: false,
        message: parsed.message,
        missingFields: parsed.missingFields || undefined,
        sheet_names: parsed.sheetNames || undefined,
        requires_sheet_selection: parsed.requiresSheetSelection || false,
        sheet_name: parsed.sheetName || undefined,
      });
    }

    const createRows = buildPrismaCreateRows(businessProcess, parsed.rows);

    await withPrismaRetry(
      () => prisma.$transaction([
        prisma.controlsLibrary.deleteMany({
          where: { businessProcess },
        }),
        prisma.controlsLibrary.createMany({
          data: createRows,
        }),
      ]),
      { retries: 1, label: 'uploadControlsLibrary' }
    );

    return res.json({
      success: true,
      message: `Uploaded ${createRows.length} controls for ${businessProcess}`,
      data: {
        business_process: businessProcess,
        row_count: createRows.length,
        sheet_names: parsed.sheetNames,
        sheet_results: parsed.sheetResults,
      },
    });
  } catch (error) {
    return sendControlsLibraryError(res, error, 'Failed to upload controls library');
  }
}

async function getControlsLibrarySummary(req, res) {
  try {
    const grouped = await withPrismaRetry(
      () => prisma.controlsLibrary.groupBy({
        by: ['businessProcess'],
        _count: { _all: true },
        orderBy: { businessProcess: 'asc' },
      }),
      { retries: 1, label: 'getControlsLibrarySummary' }
    );

    return res.json({
      success: true,
      data: grouped.map((row) => ({
        business_process: row.businessProcess,
        row_count: row._count._all,
      })),
    });
  } catch (error) {
    return sendControlsLibraryError(res, error, 'Failed to fetch controls library summary');
  }
}

function sendControlsLibraryError(res, error, fallbackMessage) {
  console.error(fallbackMessage, error);
  const connectionError = isPrismaConnectionError(error);
  return res.status(connectionError ? 503 : 500).json({
    success: false,
    message: connectionError ? getDatabaseUnavailableMessage() : fallbackMessage,
  });
}

function serializeControlsLibraryRow(row) {
  if (!row) return null;
  return {
    id: row.id,
    business_process: row.businessProcess,
    sub_process: row.subProcess,
    risk_description: row.riskDescription,
    risk_heat: row.riskHeat,
    control_objective: row.controlObjective,
    standard_control_description: row.standardControlDescription,
    control_type_ma: row.controlTypeMa,
    control_type_fo: row.controlTypeFo,
    nature_of_control: row.natureOfControl,
    process_walkthrough: row.processWalkthrough,
    key_control: row.keyControl,
    application_name: row.applicationName,
    audit_evidence_accuracy: row.auditEvidenceAccuracy,
    whether_fraud_risks_exist: row.whetherFraudRisksExist,
    control_frequency: row.controlFrequency,
    created_at: row.createdAt,
    updated_at: row.updatedAt,
  };
}

const UPDATABLE_FIELDS = {
  business_process: 'businessProcess',
  sub_process: 'subProcess',
  risk_description: 'riskDescription',
  risk_heat: 'riskHeat',
  control_objective: 'controlObjective',
  standard_control_description: 'standardControlDescription',
  control_type_ma: 'controlTypeMa',
  control_type_fo: 'controlTypeFo',
  nature_of_control: 'natureOfControl',
  process_walkthrough: 'processWalkthrough',
  key_control: 'keyControl',
  application_name: 'applicationName',
  audit_evidence_accuracy: 'auditEvidenceAccuracy',
  whether_fraud_risks_exist: 'whetherFraudRisksExist',
  control_frequency: 'controlFrequency',
};

function normalizeOptionalText(value) {
  if (value === null || value === undefined) return null;
  const text = String(value).trim();
  return text === '' ? null : text;
}

async function listControlsLibrary(req, res) {
  try {
    const businessProcess = String(req.query.business_process || '').trim();
    const subProcess = String(req.query.sub_process || '').trim();

    const where = {};
    if (businessProcess) {
      where.businessProcess = businessProcess;
    }
    if (subProcess) {
      where.subProcess = subProcess;
    }

    const page = Math.max(1, Number.parseInt(req.query.page, 10) || 1);
    const pageSize = Math.min(100, Math.max(1, Number.parseInt(req.query.page_size, 10) || 10));
    const skip = (page - 1) * pageSize;

    const { total, rows } = await withPrismaRetry(async () => {
      const totalCount = await prisma.controlsLibrary.count({ where });
      const pageRows = await prisma.controlsLibrary.findMany({
        where,
        orderBy: { id: 'asc' },
        skip,
        take: pageSize,
      });
      return { total: totalCount, rows: pageRows };
    }, { retries: 1, label: 'listControlsLibrary' });

    return res.json({
      success: true,
      data: rows.map(serializeControlsLibraryRow),
      count: total,
      page,
      page_size: pageSize,
    });
  } catch (error) {
    return sendControlsLibraryError(res, error, 'Failed to fetch controls library');
  }
}

async function listControlsLibrarySubProcesses(req, res) {
  try {
    const businessProcess = String(req.query.business_process || '').trim();
    if (!businessProcess) {
      return res.status(400).json({
        success: false,
        message: 'business_process is required',
      });
    }

    const rows = await withPrismaRetry(
      () => prisma.controlsLibrary.findMany({
        where: {
          businessProcess,
          subProcess: { not: null },
        },
        select: { subProcess: true },
        distinct: ['subProcess'],
        orderBy: { subProcess: 'asc' },
      }),
      { retries: 1, label: 'listControlsLibrarySubProcesses' }
    );

    const subProcesses = rows
      .map((row) => String(row.subProcess || '').trim())
      .filter(Boolean);

    return res.json({
      success: true,
      data: subProcesses,
    });
  } catch (error) {
    return sendControlsLibraryError(res, error, 'Failed to fetch sub-processes');
  }
}

async function getControlsLibraryById(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid controls library id',
      });
    }

    const row = await withPrismaRetry(
      () => prisma.controlsLibrary.findUnique({ where: { id } }),
      { retries: 1, label: 'getControlsLibraryById' }
    );
    if (!row) {
      return res.status(404).json({
        success: false,
        message: 'Controls library entry not found',
      });
    }

    return res.json({
      success: true,
      data: serializeControlsLibraryRow(row),
    });
  } catch (error) {
    return sendControlsLibraryError(res, error, 'Failed to fetch controls library entry');
  }
}

async function updateControlsLibrary(req, res) {
  try {
    const id = Number(req.params.id);
    if (!Number.isInteger(id) || id <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Invalid controls library id',
      });
    }

    const existing = await withPrismaRetry(
      () => prisma.controlsLibrary.findUnique({ where: { id } }),
      { retries: 1, label: 'updateControlsLibrary.find' }
    );
    if (!existing) {
      return res.status(404).json({
        success: false,
        message: 'Controls library entry not found',
      });
    }

    const body = req.body || {};
    const data = {};

    Object.entries(UPDATABLE_FIELDS).forEach(([apiKey, prismaKey]) => {
      if (!Object.prototype.hasOwnProperty.call(body, apiKey)) return;
      if (apiKey === 'business_process') {
        const nextBusinessProcess = String(body[apiKey] || '').trim();
        if (!nextBusinessProcess) {
          return;
        }
        data[prismaKey] = nextBusinessProcess;
        return;
      }
      data[prismaKey] = normalizeOptionalText(body[apiKey]);
    });

    if (Object.keys(data).length === 0) {
      return res.status(400).json({
        success: false,
        message: 'No fields provided to update',
      });
    }

    if (Object.prototype.hasOwnProperty.call(body, 'business_process')) {
      const nextBusinessProcess = String(body.business_process || '').trim();
      if (!nextBusinessProcess) {
        return res.status(400).json({
          success: false,
          message: 'Business process is required',
        });
      }
    }

    const updated = await withPrismaRetry(
      () => prisma.controlsLibrary.update({
        where: { id },
        data,
      }),
      { retries: 1, label: 'updateControlsLibrary' }
    );

    return res.json({
      success: true,
      message: 'Controls library entry updated',
      data: serializeControlsLibraryRow(updated),
    });
  } catch (error) {
    return sendControlsLibraryError(res, error, 'Failed to update controls library entry');
  }
}

module.exports = {
  handleControlsLibraryUpload,
  downloadControlsLibraryTemplate,
  uploadControlsLibrary,
  getControlsLibrarySummary,
  listControlsLibrary,
  listControlsLibrarySubProcesses,
  getControlsLibraryById,
  updateControlsLibrary,
};
