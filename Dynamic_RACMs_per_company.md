# Dynamic RACMs per Company / Unit — Implementation Plan

## Goal

Allow each **unit** under a company to define optional **extra text columns**, Excel header keywords, and field layout metadata while keeping **core workflow logic** unchanged. Extra field values are **storage and display only** — they do not drive reminders, approvals, sample sizing, assignments, AI, or dashboards.

Every unit always has a **baseline template** containing the **18 fixed standard fields**. Coordinators may extend it with unit-specific text fields.

---

## Design principles

| Principle | Rule |
|-----------|------|
| Scope | Templates are **per unit**, not per company |
| Baseline | Every unit **always** has a default template with the **18 fixed fields** |
| Fixed fields | Fixed fields are **immutable** in the template — cannot be renamed, reordered, moved, or removed |
| Extra fields | Units may add **text-only** columns beyond the fixed set |
| Extra field type | **Text only** — no select, boolean, date, number, options, or default values |
| Logic boundary | Only **core columns** on `control_forms` participate in business logic |
| Dynamic data | Extra field values are **read / write / export / import only** |
| Keywords | **Optional** — editable anytime on the active template **without** a version change |
| Active template | **Exactly one** active template per unit at any time |
| Versioning | Structural template changes create a **new version**; existing RACMs are unaffected |
| Deletion | Template versions with linked RACMs **cannot** be deleted |
| Copy | Coordinators can **copy a template from another unit** they can access |

---

## Field categories

### 1. Core system fields (always on `control_forms`, used in logic)

These are **not** part of the unit template editor. They are global, indexed, and power workflows.

| Field | Purpose |
|-------|---------|
| `form_id` | Primary RACM identifier |
| `company_identifier` | Tenant |
| `unit_id` | Unit scope |
| `control_number` | Unique control reference |
| `business_process` | Process grouping / dashboards |
| `financial_year` | FY scope |
| `control_frequency` | Sample interval generation |
| `sample_size` | Sample interval generation |
| `sample_required` | Generated sample dates |
| `control_performer` | Assignment / notifications |
| `control_owner` | Assignment / notifications |
| `active`, `status`, approval fields | Workflow |
| `due_date`, `reminder_frequency` | Reminders |
| `deficiency_*` fields | Deficiency workflow |
| Approver-only fields (`control_design_*`, etc.) | Approval workflow |

**Bulk upload:** `business_process` and `financial_year` are **fixed values set on the upload screen**, not mapped from Excel columns.

---

### 2. Fixed template fields (immutable baseline on every unit template)

These **18 fields** are **always present** on every unit template. They map to existing `control_forms` columns. Values are stored on `control_forms`.

**Coordinator cannot:**
- Remove a fixed field
- Rename a fixed field label
- Change a fixed field's section
- Change a fixed field's display order

**Coordinator can:**
- View fixed fields in the template UI (read-only definitions)
- Add optional **Excel keywords** for fixed fields (see Keywords section)

Source: `Dyanmic_RACMs_Map.txt`

| # | Display name (system default, locked) | `field_key` | Default section |
|---|----------------------------------------|-------------|-----------------|
| 1 | Sub-Process | `sub_process` | Process and Risk |
| 2 | Risk Description | `risk_description` | Process and Risk |
| 3 | Risk Heat | `risk_heat` | Process and Risk |
| 4 | Control Objective | `control_objective` | Control Details |
| 5 | Standard Control Description | `standard_control_description` | Control Details |
| 6 | Control type (Manual/Automated) | `control_type_ma` | Control Details |
| 7 | Control type (Financial/Operational) | `control_type_fo` | Control Details |
| 8 | Nature of Control (Preventive/Detective) | `nature_of_control` | Control Details |
| 9 | Process Activity and Walkthrough details | `process_walkthrough` | Control Details |
| 10 | Key Control | `key_control` | Control Details |
| 11 | Application name | `application_name` | Control Details |
| 12 | Completeness | `completeness` | Assertions |
| 13 | Existence & Occurrence | `existence_occurrence` | Assertions |
| 14 | Valuation & Allocation | `valuation_and_allocation` | Assertions |
| 15 | Rights and Obligation | `rights_and_obligation` | Assertions |
| 16 | Presentation and Disclosure | `presentation_and_disclosure` | Assertions |
| 17 | Control Evidence to be obtained | `audit_evidence_accuracy` | Control Details |
| 18 | Whether fraud risk exists? (Yes/No) | `whether_fraud_risks_exist` | Control Details |

