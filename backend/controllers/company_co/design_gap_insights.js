const crypto = require('crypto');
const { pool } = require('../../utils/db');
const { prisma } = require('../../lib/prisma');
const {
  analyzeDesignGapControl,
  checkAiSummaryHealth,
  getAiSummaryConfig,
} = require('../../utils/ai_summary_client');

/** In-memory design-gap jobs (one active job per coordinator). */
const designGapJobs = new Map();
const activeJobByCoordinator = new Map();

function normalizeEmail(value) {
  return String(value || '').trim().toLowerCase();
}

function shapeJob(job) {
  if (!job) return null;
  return {
    job_id: job.job_id,
    status: job.status,
    unit_id: job.unit_id,
    total: job.total,
    processed: job.processed,
    skipped_existing: job.skipped_existing,
    error_count: job.errors.length,
    current_control_number: job.current_control_number,
    current_form_id: job.current_form_id,
    errors: job.errors,
    started_at: job.started_at,
    finished_at: job.finished_at || null,
    message: job.message || null,
  };
}

function getActiveJobForCoordinator(coordinatorEmail) {
  const jobId = activeJobByCoordinator.get(coordinatorEmail);
  if (!jobId) return null;
  const job = designGapJobs.get(jobId);
  if (!job) {
    activeJobByCoordinator.delete(coordinatorEmail);
    return null;
  }
  if (job.status === 'running' || job.status === 'pending') {
    return job;
  }
  return null;
}

async function processDesignGapJob(job) {
  job.status = 'running';
  job.started_at = new Date().toISOString();

  for (const form of job.to_process) {
    if (job.status === 'cancelled') break;
    job.current_form_id = form.form_id;
    job.current_control_number = form.control_number || null;
    try {
      const payload = await loadControlPayloadForDesignGap(
        job.company_identifier,
        form.form_id,
        job.coordinator_email
      );
      if (!payload) {
        job.errors.push({
          form_id: form.form_id,
          control_number: form.control_number,
          error: 'Control not accessible',
        });
        job.processed += 1;
        continue;
      }
      const analysis = await analyzeDesignGapControl(payload, { dryRun: false });
      await upsertDesignGapInsight(analysis);
      job.processed += 1;
    } catch (error) {
      console.error('Design gap job error for', form.form_id, error);
      job.errors.push({
        form_id: form.form_id,
        control_number: form.control_number,
        error: error.message || 'Generate failed',
        code: error.code || null,
      });
      job.processed += 1;
    }
  }

  job.current_form_id = null;
  job.current_control_number = null;
  job.finished_at = new Date().toISOString();
  if (job.status !== 'cancelled') {
    job.status = job.errors.length > 0 && job.processed === job.errors.length ? 'failed' : 'completed';
    job.message =
      job.status === 'completed'
        ? `Generated ${job.processed - job.errors.length} of ${job.total}. Skipped existing: ${job.skipped_existing}. Errors: ${job.errors.length}.`
        : 'Design-gap job failed';
  }
  if (activeJobByCoordinator.get(job.coordinator_email) === job.job_id) {
    activeJobByCoordinator.delete(job.coordinator_email);
  }
}

function normalizeMultiValue(value) {
  const values = Array.isArray(value) ? value : value != null ? [value] : [];
  return [...new Set(values.map((entry) => String(entry || '').trim()).filter(Boolean))];
}

async function getCoordinatorMappedUnits(companyIdentifier, coordinatorEmail) {
  if (!companyIdentifier || !coordinatorEmail) return [];
  const result = await pool.query(
    `
      SELECT DISTINCT
        NULLIF(TRIM(cum.unit_id), '') AS unit_id,
        NULLIF(TRIM(cum.unit_name), '') AS unit_name
      FROM company_unit_master cum
      INNER JOIN coordinator_unit_assignments cua
        ON cua.company_identifier = cum.company_identifier
       AND cua.unit_id = cum.unit_id
      WHERE cum.company_identifier = $1
        AND LOWER(TRIM(cua.coordinator_email_id)) = $2
        AND NULLIF(TRIM(cum.unit_id), '') IS NOT NULL
      ORDER BY unit_name ASC, unit_id ASC
    `,
    [companyIdentifier, coordinatorEmail]
  );
  return result.rows;
}

