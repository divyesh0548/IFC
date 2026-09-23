from __future__ import annotations

from typing import Any

from .config import Settings, load_column_map, resolve_settings
from .gates import build_control_payload, partition_checks
from .openrouter_client import OpenRouterError, review_control
from .prompts import (
    SYSTEM_PROMPT,
    build_user_prompt,
    default_summary_for_status,
    derive_control_design_status,
)


def normalize_control_input(control: dict[str, Any]) -> dict[str, Any]:
    """
    Normalize Node-sent control payload.
    Accepts assertions as dict and/or assertion_fields as list of {field_key,label,value}.
    """
    row = dict(control or {})
    assertion_fields = row.get("assertion_fields")
    assertions = row.get("assertions")

    if not isinstance(assertion_fields, list):
        assertion_fields = []
    if not isinstance(assertions, dict):
        assertions = {}

    if assertion_fields and not assertions:
        assertions = {
            str(item.get("field_key")): item.get("value") or ""
            for item in assertion_fields
            if item.get("field_key")
        }
    elif assertions and not assertion_fields:
        assertion_fields = [
            {"field_key": k, "label": k, "value": v}
            for k, v in assertions.items()
        ]

    row["assertions"] = assertions
    row["assertion_fields"] = assertion_fields
    row["assertions.any"] = (
        "yes"
        if any(str(item.get("value") or "").strip() for item in assertion_fields)
        or any(str(v or "").strip() for v in assertions.values())
        else ""
    )
    return row


def analyze_control(
    control: dict[str, Any],
    *,
    dry_run: bool = False,
    column_map: dict[str, Any] | None = None,
    settings: Settings | None = None,
) -> dict[str, Any]:
    """
    Run design-gap gates + optional OpenRouter for one control payload.
    Returns JSON suitable for Node to persist.
    """
    column_map = column_map or load_column_map()
    settings = settings or resolve_settings(
        column_map, require_openrouter_key=not dry_run
    )
    checks = column_map["checks"]
    allowed_catalog = column_map.get("allowed_value_catalog")
    row = normalize_control_input(control)

    form_id = row.get("form_id")
    cn = row.get("control_number")
    eligible, precheck_results = partition_checks(row, checks)

    ai_results: list[dict[str, Any]] = []
    raw_ai_json: dict[str, Any] | None = None
    usage: dict[str, Any] = {
        "skipped": True,
        "prompt_tokens": 0,
        "completion_tokens": 0,
        "total_tokens": 0,
    }
    control_design_status = None
    summary = None
    dry_run_prompt = None

    if eligible and not dry_run:
        payload = build_control_payload(
            row, eligible, settings.max_field_chars, allowed_catalog=allowed_catalog
        )
        try:
            ai_results, usage, raw_ai_json = review_control(
                settings, payload, eligible
            )
            control_design_status = usage.get("control_design_status")
            summary = usage.get("summary")
        except OpenRouterError as exc:
            ai_results = [
                {
                    "check_id": c["id"],
                    "statement": c["statement"],
                    "status": "insufficient_data",
                    "severity": "info",
                    "inconsistency": f"OpenRouter call failed: {exc}",
                    "evidence": [],
                    "recommendation": "Retry later.",
                    "source": "openrouter_error",
                }
                for c in eligible
            ]
            raw_ai_json = {
                "control_design_status": "insufficient_data",
                "summary": f"OpenRouter call failed: {exc}",
                "results": ai_results,
                "source": "openrouter_error",
            }
    elif eligible and dry_run:
        payload = build_control_payload(
            row, eligible, settings.max_field_chars, allowed_catalog=allowed_catalog
        )
        dry_run_prompt = {
            "system": SYSTEM_PROMPT,
            "user": build_user_prompt(payload),
            "model": settings.model,
            "eligible_checks": [c["id"] for c in eligible],
        }
        ai_results = [
            {
                "check_id": c["id"],
                "statement": c["statement"],
                "status": "insufficient_data",
                "severity": "info",
                "inconsistency": "Dry-run: OpenRouter not called; prompt returned in response.",
                "evidence": [],
                "recommendation": "",
                "source": "dry_run",
            }
            for c in eligible
        ]
        raw_ai_json = {
            "control_design_status": "insufficient_data",
            "summary": "Dry-run: OpenRouter not called.",
            "results": ai_results,
            "source": "dry_run",
        }

    merged = precheck_results + ai_results
    order = {c["id"]: i for i, c in enumerate(checks)}
    merged.sort(key=lambda r: order.get(r.get("check_id"), 999))

    if control_design_status is None:
        control_design_status = derive_control_design_status(merged)
    if summary is None:
        summary = default_summary_for_status(control_design_status)

    # Prefer merged-list status for persistence (includes prechecks)
    merged_status = derive_control_design_status(merged)
    if merged_status != control_design_status and any(
        r.get("source") == "precheck" for r in merged
    ):
        # Keep AI overall if it found gaps; otherwise use merged
        if control_design_status != "has_gaps":
            control_design_status = merged_status
            summary = default_summary_for_status(control_design_status)

    out: dict[str, Any] = {
        "form_id": form_id,
        "control_number": cn,
        "company_identifier": row.get("company_identifier"),
        "unit_id": row.get("unit_id"),
        "business_process": row.get("business_process"),
        "financial_year": row.get("financial_year"),
        "control_design_status": control_design_status,
        "summary": summary,
        "usage": usage,
        "results": merged,
        "ai_response_json": raw_ai_json,
        "model_name": settings.model,
        "eligible_check_count": len(eligible),
        "precheck_skip_count": len(precheck_results),
    }
    if dry_run_prompt is not None:
        out["dry_run_prompt"] = dry_run_prompt
    return out