Fixed fields retain their **native control types** from `control_forms` at render time (e.g. assertions as checkboxes, dropdowns where applicable). The template does not redefine types for fixed fields.

---

### 3. UI sections

| `section_key` | UI title | Fixed fields (locked placement) |
|---------------|----------|--------------------------------|
| `process_and_risk` | Process and Risk | #1–3 |
| `assertions` | Assertions | #12–16 |
| `control_details` | Control Details | #4–11, #17–18 |
| `others` | Others | Extra fields only (default section for new extras) |

Fixed fields always render in their locked section. Extra fields may be assigned to any section, including **Others**.

---

### 4. Extra fields (unit-specific, text only, storage only)

| Rule | Detail |
|------|--------|
| Data type | **Text only** (`value_text`) |
| Storage | `racm_field_values` — not new `control_forms` columns |
| Default section | `others` |
| Required | Not supported in v1 — extra fields are optional |
| Options / select / default | **Not supported** |
| Logic | Never used in workflow, reminders, approvals, or dashboards |

**Structural properties** (label, section, display order, add, remove) are versioned — see Versioning.

**`field_key` for extras:** slug format, e.g. `regulatory_ref`. Immutable once any RACM has stored a value for that key (see Suggestions).

---

## Excel keywords (optional, version-independent)

Keywords help bulk-upload header auto-mapping. They are **not required**.

### Rules

| Action | Version impact |
|--------|----------------|
| Add / edit / delete keywords | **No version change** |
| Add / remove extra field | **New version** |
| Rename extra field label | **New version** |
| Change extra field section or order | **New version** |

### UI presentation (template settings)

Show keywords in a dedicated, scannable area per field:

- **Fixed fields:** read-only label + optional keyword chips (editable inline)
- **Extra fields:** editable label + section + order + optional keyword chips
- Empty state: *"No keywords — Excel headers won't auto-map to this field"*
- Bulk import still supports **manual column mapping** when keywords are absent

Keywords are stored on `racm_template_fields.excel_keywords` but updated via a **separate API** that patches only the active template's keyword arrays — no version bump.

---

## Data model

### Hybrid model

```
control_forms          → core + fixed field values (existing columns)
racm_templates         → versioned templates per unit (one active)
racm_template_fields   → field definitions (18 locked fixed + optional extras)
racm_field_values      → extra field text values only
```

Fixed field **values** → `control_forms`  
Fixed field **definitions** → seeded on every template version (`is_fixed = true`, locked)  
Extra field **values** → `racm_field_values.value_text` only

---

### Table: `racm_templates`

| Column | Type | Notes |
|--------|------|-------|
| `id` | PK | |
| `company_identifier` | FK | |
| `unit_id` | FK | Template scope |
| `template_name` | string | e.g. `"Default"`, `"FY26 Extended"` |
| `version` | int | Increments within a template lineage |
| `status` | enum | `active` \| `archived` \| `draft` |
| `is_default` | bool | `true` for the system-seeded baseline template |
| `copied_from_template_id` | FK nullable | Audit trail |
| `created_by` | email | |
| `created_at` | timestamp | |

**Constraints:**
- `UNIQUE (company_identifier, unit_id, template_name, version)`
- **Partial unique:** exactly one row with `status = 'active'` per `(company_identifier, unit_id)`

**Rules:**
- Every unit is seeded with `template_name = "Default"`, `version = 1`, `is_default = true`, `status = active`
- New RACMs always use the unit's **active** template and store `control_forms.template_id`
- Existing RACMs keep their original `template_id` forever

---

### Table: `racm_template_fields`

