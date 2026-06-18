Your current design is a wide-table RACM model: [backend/prisma/schema.prisma](/abs/path/c:/Divyesh/IFC/IFC_Prisma/backend/prisma/schema.prisma:91) has many fixed columns in `ControlForm`. That works only while every company shares nearly the same schema.

For your requirement, the scalable way is:

**Use a hybrid model**
- Keep truly global columns as real DB columns in `control_forms`.
- Move company-specific columns into metadata-driven tables.

**Keep as fixed columns**
These are stable and used everywhere:
- `form_id`
- `company_identifier`
- `unit_id`
- `control_number`
- `business_process`
- `sub_process`
- `standard_control_description`
- `risk_description`
- `control_frequency`
- `financial_year`
- status / approval / reminders / audit linkage

These should remain first-class columns because they are:
- filtered often
- shown in dashboards
- used in reminders, risk analysis, approvals, exports

**Make dynamic fields metadata-driven**
Add 3 new tables:

1. `racm_templates`
- one template per company
- all RACMs in a company point to the same template version
- fields:
  - `id`
  - `company_identifier`
  - `template_name`
  - `version`
  - `is_active`

2. `racm_template_fields`
- defines the company’s extra columns
- fields:
  - `id`
  - `template_id`
  - `field_key`
  - `label`
  - `data_type` (`text`, `long_text`, `boolean`, `date`, `number`, `select`, `multi_select`)
  - `is_required`
  - `default_value`
  - `display_order`
  - `section_name`
  - `options_json`
  - `validation_json`
  - `show_in_list`
  - `show_in_detail`

3. `racm_field_values`
- stores per-RACM values
- fields:
  - `id`
  - `form_id`
  - `template_field_id`
  - `value_text`
  - `value_number`
  - `value_boolean`
  - `value_date`
  - `value_json`

Use one row per `(form_id, template_field_id)`.

That is the cleanest long-term model.

**Why this is better than storing all extras in one JSONB column**
A single JSONB column is fast to build, but weaker for:
- validations
- field-level permissions
- ordered form rendering
- Excel mapping
- clean audit trails
- future search/filter/reporting

JSONB is still useful, but as support data:
- `options_json`
- `validation_json`
- maybe cached snapshots

**Recommended architecture**
- `control_forms` = fixed/core RACM fields
- `racm_templates` + `racm_template_fields` = company schema
- `racm_field_values` = company-specific values

That gives:
- 20 fields for one company
- 40 fields for another
- same app code path
- same database structure

**How rendering should work**
Frontend should not hardcode all RACM fields.
Instead:
- fetch fixed field config
- fetch company template field definitions
- merge them into a render schema
- render controls based on `data_type`

So the UI becomes metadata-driven.

**How import/export should work**
Excel import should:
- map fixed columns to `control_forms`
- map company-specific columns using `field_key` from `racm_template_fields`

Excel export should do the reverse.

This is much better than changing schema every time a company wants 3 new columns.

**How filtering/reporting should work**
For list pages:
- use fixed columns for major filters
- if you need filtering on dynamic fields, join `racm_field_values`

If some dynamic fields become heavily used across all companies later, promote them to fixed columns.

**Avoid EAV becoming messy**
`racm_field_values` is effectively controlled EAV. It becomes bad only if unmanaged.
Keep it disciplined:
- strong field definitions
- typed value columns
- unique `(form_id, template_field_id)`
- app-level validation before save
- no arbitrary field creation by end users without admin flow

**Versioning**
Templates must be versioned.
If company structure changes later:
- create template version 2
- keep old RACMs on version 1
- new RACMs use version 2

Do not mutate old definitions in place if historical RACMs must still render correctly.

**Migration path from your current system**
1. Keep current `control_forms` unchanged.
2. Add template + dynamic field tables.
3. Move only non-global fields to dynamic definitions first.
4. Update form create/edit/detail APIs to return:
   - fixed fields
   - dynamic field definitions
   - dynamic values
5. Update frontend forms to render from metadata.
6. Later, remove old hardcoded optional fields only if needed.

**Practical rule for deciding fixed vs dynamic**
Make a field fixed if:
- it is used in joins, reminders, analytics, approvals, AI, or dashboards
- nearly every company has it
- it needs indexing

Make a field dynamic if:
- it varies by company
- mostly used in form entry/detail/export
- not critical to core workflow logic

**Do not do**
- separate RACM table per company
- schema migration for every company change
- hundreds of nullable columns in `control_forms`

Those will become difficult to maintain quickly.

**Best fit for your project**
For this codebase, hybrid metadata-driven RACM is the right answer.

If you want, I can design the exact Prisma schema changes for:
- `RacmTemplate`
- `RacmTemplateField`
- `RacmFieldValue`
and show how your existing `control_forms` APIs should evolve with minimal breakage.
