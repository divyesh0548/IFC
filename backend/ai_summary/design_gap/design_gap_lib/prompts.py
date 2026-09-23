from __future__ import annotations

import json
from typing import Any

SYSTEM_PROMPT = """You are an internal-controls design reviewer for IFC / RACM data.
You evaluate ONLY the design checks provided in the user payload.
Do not invent fields that are not present. Quote evidence from the provided field values.
Return STRICT JSON matching the schema described by the user. No markdown fences."""

GOOD_DESIGN_STATUS = "good_design"
HAS_GAPS_STATUS = "has_gaps"
CONTROL_STATUS_VALUES = frozenset(
    {GOOD_DESIGN_STATUS, HAS_GAPS_STATUS, "insufficient_data"}
)


def build_user_prompt(payload: dict[str, Any]) -> str:
    schema_hint = {
        "control_design_status": (
            "good_design | has_gaps | insufficient_data — "
            "overall verdict for this control"
        ),
        "summary": (
            "short overall message; if good_design use exactly: "
            "'Control is in good design with no design gaps identified.'"
        ),
        "results": [
            {
                "check_id": "string — must match an id from checks",
                "status": "ok | flagged | insufficient_data",
                "severity": "info | low | medium | high",
                "inconsistency": "short description; empty string if ok",
                "evidence": ["short quotes or field references from provided fields"],
                "recommendation": "short actionable note; empty string if ok",
            }
        ],
    }
    return (
        "Review this single control against the listed design checks.\n"
        "Rules:\n"
        "- Evaluate ONLY the checks in payload.checks.\n"
        "- Use ONLY payload.fields as evidence.\n"
        "- status=flagged when the design appears inconsistent or inappropriate.\n"
        "- status=ok when consistent given the provided data.\n"
        "- status=insufficient_data only if the provided fields are still too thin to judge "
        "(prefer ok/flagged when data exists).\n"
        "- Overall control_design_status:\n"
        "  * good_design — EVERY check in results is status=ok "
        "(no design gaps). Set summary to: "
        "'Control is in good design with no design gaps identified.'\n"
        "  * has_gaps — one or more checks are status=flagged.\n"
        "  * insufficient_data — no flagged checks, but at least one check is "
        "insufficient_data and none are flagged.\n"
        "- You do NOT need to invent gaps. If the control looks sound, return good_design.\n"
        "- Keep inconsistency and recommendation under 280 characters each.\n"
        "- evidence: 1–3 short items max per check.\n\n"
        f"Expected JSON shape:\n{json.dumps(schema_hint, indent=2)}\n\n"
        f"Payload:\n{json.dumps(payload, ensure_ascii=False, indent=2)}"
    )


def derive_control_design_status(results: list[dict[str, Any]]) -> str:
    statuses = [str(r.get("status") or "") for r in results]
    if not statuses:
        return "insufficient_data"
    if any(s == "flagged" for s in statuses):
        return HAS_GAPS_STATUS
    if all(s == "ok" for s in statuses):
        return GOOD_DESIGN_STATUS
    return "insufficient_data"


def default_summary_for_status(status: str) -> str:
    if status == GOOD_DESIGN_STATUS:
        return "Control is in good design with no design gaps identified."
    if status == HAS_GAPS_STATUS:
        return "One or more design gaps were identified for this control."
    return "Insufficient data to fully assess design for this control."


def normalize_ai_results(
    raw: dict[str, Any] | list[Any] | None,
    eligible_checks: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], str, str]:
    """
    Map model output onto eligible checks.
    Returns (results, control_design_status, summary).
    """
    by_id: dict[str, dict[str, Any]] = {c["id"]: c for c in eligible_checks}
    found: dict[str, dict[str, Any]] = {}

    items: list[Any] = []
    model_status = ""
    model_summary = ""
    if isinstance(raw, dict):
        items = raw.get("results") or raw.get("checks") or []
        model_status = str(raw.get("control_design_status") or "").strip().lower()
        model_summary = str(raw.get("summary") or "").strip()
    elif isinstance(raw, list):
        items = raw

    allowed_status = {"ok", "flagged", "insufficient_data"}

    for item in items:
        if not isinstance(item, dict):
            continue
        check_id = str(item.get("check_id") or item.get("id") or "").strip()
        if check_id not in by_id:
            continue
        status = str(item.get("status") or "insufficient_data").strip().lower()
        if status not in allowed_status:
            status = "insufficient_data"
        evidence = item.get("evidence") or []
        if isinstance(evidence, str):
            evidence = [evidence]
        if not isinstance(evidence, list):
            evidence = []
        found[check_id] = {
            "check_id": check_id,
            "statement": by_id[check_id]["statement"],
            "status": status,
            "severity": str(item.get("severity") or "info"),
            "inconsistency": str(item.get("inconsistency") or ""),
            "evidence": [str(e) for e in evidence][:5],
            "recommendation": str(item.get("recommendation") or ""),
            "source": "openrouter",
        }

    results: list[dict[str, Any]] = []
    for check in eligible_checks:
        check_id = check["id"]
        if check_id in found:
            results.append(found[check_id])
        else:
            results.append(
                {
                    "check_id": check_id,
                    "statement": check["statement"],
                    "status": "insufficient_data",
                    "severity": "info",
                    "inconsistency": "Model did not return a result for this check.",
                    "evidence": [],
                    "recommendation": "Re-run or inspect model output.",
                    "source": "openrouter_missing",
                }
            )

    # Prefer status derived from per-check results (authoritative)
    derived = derive_control_design_status(results)
    control_status = model_status if model_status in CONTROL_STATUS_VALUES else derived
    # If model claimed good_design but any flagged, force has_gaps
    if derived == HAS_GAPS_STATUS:
        control_status = HAS_GAPS_STATUS
    elif derived == GOOD_DESIGN_STATUS:
        control_status = GOOD_DESIGN_STATUS

    summary = model_summary or default_summary_for_status(control_status)
    if control_status == GOOD_DESIGN_STATUS:
        summary = default_summary_for_status(GOOD_DESIGN_STATUS)

    return results, control_status, summary
