# Design-gap audit (Python + OpenRouter prototype)

Standalone script under `backend/ai_summary/design_gap/`. Not wired into the website yet.

## Setup

```bash
cd backend/ai_summary/design_gap
python -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -r requirements.txt
```

Requires `OPENROUTER_API_KEY` and `DATABASE_URL` in `backend/.env`.

## Run

1. Edit the **RUN CONFIG** block at the top of `run_design_gap.py`
   (`COMPANY`, `UNIT`, `BUSINESS_PROCESS`, `FINANCIAL_YEAR`, `LIMIT`, etc.).
2. Then:

```bash
python run_design_gap.py
```

Useful config flags in that block:

- `DRY_RUN = True` — **no OpenRouter call**; saves the exact system+user prompt under `output/dry_run_prompts/*.txt` for review
- `ACTIVE_ONLY = False` — include inactive controls
- `SLEEP_MS = 200` — pause between API calls (live mode only)

When `DRY_RUN = False`, `OPENROUTER_API_KEY` is required in `backend/.env`.

## Outputs (`output/`)

| File | Purpose |
|------|---------|
| `design_gap_report_*.json` | Full run payload (meta + summary + controls) |
| `design_gap_report_*.md` | Human-readable flagged / good-design / insufficient sections |
| `design_gap_store_*.xlsx` | One row per control: `form_id` + `ai_response_json` (prototype store; later → DB) |

Excel columns: `form_id`, `control_number`, identifiers, `control_design_status`, `summary`, `ai_response_json`, `results_json`, `usage_json`, `generated_at`.

Overall statuses: `good_design` | `has_gaps` | `insufficient_data`.

## Shared classification values

Single source (also used by the Unclassified Controls page):

`backend/config/control_classification_allowed_values.json`

Fields: `nature_of_control`, `control_type_ma`, `control_type_fo`, `key_control`.

In `column_map.yaml`, set `required_classified` values to `"$shared"` to pull from that file.

## Edit checks / columns

`column_map.yaml` — each check has:

- `statement`
- `columns` (fields sent to the model when the check is eligible)
- `required_classified` — fixed-value fields (`"$shared"` or an inline list)
- `required_text` — free-text fields that must be non-empty

Failed gates → `insufficient_data` and that check is omitted from the OpenRouter payload.

## Cost

See `COSTING.txt`.