function shapeInsightRow(row) {
  if (!row) return null;
  return {
    form_id: row.formId || row.form_id,
    company_identifier: row.companyIdentifier || row.company_identifier,
    unit_id: row.unitId || row.unit_id,
    business_process: row.businessProcess || row.business_process,
    financial_year: row.financialYear || row.financial_year,
    control_number: row.controlNumber || row.control_number,
    control_design_status: row.controlDesignStatus || row.control_design_status,
    summary: row.summary,
    results: row.resultsJson || row.results_json || [],
    ai_response_json: row.aiResponseJson || row.ai_response_json || null,
    model_name: row.modelName || row.model_name,
    prompt_tokens: row.promptTokens ?? row.prompt_tokens ?? null,
    completion_tokens: row.completionTokens ?? row.completion_tokens ?? null,
    total_tokens: row.totalTokens ?? row.total_tokens ?? null,
    run_at: row.runAt || row.run_at,
    updated_at: row.updatedAt || row.updated_at,
  };
}

async function fetchAssertionFields(formId) {
  const result = await pool.query(
    `
      SELECT
        rtf.field_key,
        rtf.label,
        rfv.value_text
      FROM racm_field_values rfv
      JOIN racm_template_fields rtf ON rtf.id = rfv.template_field_id
      WHERE rfv.form_id = $1
        AND rtf.section_key = 'assertions'
      ORDER BY rtf.display_order ASC, rtf.field_key ASC
    `,
    [formId]
  );
  return result.rows.map((row) => ({
    field_key: row.field_key || '',
    label: String(row.label || row.field_key || '').trim(),
    value: row.value_text || '',
  }));
}

async function loadControlPayloadForDesignGap(companyIdentifier, formId, coordinatorEmail) {
  const result = await pool.query(
    `
      SELECT
        cf.form_id,
        cf.control_number,
        cf.company_identifier,
        cf.unit_id,
        cf.business_process,
        cf.financial_year,
        cf.area,
        cf.sub_process,
        cf.risk_description,
        cf.risk_heat,
        cf.control_objective,
        cf.standard_control_description,
        cf.nature_of_control,
        cf.control_type_ma,
        cf.control_type_fo,
        cf.key_control,
        cf.whether_fraud_risks_exist,
        cf.application_name,
        cf.ipe_reference,
        cf.process_walkthrough
      FROM control_forms cf
      WHERE cf.company_identifier = $1
        AND cf.form_id = $2
        AND EXISTS (
          SELECT 1
          FROM coordinator_unit_assignments cua
          WHERE cua.company_identifier = cf.company_identifier
            AND cua.unit_id = cf.unit_id
            AND LOWER(TRIM(cua.coordinator_email_id)) = $3
        )
    `,
    [companyIdentifier, formId, coordinatorEmail]
  );
  const row = result.rows[0];
  if (!row) return null;
  const assertion_fields = await fetchAssertionFields(row.form_id);
  return {
    form_id: row.form_id,
    control_number: row.control_number,
    company_identifier: row.company_identifier,
    unit_id: row.unit_id,
    business_process: row.business_process,
    financial_year: row.financial_year,
    area: row.area,
    sub_process: row.sub_process,
    risk_description: row.risk_description,
    risk_heat: row.risk_heat,
    control_objective: row.control_objective,
    standard_control_description: row.standard_control_description,
    nature_of_control: row.nature_of_control,
    control_type_ma: row.control_type_ma,
    control_type_fo: row.control_type_fo,
    key_control: row.key_control,
    whether_fraud_risks_exist: row.whether_fraud_risks_exist,
    application_name: row.application_name,
    ipe_reference: row.ipe_reference,
    process_walkthrough: row.process_walkthrough,
    assertion_fields,
  };
}

