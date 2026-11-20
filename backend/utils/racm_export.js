const RACM_EXPORT_COLUMNS = [
  ['company_name', 'Company Name', 'c.company_name'],
  ['unit_name', 'Unit Name', "NULLIF(TRIM(cum.unit_name), '')"],
  ['business_process', 'Business Process', 'cf.business_process'],
  ['financial_year', 'Financial Year', 'cf.financial_year'],
  ['control_number', 'Control Number', 'cf.control_number'],
  ['area', 'Area', 'cf.area'],
  ['risk_heat', 'Risk Heat', 'cf.risk_heat'],
  ['sub_process', 'Sub Process', 'cf.sub_process'],
  ['risk_description', 'Risk Description', 'cf.risk_description'],
  ['whether_fraud_risks_exist', 'Whether Fraud Risks Exist', 'cf.whether_fraud_risks_exist'],
  ['control_objective', 'Control Objective', 'cf.control_objective'],
  ['standard_control_description', 'Standard Control Description', 'cf.standard_control_description'],
  ['process_walkthrough', 'Process Activity and Walkthrough Details', 'cf.process_walkthrough'],
  ['control_type_fo', 'Type of Control (Operational/Financial)', 'cf.control_type_fo'],
  ['control_relies_on_ipe', 'Does the Control Rely on IPE?', 'cf.control_relies_on_ipe'],
  ['ipe_reference', 'IPE Reference', 'cf.ipe_reference'],
  ['audit_evidence_accuracy', 'Audit Evidence Accuracy and Completeness', 'cf.audit_evidence_accuracy'],
  ['nature_of_control', 'Nature of Control', 'cf.nature_of_control'],
  ['control_type_ma', 'Type of Control (Manual/Automated)', 'cf.control_type_ma'],
  ['key_control', 'Key Control', 'cf.key_control'],
  ['application_name', 'Application Name', 'cf.application_name'],
  ['control_frequency', 'Control Frequency', 'cf.control_frequency'],
  ['sample_size', 'Sample Size', 'cf.sample_size'],
  ['sample_required', 'Sample Required', 'cf.sample_required'],
  ['control_performer', 'Control Performer', 'cf.control_performer'],
  ['control_owner', 'Process Owner', 'cf.control_owner'],
  ['status', 'Approval Status', 'cf.status'],
  ['control_design_procs', 'Procedures to Evaluate Design and Implementation', 'cf.control_design_procs'],
  ['control_design_conclusion', 'Conclusion on Design of Control', 'cf.control_design_conclusion'],
  ['design_deficiency_desc', 'Description of Deficiency in Control Design', 'cf.design_deficiency_desc'],
].map(([key, label, expression]) => ({ key, label, expression }));

async function getRacmExportData(client, {
  joinsSql = '',
  whereSql,
  queryParams = [],
  includeAll = false,
}) {
  const statusFilter = includeAll
    ? ''
    : `AND LOWER(TRIM(COALESCE(cf.status, ''))) = 'approved'`;
  const selectedFields = RACM_EXPORT_COLUMNS
    .map(({ key, expression }) => `${expression} AS ${key}`)
    .join(',\n        ');
  const result = await client.query(
    `
      SELECT
        cf.form_id AS _form_id,
        cf.template_id AS _template_id,
        cf.company_identifier AS _company_identifier,
        cf.unit_id AS _unit_id,
        ${selectedFields}
      FROM control_forms cf
      LEFT JOIN companies c
        ON c.company_identifier = cf.company_identifier
      LEFT JOIN company_unit_master cum
        ON cum.company_identifier = cf.company_identifier
       AND cum.unit_id = cf.unit_id
      ${joinsSql}
      WHERE ${whereSql}
        ${statusFilter}
      ORDER BY cf.company_identifier, cum.unit_name NULLS LAST, cf.unit_id, cf.control_number, cf.form_id
    `,
    queryParams
  );
  const records = result.rows;
  if (records.length === 0) {
    return {
      records: [],
      columns: RACM_EXPORT_COLUMNS.map(({ key, label }) => ({ key, label })),
      customFields: [],
    };
  }

  const formIds = records.map((record) => record._form_id);
  const fieldsResult = await client.query(
    `
      SELECT DISTINCT
        rtf.id AS field_id,
        rtf.field_key,
        rtf.label,
        rtf.section_key,
        rtf.display_order,
        rt.template_name,
        NULLIF(TRIM(cum.unit_name), '') AS unit_name
      FROM control_forms cf
      INNER JOIN racm_template_fields rtf
        ON rtf.template_id = cf.template_id
       AND rtf.is_fixed = FALSE
      LEFT JOIN racm_templates rt
        ON rt.id = cf.template_id
      LEFT JOIN company_unit_master cum
        ON cum.company_identifier = cf.company_identifier
       AND cum.unit_id = cf.unit_id
      WHERE cf.form_id = ANY($1::text[])
      ORDER BY rtf.section_key, rtf.display_order, rtf.id,
        rt.template_name, unit_name
    `,
    [formIds]
  );
  const customFields = fieldsResult.rows;
  const valuesResult = await client.query(
    `
      SELECT form_id, template_field_id AS field_id, value_text
      FROM racm_field_values
      WHERE form_id = ANY($1::text[])
    `,
    [formIds]
  );
  const valuesByForm = new Map();
  for (const value of valuesResult.rows) {
    const formValues = valuesByForm.get(value.form_id) || {};
    formValues[String(value.field_id)] = value.value_text ?? '';
    valuesByForm.set(value.form_id, formValues);
  }

  return {
    records: records.map((record) => {
      const exportedRecord = Object.fromEntries(
        RACM_EXPORT_COLUMNS.map(({ key }) => [key, record[key] ?? ''])
      );
      return {
        ...exportedRecord,
        custom_values: valuesByForm.get(record._form_id) || {},
      };
    }),
    columns: RACM_EXPORT_COLUMNS.map(({ key, label }) => ({ key, label })),
    customFields: customFields.map((field) => ({
      field_id: field.field_id,
      field_key: field.field_key,
      label: field.label,
      template_name: field.template_name,
      unit_name: field.unit_name,
    })),
  };
}

module.exports = { getRacmExportData, RACM_EXPORT_COLUMNS };