| Column | Type | Notes |
|--------|------|-------|
| `id` | PK | |
| `template_id` | FK | |
| `field_key` | string | Fixed: matches `control_forms` column. Extra: slug |
| `label` | string | Locked for fixed fields. Editable for extras (versioned) |
| `section_key` | enum | Locked for fixed. Editable for extras (versioned) |
| `is_fixed` | bool | `true` = maps to `control_forms` |
| `is_locked` | bool | `true` for all fixed fields — blocks structural edits |
| `display_order` | int | Locked for fixed. Editable for extras (versioned) |
| `excel_keywords` | JSON array nullable | Optional; patched without version bump on active template |

**Removed from v1:** `data_type`, `is_required`, `default_value`, `options_json`, `validation_json`, `show_in_list`, `show_in_detail`

**Constraint:** `UNIQUE (template_id, field_key)`

#### `excel_keywords` example

```json
["sub process", "sub-process", "subprocess"]
```

---

### Table: `racm_field_values`

Stores **extra field text values only**.

| Column | Type | Notes |
|--------|------|-------|
| `id` | PK | |
| `form_id` | FK → `control_forms.form_id` | |
| `template_field_id` | FK | References extra field (`is_fixed = false`) |
| `value_text` | text nullable | Only value column needed |

**Constraint:** `UNIQUE (form_id, template_field_id)`

**Also add:** `template_id` on `control_forms` — set at RACM creation, never changed.

---

## Template versioning and save flow

### What triggers a new version

| Change | New version? |
|--------|--------------|
| Add extra field | Yes |
| Remove extra field | Yes |
| Rename extra field label | Yes |
| Change extra field section | Yes |
| Change extra field display order | Yes |
| Edit Excel keywords | **No** |
| Edit fixed field anything | **Blocked** |

### Save confirmation modal (structural changes)

When the coordinator saves structural changes, show:

> **Existing RACMs will not be affected.**  
> They will continue to use the template version they were created with. Only **new** RACMs will use the updated layout.

Then offer two options:

| Option | Behavior |
|--------|----------|
| **Update version** | Same `template_name`, `version + 1`, new template row. Previous version → `archived`. New version → `active`. |
| **Save as new template** | New `template_name` (user-provided), `version = 1`, `status = active`. Previous active template → `archived`. |

Both options create a new `racm_templates` row and clone the 18 fixed fields plus the updated extra field set. Keywords are copied to the new version; subsequent keyword edits apply to the active template only.

**Default template (`is_default = true`):** structural edits still create a new version or new template, but the 18 fixed fields are always re-seeded unchanged. The default template lineage cannot be left without fixed fields.

---

## Active template rule

- **Exactly one** `status = 'active'` template per unit
- Bulk upload, manual create, and new RACM imports resolve fields from the active template
- Archived templates are read-only (for rendering old RACMs and audit)
- Draft templates (optional v1 feature) do not affect RACMs until activated

---

## Template deletion rules

| Condition | Allowed? |
|-----------|----------|
| Template version has **≥ 1 RACM** with `control_forms.template_id` pointing to it | **Cannot delete** — would orphan extra field values |
| Template version has **0 RACMs** | **Can delete** |
| Last remaining template for a unit | **Cannot delete** — unit must always retain a template |
| Default template with no RACMs but extras were added | Can delete **only** non-default archived versions; active default must remain or be replaced first |

**UI:** Disable delete with tooltip: *"This version is used by N RACMs and cannot be deleted."*

On delete of an unused version: cascade-delete its `racm_template_fields` rows (no `racm_field_values` exist).

---

## Unit template lifecycle

### Initial setup

1. On unit creation → seed `Default` v1 active template with 18 locked fixed fields (no extras, no keywords).
2. Coordinator opens **Unit RACM Template Settings**.
3. Coordinator may:
   - View fixed fields (read-only)
   - Add optional keywords to any field (no version bump)
   - Add / edit / remove **extra text fields** (version bump on save)
   - Copy layout from another unit (creates new version or new template on target)

### Copy template from another unit

**API:** `POST /api/company-co/racm-templates/copy`

```json
{
  "source_unit_id": "UNIT_A",
  "target_unit_id": "UNIT_B",
  "save_mode": "update_version" | "save_as_new_template",
  "template_name": "Optional when save_as_new_template"
}
```

