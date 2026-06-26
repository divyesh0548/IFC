-- Manual DDL for dynamic RACM templates (run directly on PostgreSQL).
-- Do NOT use prisma migrate for this step per project convention.

ALTER TABLE control_forms
  ADD COLUMN IF NOT EXISTS template_id INTEGER;

CREATE TABLE IF NOT EXISTS racm_templates (
  id SERIAL PRIMARY KEY,
  company_identifier VARCHAR(255) NOT NULL,
  unit_id VARCHAR(255) NOT NULL,
  template_name VARCHAR(255) NOT NULL,
  version INTEGER NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active',
  is_default BOOLEAN NOT NULL DEFAULT FALSE,
  copied_from_template_id INTEGER,
  linked_racm_count INTEGER NOT NULL DEFAULT 0,
  created_by VARCHAR(255),
  created_at TIMESTAMP(6) DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT racm_templates_company_fk
    FOREIGN KEY (company_identifier) REFERENCES companies(company_identifier)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT racm_templates_unit_fk
    FOREIGN KEY (company_identifier, unit_id)
    REFERENCES company_unit_master(company_identifier, unit_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT racm_templates_copy_fk
    FOREIGN KEY (copied_from_template_id) REFERENCES racm_templates(id)
    ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT racm_templates_unique_version
    UNIQUE (company_identifier, unit_id, template_name, version)
);

CREATE UNIQUE INDEX IF NOT EXISTS racm_templates_one_active_per_unit
  ON racm_templates (company_identifier, unit_id)
  WHERE status = 'active';

CREATE INDEX IF NOT EXISTS racm_templates_company_unit_status_idx
  ON racm_templates (company_identifier, unit_id, status);

ALTER TABLE control_forms
  ADD CONSTRAINT control_forms_template_fk
  FOREIGN KEY (template_id) REFERENCES racm_templates(id)
  ON DELETE SET NULL ON UPDATE CASCADE;

CREATE TABLE IF NOT EXISTS racm_template_fields (
  id SERIAL PRIMARY KEY,
  template_id INTEGER NOT NULL,
  field_key VARCHAR(100) NOT NULL,
  label VARCHAR(500) NOT NULL,
  section_key VARCHAR(50) NOT NULL,
  is_fixed BOOLEAN NOT NULL DEFAULT FALSE,
  is_locked BOOLEAN NOT NULL DEFAULT FALSE,
  display_order INTEGER NOT NULL DEFAULT 0,
  excel_keywords JSONB,
  CONSTRAINT racm_template_fields_template_fk
    FOREIGN KEY (template_id) REFERENCES racm_templates(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT racm_template_fields_unique_key
    UNIQUE (template_id, field_key)
);

CREATE INDEX IF NOT EXISTS racm_template_fields_template_section_idx
  ON racm_template_fields (template_id, section_key, display_order);

CREATE TABLE IF NOT EXISTS racm_field_values (
  id SERIAL PRIMARY KEY,
  form_id VARCHAR(255) NOT NULL,
  template_field_id INTEGER NOT NULL,
  value_text TEXT,
  CONSTRAINT racm_field_values_form_fk
    FOREIGN KEY (form_id) REFERENCES control_forms(form_id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT racm_field_values_field_fk
    FOREIGN KEY (template_field_id) REFERENCES racm_template_fields(id)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT racm_field_values_unique
    UNIQUE (form_id, template_field_id)
);

CREATE INDEX IF NOT EXISTS racm_field_values_form_idx
  ON racm_field_values (form_id);

-- Dev cleanup (optional): remove legacy assertion boolean columns from control_forms
-- ALTER TABLE control_forms DROP COLUMN IF EXISTS completeness;
-- ALTER TABLE control_forms DROP COLUMN IF EXISTS existence_occurrence;
-- ALTER TABLE control_forms DROP COLUMN IF EXISTS rights_and_obligation;
-- ALTER TABLE control_forms DROP COLUMN IF EXISTS valuation_and_allocation;
-- ALTER TABLE control_forms DROP COLUMN IF EXISTS presentation_and_disclosure;