async function upsertDesignGapInsight(analysis) {
  const runAt = new Date();
  const usage = analysis.usage || {};
  return prisma.designGapInsight.upsert({
    where: { formId: String(analysis.form_id) },
    create: {
      formId: String(analysis.form_id),
      companyIdentifier: String(analysis.company_identifier || ''),
      unitId: analysis.unit_id || null,
      businessProcess: analysis.business_process || null,
      financialYear: analysis.financial_year || null,
      controlNumber: analysis.control_number || null,
      controlDesignStatus: String(analysis.control_design_status || 'insufficient_data'),
      summary: String(analysis.summary || ''),
      resultsJson: analysis.results || [],
      aiResponseJson: analysis.ai_response_json || null,
      modelName: analysis.model_name || usage.model || null,
      promptTokens: usage.prompt_tokens ?? null,
      completionTokens: usage.completion_tokens ?? null,
      totalTokens: usage.total_tokens ?? null,
      runAt,
    },
    update: {
      companyIdentifier: String(analysis.company_identifier || ''),
      unitId: analysis.unit_id || null,
      businessProcess: analysis.business_process || null,
      financialYear: analysis.financial_year || null,
      controlNumber: analysis.control_number || null,
      controlDesignStatus: String(analysis.control_design_status || 'insufficient_data'),
      summary: String(analysis.summary || ''),
      resultsJson: analysis.results || [],
      aiResponseJson: analysis.ai_response_json || null,
      modelName: analysis.model_name || usage.model || null,
      promptTokens: usage.prompt_tokens ?? null,
      completionTokens: usage.completion_tokens ?? null,
      totalTokens: usage.total_tokens ?? null,
      runAt,
    },
  });
}

async function getDesignGapAvailability(req, res) {
  try {
    const reachable = await checkAiSummaryHealth();
    const { baseUrl } = getAiSummaryConfig();
    return res.status(200).json({
      success: true,
      data: {
        reachable,
        base_url: baseUrl,
        configured: Boolean(getAiSummaryConfig().apiKey),
      },
    });
  } catch (error) {
    console.error('Design gap availability error:', error);
    return res.status(200).json({
      success: true,
      data: { reachable: false, configured: false },
    });
  }
}

async function listDesignGapControls(req, res) {
  try {
    const companyIdentifier = String(req.user?.company_identifier || '').trim();
    const coordinatorEmail = normalizeEmail(req.user?.email_id);
    if (!companyIdentifier || !coordinatorEmail) {
      return res.status(403).json({
        success: false,
        message: 'Company coordinator context is required',
      });
    }

    const mappedUnits = await getCoordinatorMappedUnits(companyIdentifier, coordinatorEmail);
    const mappedUnitIds = mappedUnits.map((row) => String(row?.unit_id || '').trim()).filter(Boolean);
    if (mappedUnitIds.length === 0) {
      return res.status(200).json({
        success: true,
        data: [],
        count: 0,
        filters: { units: [], business_processes: [], financial_years: [] },
      });
    }

    const page = Math.max(Number.parseInt(req.query?.page, 10) || 1, 1);
    const pageSize = Math.min(Math.max(Number.parseInt(req.query?.page_size, 10) || 10, 1), 100);
    const offset = (page - 1) * pageSize;

    const requestedUnitIds = normalizeMultiValue(req.query?.unit_ids);
    const requestedBusinessProcesses = normalizeMultiValue(req.query?.business_processes);
    const requestedFinancialYears = normalizeMultiValue(req.query?.financial_years);

    const allowedUnitIds = new Set(mappedUnitIds.map((unitId) => unitId.toLowerCase()));
    const filteredUnitIds = requestedUnitIds.filter((unitId) =>
      allowedUnitIds.has(unitId.toLowerCase())
    );

    const params = [companyIdentifier, mappedUnitIds];
    const conditions = [
      'cf.company_identifier = $1',
      "NULLIF(TRIM(cf.unit_id), '') IS NOT NULL",
      'cf.unit_id = ANY($2::text[])',
    ];
    let paramIndex = params.length + 1;

    if (filteredUnitIds.length > 0) {
      conditions.push(`cf.unit_id = ANY($${paramIndex}::text[])`);
      params.push(filteredUnitIds);
      paramIndex += 1;
    }
    if (requestedBusinessProcesses.length > 0) {
      conditions.push(
        `LOWER(TRIM(COALESCE(cf.business_process, ''))) = ANY($${paramIndex}::text[])`
      );
      params.push(requestedBusinessProcesses.map((value) => value.toLowerCase()));
      paramIndex += 1;
    }
    if (requestedFinancialYears.length > 0) {
      conditions.push(`TRIM(COALESCE(cf.financial_year, '')) = ANY($${paramIndex}::text[])`);
      params.push(requestedFinancialYears);
      paramIndex += 1;
    }

    const whereClause = conditions.join('\n        AND ');

    const countResult = await pool.query(
      `SELECT COUNT(*)::int AS total_count FROM control_forms cf WHERE ${whereClause}`,
      params
    );

    const dataParams = [...params, pageSize, offset];
    const rowsResult = await pool.query(
      `
        SELECT
          cf.form_id,
          cf.company_identifier,
          cf.unit_id,
          cum.unit_name,
          cf.control_number,
          cf.business_process,
          cf.sub_process,
          cf.financial_year,
          cf.risk_description,
          dgi.control_design_status,
          dgi.run_at AS design_gap_run_at,
          CASE WHEN dgi.form_id IS NULL THEN false ELSE true END AS has_design_gap_insight
        FROM control_forms cf
        LEFT JOIN company_unit_master cum
          ON cum.company_identifier = cf.company_identifier
         AND cum.unit_id = cf.unit_id
        LEFT JOIN design_gap_insights dgi
          ON dgi.form_id = cf.form_id
        WHERE ${whereClause}
        ORDER BY
          LOWER(TRIM(COALESCE(cf.control_number, ''))) ASC,
          LOWER(TRIM(COALESCE(cum.unit_name, ''))) ASC
        LIMIT $${dataParams.length - 1}
        OFFSET $${dataParams.length}
      `,
      dataParams
    );

    const filterRowsResult = await pool.query(
      `
        SELECT DISTINCT
          cf.unit_id,
          cum.unit_name,
          NULLIF(TRIM(cf.business_process), '') AS business_process,
          NULLIF(TRIM(cf.financial_year), '') AS financial_year
        FROM control_forms cf
        LEFT JOIN company_unit_master cum
          ON cum.company_identifier = cf.company_identifier
         AND cum.unit_id = cf.unit_id
        WHERE cf.company_identifier = $1
          AND NULLIF(TRIM(cf.unit_id), '') IS NOT NULL
          AND cf.unit_id = ANY($2::text[])
      `,
      [companyIdentifier, mappedUnitIds]
    );

    const businessProcesses = [
      ...new Set(
        filterRowsResult.rows
          .map((row) => String(row.business_process || '').trim())
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));

    const financialYears = [
      ...new Set(
        filterRowsResult.rows
          .map((row) => String(row.financial_year || '').trim())
          .filter(Boolean)
      ),
    ].sort((a, b) => a.localeCompare(b));

    return res.status(200).json({
      success: true,
      data: rowsResult.rows,
      count: Number(countResult.rows[0]?.total_count || 0),
      filters: {
        units: mappedUnits,
        business_processes: businessProcesses,
        financial_years: financialYears,
      },
    });
  } catch (error) {
    console.error('List design gap controls error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to fetch design-gap controls',
    });
  }
}

