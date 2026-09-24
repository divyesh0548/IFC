from __future__ import annotations

from typing import Any

from .config import AllowedValueCatalog, resolve_value_with_definition

ASSERTIONS_ALL = "assertions.*"


def _as_str(value: Any) -> str:
    if value is None:
        return ""
    return str(value).strip()


def get_field(control: dict[str, Any], field: str) -> str:
    """Resolve a mapped field from a control row (supports assertions.* / assertions.any)."""
    if field == "assertions.any":
        assertions = control.get("assertions") or {}
        if isinstance(assertions, dict):
            for val in assertions.values():
                if _as_str(val):
                    return _as_str(val)
        for item in control.get("assertion_fields") or []:
            if _as_str(item.get("value")):
                return _as_str(item.get("value"))
        return ""

    if field == ASSERTIONS_ALL:
        return get_field(control, "assertions.any")

    if field.startswith("assertions."):
        key = field.split(".", 1)[1]
        assertions = control.get("assertions") or {}
        if isinstance(assertions, dict):
            return _as_str(assertions.get(key))
        return ""

    return _as_str(control.get(field))


def build_assertions_payload(
    control: dict[str, Any],
    max_field_chars: int,
) -> dict[str, str]:
    """
    All assertion-section columns for this control (template-agnostic).
    Keys prefer template label; fall back to field_key. Duplicate labels get a suffix.
    """
    items = control.get("assertion_fields")
    if not isinstance(items, list) or not items:
        assertions = control.get("assertions") or {}
        if isinstance(assertions, dict):
            items = [
                {"field_key": k, "label": k, "value": v}
                for k, v in assertions.items()
            ]
        else:
            items = []

    out: dict[str, str] = {}
    used_keys: set[str] = set()
    for item in items:
        label = _as_str(item.get("label")) or _as_str(item.get("field_key")) or "assertion"
        field_key = _as_str(item.get("field_key"))
        key = label
        if key in used_keys:
            key = f"{label} ({field_key})" if field_key else f"{label}_{len(used_keys)}"
        used_keys.add(key)
        value = _as_str(item.get("value"))
        if len(value) > max_field_chars:
            value = value[:max_field_chars] + "…"
        out[key] = value
    return out


def is_empty(value: Any) -> bool:
    return not _as_str(value)


def _norm_token(value: Any) -> str:
    raw = _as_str(value).lower()
    return "".join(ch for ch in raw if ch.isalnum())


def matches_allowed(value: Any, allowed: list[str] | None) -> bool:
    if not allowed:
        return not is_empty(value)
    token = _norm_token(value)
    if not token:
        return False
    allowed_norm = {_norm_token(a) for a in allowed}
    return token in allowed_norm


def _is_non_key_only_list(allowed_list: list[str]) -> bool:
    return bool(allowed_list) and all(
        _norm_token(a) == "no" or _norm_token(a).startswith("non") for a in allowed_list
    )


def run_precheck(control: dict[str, Any], check: dict[str, Any]) -> dict[str, Any] | None:
    """
    Return:
      - None if eligible for AI
      - {"action": "skip", ...} if check does not apply (e.g. key_control=Yes for non-key-only)
      - insufficient_data result dict if text/classified validation fails
    """
    check_id = check["id"]
    statement = check.get("statement") or check_id
    reasons: list[str] = []

    # 1) Text validation first (required_text)
    required_text = check.get("required_text") or []
    for field in required_text:
        value = get_field(control, field)
        if is_empty(value):
            reasons.append(f"{field} is empty")

    # 2) Classified validation
    required_classified = check.get("required_classified") or {}
    for field, allowed in required_classified.items():
        value = get_field(control, field)
        allowed_list = list(allowed or [])
        if is_empty(value):
            # Empty already covered if also in required_text; still record for classified-only fields
            if field not in required_text:
                reasons.append(f"{field} is empty")
            continue
        if matches_allowed(value, allowed_list):
            continue
        # Present but outside allowed set
        if field == "key_control" and _is_non_key_only_list(allowed_list):
            # key_control=Yes (or other non-No) → check N/A, not insufficient data
            return {
                "action": "skip",
                "check_id": check_id,
                "reason": f"{field}={value!r} — check applies only to non-key controls",
            }
        reasons.append(f"{field}={value!r} not in allowed {allowed_list}")

    if not reasons:
        return None

    return {
        "check_id": check_id,
        "statement": statement,
        "status": "insufficient_data",
        "severity": "info",
        "alignment": "",
        "alignment_rationale": "",
        "proposed_solution": "Fill/correct the listed fields, then re-run.",
        "inconsistency": "Required fields failed text validation; AI skipped for this check.",
        "evidence": reasons,
        "recommendation": "Fill/correct the listed fields, then re-run.",
        "source": "precheck",
    }


def partition_checks(
    control: dict[str, Any], checks: list[dict[str, Any]]
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    """Split checks into (eligible_for_ai, precheck_results, skipped)."""
    eligible: list[dict[str, Any]] = []
    precheck_results: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    for check in checks:
        outcome = run_precheck(control, check)
        if outcome is None:
            eligible.append(check)
        elif outcome.get("action") == "skip":
            skipped.append(outcome)
        else:
            precheck_results.append(outcome)
    return eligible, precheck_results, skipped


def build_control_payload(
    control: dict[str, Any],
    eligible_checks: list[dict[str, Any]],
    max_field_chars: int,
    allowed_catalog: AllowedValueCatalog | None = None,
) -> dict[str, Any]:
    """Payload for one OpenRouter call: only eligible checks + needed columns."""
    needed_fields: set[str] = set()
    for check in eligible_checks:
        for field in check.get("columns") or []:
            needed_fields.add(field)

    fields: dict[str, Any] = {}
    for field in sorted(needed_fields):
        if field in ("assertions.any",):
            continue
        if field == ASSERTIONS_ALL:
            fields["assertions"] = build_assertions_payload(control, max_field_chars)
            continue
        value = get_field(control, field)
        if allowed_catalog is not None:
            value = resolve_value_with_definition(allowed_catalog, field, value)
        if len(value) > max_field_chars:
            value = value[:max_field_chars] + "…"
        fields[field] = value

    return {
        "control": {
            "form_id": control.get("form_id"),
            "control_number": control.get("control_number"),
            "company_identifier": control.get("company_identifier"),
            "unit_id": control.get("unit_id"),
            "business_process": control.get("business_process"),
            "financial_year": control.get("financial_year"),
        },
        "fields": fields,
        "checks": [
            {
                "id": c["id"],
                "statement": c.get("statement") or c["id"],
                "prompt": c.get("prompt") or c.get("statement") or "",
            }
            for c in eligible_checks
        ],
    }
