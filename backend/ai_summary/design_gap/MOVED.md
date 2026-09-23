# Design gap prototype moved

The design-gap AI service now lives in:

`AI-Summary-API-Backend/`

- Flask API (no IFC DB) — Node sends control payloads, receives JSON
- Auth: `AI_SUMMARY_API_KEY`

This folder under `backend/ai_summary/design_gap` is kept only as a historical
local CLI prototype. Prefer the Flask service for website integration.