async function getDesignGapReportScope(req, res) {
  try {
    const companyIdentifier = String(req.user?.company_identifier || '').trim();
    const coordinatorEmail = normalizeEmail(req.user?.email_id);
    const unitId = String(req.query?.unit_id || '').trim();
    const businessProcess = String(req.query?.business_process || '').trim();
    const financialYear = String(req.query?.financial_year || '').trim();

    if (!companyIdentifier || !coordinatorEmail) {
      return res.status(403).json({
        success: false,
        message: 'Company coordinator context is required',
      });
    }
    if (!unitId || !businessProcess || !financialYear) {
      return res.status(400).json({
        success: false,
        message: 'unit_id, business_process, and financial_year are required',
      });
    }

    const mappedUnits = await getCoordinatorMappedUnits(companyIdentifier, coordinatorEmail);
    const allowed = mappedUnits.some(
      (u) => String(u.unit_id || '').trim().toLowerCase() === unitId.toLowerCase()
    );
    if (!allowed) {
      return res.status(403).json({
        success: false,
        message: 'You can only view design-gap reports for your assigned units',
        code: 'UNIT_NOT_ALLOWED',
      });
    }

    const totals = await pool.query(
      `
        SELECT
          COUNT(*)::int AS total_racms,
          COUNT(dgi.form_id)::int AS with_insight
        FROM control_forms cf
        LEFT JOIN design_gap_insights dgi ON dgi.form_id = cf.form_id
        WHERE cf.company_identifier = $1
          AND cf.unit_id = $2
          AND LOWER(TRIM(COALESCE(cf.business_process, ''))) = LOWER($3)
          AND TRIM(COALESCE(cf.financial_year, '')) = $4
      `,
      [companyIdentifier, unitId, businessProcess, financialYear]
    );

    const totalRacms = Number(totals.rows[0]?.total_racms || 0);
    const withInsight = Number(totals.rows[0]?.with_insight || 0);

    return res.status(200).json({
      success: true,
      data: {
        unit_id: unitId,
        business_process: businessProcess,
        financial_year: financialYear,
        total_racms: totalRacms,
        with_insight: withInsight,
        missing_insight: Math.max(totalRacms - withInsight, 0),
        all_generated: totalRacms > 0 && withInsight === totalRacms,
      },
    });
  } catch (error) {
    console.error('Design gap report scope error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load design-gap report scope',
    });
  }
}