**Behavior:**
- Copies extra field definitions + keywords from source **active** template
- Always re-seeds the 18 fixed fields from system defaults (does not copy source fixed field overrides — there are none)
- Does not copy RACM data
- Target gets new version per `save_mode`

---

## API shape (high level)

### Template management (coordinator)

| Method | Endpoint | Purpose |
|--------|----------|---------|
| GET | `/api/company-co/racm-templates?unit_id=` | Active template + all fields |
| GET | `/api/company-co/racm-templates/versions?unit_id=` | List versions (active + archived) |
| POST | `/api/company-co/racm-templates/structural-save` | Add/remove/reorder/rename extras → new version |
| PATCH | `/api/company-co/racm-templates/active/keywords` | Update keywords only — no version bump |
| POST | `/api/company-co/racm-templates/copy` | Copy from another unit |
| DELETE | `/api/company-co/racm-templates/:id` | Delete only if 0 linked RACMs |

### RACM CRUD (extended)

**GET** `/api/control-forms/:form_id` returns:

```json
{
  "fixed": { "...control_forms row..." },
  "template": { "id", "template_name", "version", "unit_id" },
  "field_definitions": [ "...racm_template_fields for RACM's template_id..." ],
  "dynamic_values": { "regulatory_ref": "ABC-1" }
}
```

**POST/PUT** accepts `dynamic_values` as `{ field_key: text }`; server validates keys exist on the RACM's template (or active template for new RACMs).

### Bulk import (extended)

1. User selects **unit**, business process, financial year.
2. Load **active** template for unit.
3. Auto-map Excel headers using optional `excel_keywords`.
4. Unmatched headers → manual column map (existing flow).
5. Import writes fixed columns → `control_forms`, extras → `racm_field_values`, sets `template_id`.

---

## Frontend rendering

### `FormDetail.jsx` (and create / edit forms)

1. Load RACM's `template_id` field definitions (not necessarily the active template).
2. Render four sections; fixed fields in locked positions; extras by `display_order`.
3. Fixed fields → `control_forms[field_key]` with existing control widgets.
4. Extra fields → multiline or single-line **text** inputs → `dynamic_values[field_key]`.
5. Core system blocks (frequency, performer, approval, etc.) remain hardcoded outside template.

### Template admin UI (new)

**Layout suggestion:**

```
[ Unit selector ▼ ]  [ Copy from unit… ]

── Fixed fields (read-only) ──────────────────────────
  Process and Risk
    Sub-Process          Keywords: [sub process] [sub-process] [+]
    Risk Description     Keywords: (none) [+ Add keywords]
    ...

── Extra fields (editable) ───────────────────────────
  Others
    [+ Add text field]
    Regulatory Ref       Section: [Others ▼]  Order: [2]
                         Keywords: [reg ref] [+]

[ Save structural changes ]   → opens version modal
```

- Keyword chips: add / edit / delete inline, auto-save via PATCH (no version modal)
- Structural save button enabled only when extras changed
- Fixed field rows: no edit icon on label/section; keyword area still editable

---

## What extra fields must NOT do

- No joins in dashboard / reminder / approval queries
- No use in sample sizing, approver assignment, or change-request workflow gates
- No AI inputs unless explicitly added later
- No list-page filtering in v1

---

## Migration path

### Phase 1 — Schema + seed
1. Add tables + `control_forms.template_id`
2. Seed `Default` v1 per unit with 18 locked fixed fields

### Phase 2 — Template admin UI
1. View fixed fields + manage keywords
2. Add/edit/remove extra fields with version modal
3. Copy from unit

### Phase 3 — Read path
1. GET form API returns template + dynamic values
2. `FormDetail.jsx` renders extras in **Others** (and other sections)

### Phase 4 — Write path
1. Create / edit APIs accept `dynamic_values`

### Phase 5 — Bulk import
1. Template-driven mappable field list + optional keywords

### Phase 6 — Export (optional)
1. Export includes extra columns using template labels

---

## Default Excel keywords (optional seed)

