# AI Summary API Backend (Flask)

Standalone Flask service for IFC AI summaries. **No IFC database connection.**
The Node backend fetches control data, calls this API with a payload, then
persists the JSON response itself.

## Setup

```bash
cd AI-Summary-API-Backend
python -m venv .venv
# Windows:
.venv\Scripts\activate
pip install -r requirements.txt
copy .env.example .env
# Edit .env: set AI_SUMMARY_API_KEY and OPENROUTER_API_KEY
```

## Run

```bash
python run.py
```

Default: `http://127.0.0.1:5001`

## Auth (shared API key)

Env: `AI_SUMMARY_API_KEY` (used for all summary endpoints, not design-gap only).

Send either:

```http
Authorization: Bearer <AI_SUMMARY_API_KEY>
```

or

```http
X-API-Key: <AI_SUMMARY_API_KEY>
```

## Endpoints

| Method | Path | Auth | Purpose |
|--------|------|------|---------|
| GET | `/health` | No | Service liveness |
| GET | `/v1/design-gap/health` | No | Design-gap config / check ids |
| POST | `/v1/design-gap/analyze` | Yes | One control |
| POST | `/v1/design-gap/analyze-batch` | Yes | Many controls (sequential) |

### POST `/v1/design-gap/analyze`

Request:

```json
{
  "dry_run": false,
  "control": {
    "form_id": "…",
    "control_number": "P2P1",
    "company_identifier": "…",
    "unit_id": "…",
    "business_process": "Purchase to Pay",
    "financial_year": "2026-27",
    "risk_description": "…",
    "control_objective": "…",
    "standard_control_description": "…",
    "sub_process": "…",
    "key_control": "No",
    "whether_fraud_risks_exist": "No",
    "nature_of_control": "Preventive",
    "control_type_ma": "Manual",
    "risk_heat": "H",
    "assertions": {
      "completeness": "Yes"
    },
    "assertion_fields": [
      { "field_key": "completeness", "label": "Completeness", "value": "Yes" }
    ]
  }
}
```

- Node may send `assertions` **and/or** `assertion_fields`.
- `dry_run: true` → no OpenRouter call; response includes `dry_run_prompt`.

Response (persist this in DB): `form_id`, `control_design_status`, `summary`,
`results` (merged AI + precheck), `ai_response_json`, `usage`, `model_name`, …

### Curl example

```bash
curl -s http://127.0.0.1:5001/v1/design-gap/analyze ^
  -H "Authorization: Bearer change-me-to-a-long-random-secret" ^
  -H "Content-Type: application/json" ^
  -d "{\"dry_run\":true,\"control\":{\"form_id\":\"F1\",\"control_number\":\"C1\",\"business_process\":\"Purchase to Pay\",\"risk_description\":\"Risk text\",\"standard_control_description\":\"Control text\",\"control_objective\":\"Objective\",\"key_control\":\"No\",\"whether_fraud_risks_exist\":\"No\",\"assertion_fields\":[{\"field_key\":\"completeness\",\"label\":\"Completeness\",\"value\":\"Yes\"}]}}"
```

## Design-gap config

- `services/design_gap/column_map.yaml` — checks / gates
- `config/control_classification_allowed_values.json` — shared Yes/No etc. for gates  
  (keep in sync with `backend/config/control_classification_allowed_values.json` used by the website)

## Node integration (later)

1. Node loads control + assertion fields from IFC DB  
2. `POST /v1/design-gap/analyze` with API key  
3. Node upserts response into `design_gap_insights` (or similar)