async function getDesignGapReport(req, res) {
  try {
    const companyIdentifier = String(req.user?.company_identifier || '').trim();
    const coordinatorEmail = normalizeEmail(req.user?.email_id);
    const unitId = String(req.query?.unit_id || '').trim();
    const businessProcess = String(req.query?.business_process || '').trim();
    const financialYear = String(req.query?.financial_year || '').trim();

    if (!companyIdentifier || !coordinatorEmail) {
      return res.status(403).json({
        success: false,
        message: 'Company coordinator context is required',
      });
    }
    if (!unitId || !businessProcess || !financialYear) {
      return res.status(400).json({
        success: false,
        message: 'unit_id, business_process, and financial_year are required',
      });
    }

    const mappedUnits = await getCoordinatorMappedUnits(companyIdentifier, coordinatorEmail);
    const unitMeta = mappedUnits.find(
      (u) => String(u.unit_id || '').trim().toLowerCase() === unitId.toLowerCase()
    );
    if (!unitMeta) {
      return res.status(403).json({
        success: false,
        message: 'You can only view design-gap reports for your assigned units',
        code: 'UNIT_NOT_ALLOWED',
      });
    }

    const insights = await prisma.designGapInsight.findMany({
      where: {
        companyIdentifier,
        unitId,
        businessProcess,
        financialYear,
      },
      orderBy: { controlNumber: 'asc' },
    });

    const shaped = insights.map(shapeInsightRow);
    const statusCounts = {};
    const checkStatusCounts = {};
    let promptTokens = 0;
    let completionTokens = 0;
    let totalTokens = 0;

    for (const row of shaped) {
      const status = row.control_design_status || 'unknown';
      statusCounts[status] = (statusCounts[status] || 0) + 1;
      promptTokens += Number(row.prompt_tokens || 0);
      completionTokens += Number(row.completion_tokens || 0);
      totalTokens += Number(row.total_tokens || 0);
      for (const check of row.results || []) {
        const cs = check.status || 'unknown';
        checkStatusCounts[cs] = (checkStatusCounts[cs] || 0) + 1;
      }
    }

    return res.status(200).json({
      success: true,
      data: {
        meta: {
          unit_id: unitId,
          unit_name: unitMeta.unit_name || unitId,
          business_process: businessProcess,
          financial_year: financialYear,
          company_identifier: companyIdentifier,
          generated_from_db: true,
        },
        summary: {
          controls_reviewed: shaped.length,
          control_design_status_counts: statusCounts,
          status_counts: checkStatusCounts,
          token_usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            total_tokens: totalTokens,
          },
        },
        controls: shaped,
      },
    });
  } catch (error) {
    console.error('Design gap report error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load design-gap report',
    });
  }
}