System may pre-seed suggested keywords on the default template. Coordinators can remove them. Not required for import.

| `field_key` | Suggested keywords |
|-------------|-------------------|
| `sub_process` | sub process, sub-process, subprocess |
| `risk_description` | risk description, risk desc |
| `risk_heat` | risk heat, heat |
| `control_objective` | control objective, objective |
| `standard_control_description` | standard control description, control description |
| `control_type_ma` | manual automated, type of control manual |
| `control_type_fo` | financial operational, type of control financial |
| `nature_of_control` | nature of control, preventive detective |
| `process_walkthrough` | process activity, walkthrough |
| `key_control` | key control |
| `application_name` | application name, application |
| `completeness` | completeness |
| `existence_occurrence` | existence occurrence |
| `valuation_and_allocation` | valuation allocation |
| `rights_and_obligation` | rights obligation |
| `presentation_and_disclosure` | presentation disclosure |
| `audit_evidence_accuracy` | control evidence, audit evidence |
| `whether_fraud_risks_exist` | fraud risk, whether fraud |

---

## Implementation suggestions

### 1. Separate keyword PATCH from structural save
Keep `PATCH .../keywords` independent of `POST .../structural-save` so the backend cannot accidentally bump a version when only keywords changed. Enforce in API layer, not only UI.

### 2. Immutable `field_key` for extras once used
Allow label renames freely (new version), but **do not allow changing `field_key`** after any RACM has stored a value. Otherwise historical `racm_field_values` become orphaned. UI: `field_key` editable only at create time.

### 3. `racm_count` denormalized or cached on template
Store `linked_racm_count` on `racm_templates` (updated on RACM create) to avoid `COUNT(*)` on every delete attempt and to power the disabled delete tooltip.

### 4. Archive, don't hard-delete, when RACMs exist
Even when deletion is blocked, prefer **`archived`** status over physical delete for versions that once had RACMs. Physical delete only when count = 0.

### 5. Cap extra fields per unit
Suggest a soft limit (e.g. **30 extra fields**) to keep forms and Excel mapping usable. Configurable via env.

### 6. `field_key` validation
Slug rules: `^[a-z][a-z0-9_]{2,49}$`, reserved keys blocked (`form_id`, `status`, fixed column names, etc.).

### 7. Render fallback for old RACMs whose extra field was removed in newer templates
When displaying a RACM on template v2 that had `regulatory_ref`, but v3 removed it — RACM still has `template_id = v2`, so the field still renders. No migration needed. Document this clearly in the save modal copy.

### 8. Copy-from-unit should not copy `template_name`
Always require a new name or default to `"Default (copy from UNIT_X)"` to avoid `(unit, template_name, version)` unique collisions.

### 9. Keywords on archived templates
Keyword PATCH targets **active template only**. Old versions keep keyword snapshots for historical export consistency if needed.

### 10. Resolve open items before build

| Item | Recommendation |
|------|----------------|
| `area` field | Keep as core `control_forms` column in Process and Risk UI, outside template (not in the 18) |
| `control_relies_on_ipe` / `ipe_reference` | Keep hardcoded in Control Details outside template for v1 |
| Draft templates | Defer to v2 unless coordinators need to prepare layouts before go-live |
| Extra field max length | Match `control_forms` text columns (e.g. 4000 chars) |

---

## Summary

| Layer | Responsibility |
|-------|----------------|
| `control_forms` | Core workflow + 18 fixed RACM column **values** |
| `racm_templates` | Per-unit versioned layouts; **one active** per unit |
| `racm_template_fields` | 18 **locked** fixed defs + optional **text-only** extras + optional keywords |
| `racm_field_values` | Extra text values only |
| Keywords | Optional, inline-editable, **no version bump** |
| Structural changes | New version or new template; **existing RACMs unchanged** |
| Deletion | Blocked when RACMs exist; unit must always retain a template |
| Bulk upload | Template-driven mapping; manual fallback when keywords absent |

This plan keeps the baseline **simple and safe** (locked fixed columns, text-only extras, clear version boundaries) while remaining scalable for per-unit customization and Excel import.