async function generateDesignGapInsights(req, res) {
  try {
    const companyIdentifier = String(req.user?.company_identifier || '').trim();
    const coordinatorEmail = normalizeEmail(req.user?.email_id);
    const formIds = normalizeMultiValue(req.body?.form_ids);
    const regenerateExisting = Boolean(req.body?.regenerate_existing);

    if (!companyIdentifier || !coordinatorEmail) {
      return res.status(403).json({
        success: false,
        message: 'Company coordinator context is required',
      });
    }
    if (formIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'form_ids is required',
      });
    }

    const active = getActiveJobForCoordinator(coordinatorEmail);
    if (active) {
      return res.status(409).json({
        success: false,
        message: 'Previous job is running',
        code: 'JOB_IN_PROGRESS',
        data: shapeJob(active),
      });
    }

    const mappedUnits = await getCoordinatorMappedUnits(companyIdentifier, coordinatorEmail);
    const allowedUnitIds = new Set(
      mappedUnits.map((u) => String(u.unit_id || '').trim().toLowerCase()).filter(Boolean)
    );

    const formsResult = await pool.query(
      `
        SELECT form_id, unit_id, control_number
        FROM control_forms
        WHERE company_identifier = $1
          AND form_id = ANY($2::text[])
      `,
      [companyIdentifier, formIds]
    );

    if (formsResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'No matching controls found',
      });
    }

    const unitIds = [
      ...new Set(formsResult.rows.map((r) => String(r.unit_id || '').trim()).filter(Boolean)),
    ];
    if (unitIds.length !== 1) {
      return res.status(400).json({
        success: false,
        message: 'Select controls from a single unit only. Design-gap generation cannot mix units.',
        code: 'MIXED_UNITS',
      });
    }
    if (!allowedUnitIds.has(unitIds[0].toLowerCase())) {
      return res.status(403).json({
        success: false,
        message: 'You can only generate design-gap insights for your assigned units',
        code: 'UNIT_NOT_ALLOWED',
      });
    }

    const existing = await prisma.designGapInsight.findMany({
      where: { formId: { in: formIds } },
      select: { formId: true },
    });
    const existingSet = new Set(existing.map((e) => e.formId));

    const toProcess = regenerateExisting
      ? formsResult.rows
      : formsResult.rows.filter((r) => !existingSet.has(r.form_id));

    const skippedExisting = formsResult.rows.filter(
      (r) => existingSet.has(r.form_id) && !regenerateExisting
    ).length;

    if (toProcess.length === 0) {
      return res.status(200).json({
        success: true,
        data: {
          job_id: null,
          status: 'completed',
          unit_id: unitIds[0],
          total: 0,
          processed: 0,
          skipped_existing: skippedExisting,
          error_count: 0,
          message: 'Nothing to generate — all selected controls already have insights.',
        },
      });
    }

    const jobId = crypto.randomUUID();
    const job = {
      job_id: jobId,
      company_identifier: companyIdentifier,
      coordinator_email: coordinatorEmail,
      unit_id: unitIds[0],
      status: 'pending',
      total: toProcess.length,
      processed: 0,
      skipped_existing: skippedExisting,
      current_control_number: null,
      current_form_id: null,
      errors: [],
      to_process: toProcess,
      started_at: null,
      finished_at: null,
      message: null,
    };

    designGapJobs.set(jobId, job);
    activeJobByCoordinator.set(coordinatorEmail, jobId);

    setImmediate(() => {
      processDesignGapJob(job).catch((error) => {
        console.error('Design gap job crashed', jobId, error);
        job.status = 'failed';
        job.message = error.message || 'Job crashed';
        job.finished_at = new Date().toISOString();
        if (activeJobByCoordinator.get(coordinatorEmail) === jobId) {
          activeJobByCoordinator.delete(coordinatorEmail);
        }
      });
    });

    return res.status(202).json({
      success: true,
      data: shapeJob(job),
    });
  } catch (error) {
    console.error('Generate design gap insights error:', error);
    const status = error.statusCode || 500;
    return res.status(status).json({
      success: false,
      message: error.message || 'Failed to generate design-gap insights',
      code: error.code || 'GENERATE_FAILED',
    });
  }
}

async function getDesignGapJob(req, res) {
  try {
    const coordinatorEmail = normalizeEmail(req.user?.email_id);
    const jobId = String(req.params?.job_id || '').trim();
    if (!coordinatorEmail) {
      return res.status(403).json({
        success: false,
        message: 'Company coordinator context is required',
      });
    }
    const job = designGapJobs.get(jobId);
    if (!job || job.coordinator_email !== coordinatorEmail) {
      return res.status(404).json({
        success: false,
        message: 'Job not found',
      });
    }
    return res.status(200).json({
      success: true,
      data: shapeJob(job),
    });
  } catch (error) {
    console.error('Get design gap job error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load job status',
    });
  }
}

async function getActiveDesignGapJob(req, res) {
  try {
    const coordinatorEmail = normalizeEmail(req.user?.email_id);
    if (!coordinatorEmail) {
      return res.status(403).json({
        success: false,
        message: 'Company coordinator context is required',
      });
    }
    const job = getActiveJobForCoordinator(coordinatorEmail);
    return res.status(200).json({
      success: true,
      data: job ? shapeJob(job) : null,
    });
  } catch (error) {
    console.error('Get active design gap job error:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to load active job',
    });
  }
}

module.exports = {
  getDesignGapAvailability,
  listDesignGapControls,
  getDesignGapReportScope,
  getDesignGapReport,
  generateDesignGapInsights,
  getDesignGapJob,
  getActiveDesignGapJob,
};
