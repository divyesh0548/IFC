from __future__ import annotations

import json
from typing import Any

SYSTEM_PROMPT = """You are an internal-controls design reviewer for IFC / RACM data.
You evaluate ONLY the design checks provided in the user payload.
Do not invent fields that are not present. Quote evidence from the provided field values.
Return STRICT JSON matching the schema described by the user. No markdown fences.
Write comprehensive but concise prose: alignment_rationale and proposed_solution must each be at most 3 sentences.
For risk_design and control_design, return the named adequacy fields from the check prompt. Do not collapse those fields into one paragraph.
"""

GOOD_DESIGN_STATUS = "good_design"
HAS_GAPS_STATUS = "has_gaps"
CONTROL_STATUS_VALUES = frozenset(
    {GOOD_DESIGN_STATUS, HAS_GAPS_STATUS, "insufficient_data"}
)

ALIGNMENT_VALUES = frozenset(
    {"strong", "partial", "weak", "misaligned", "no_control", ""}
)

STRUCTURED_CHECK_FIELDS = {
    "risk_design": (
        "adequacy",
        "risk_design_gap",
        "suggested_risk_wording",
        "implementation_approach",
        "benefit",
        "priority",
        "rationale",
    ),
    "control_design": (
        "adequacy",
        "control_design_gap",
        "suggested_control_improvement",
        "implementation_approach",
        "benefit",
        "priority",
        "rationale",
    ),
}

_ADEQUACY_LABELS = {
    "adequate": "Adequate",
    "partially adequate": "Partially Adequate",
    "partial": "Partially Adequate",
    "inadequate": "Inadequate",
    "information not available": "Information Not Available",
}
_PRIORITY_LABELS = {"high": "High", "medium": "Medium", "low": "Low"}


def _normalize_alignment(raw: Any) -> str:
    text = str(raw or "").strip().lower().replace("-", " ").replace("_", " ")
    text = " ".join(text.split())
    mapping = {
        "strong": "Strong",
        "strong alignment": "Strong",
        "partial": "Partial",
        "partial alignment": "Partial",
        "weak": "Weak",
        "weak alignment": "Weak",
        "misaligned": "Misaligned",
        "misalignment": "Misaligned",
        "no control": "No Control",
        "nocontrol": "No Control",
    }
    return mapping.get(text, str(raw or "").strip()[:40])


def _normalize_adequacy(raw: Any) -> str:
    text = " ".join(str(raw or "").split()).strip().lower()
    return _ADEQUACY_LABELS.get(text, "")


def _normalize_priority(raw: Any) -> str:
    return _PRIORITY_LABELS.get(str(raw or "").strip().lower(), "")


def _structured_fields(check_id: str, item: dict[str, Any]) -> dict[str, str]:
    fields = STRUCTURED_CHECK_FIELDS.get(check_id)
    if not fields:
        return {}
    out: dict[str, str] = {}
    for name in fields:
        if name == "adequacy":
            out[name] = _normalize_adequacy(item.get(name))
        elif name == "priority":
            out[name] = _normalize_priority(item.get(name))
        else:
            out[name] = _clip_sentences(item.get(name) or "")
    return out


def _alignment_implies_flagged(alignment: str) -> bool:
    key = alignment.strip().lower()
    return key in {"partial", "weak", "misaligned", "no control"}


def _clip_sentences(text: str, max_sentences: int = 3, max_chars: int = 900) -> str:
    raw = " ".join(str(text or "").split()).strip()
    if not raw:
        return ""
    parts: list[str] = []
    buf = ""
    for ch in raw:
        buf += ch
        if ch in ".!?" and len(buf.strip()) > 1:
            parts.append(buf.strip())
            buf = ""
            if len(parts) >= max_sentences:
                break
    if len(parts) < max_sentences and buf.strip():
        parts.append(buf.strip())
    out = " ".join(parts[:max_sentences])
    if len(out) > max_chars:
        out = out[: max_chars - 1].rstrip() + "…"
    return out


def build_user_prompt(payload: dict[str, Any]) -> str:
    schema_hint = {
        "control_design_status": (
            "good_design | has_gaps | insufficient_data — "
            "overall verdict for this control"
        ),
        "summary": (
            "short overall message (max 3 sentences); if good_design use exactly: "
            "'Control is in good design with no design gaps identified.'"
        ),
        "results": [
            {
                "check_id": "string — must match an id from checks",
                "status": "ok | flagged | insufficient_data",
                "severity": "info | low | medium | high",
                "alignment": "Strong | Partial | Weak | Misaligned | No Control. Omit for risk_design and control_design.",
                "alignment_rationale": "up to 3 sentences. Omit for risk_design and control_design.",
                "proposed_solution": "up to 3 sentences; empty string if ok / Strong. Omit for risk_design and control_design.",
                "adequacy": "risk_design and control_design only: Adequate | Partially Adequate | Inadequate | Information Not Available",
                "risk_design_gap": "risk_design only",
                "suggested_risk_wording": "risk_design only",
                "control_design_gap": "control_design only",
                "suggested_control_improvement": "control_design only",
                "implementation_approach": "risk_design and control_design only; empty when Adequate or Information Not Available",
                "benefit": "risk_design and control_design only",
                "priority": "risk_design and control_design only: High | Medium | Low",
                "rationale": "risk_design and control_design only",
                "evidence": ["short quotes or field references from provided fields"],
            }
        ],
    }
    return (
        "Review this single control against the listed design checks.\n"
        "Rules:\n"
        "- Evaluate ONLY the checks in payload.checks.\n"
        "- For each check, follow that check's `prompt` instructions carefully.\n"
        "- Use ONLY payload.fields as evidence.\n"
        "- For checks other than risk_design and control_design:\n"
        "  * status=flagged when alignment is Partial, Weak, Misaligned, or No Control.\n"
        "  * status=ok when alignment is Strong.\n"
        "- For risk_design and control_design:\n"
        "  * status=ok when adequacy is Adequate.\n"
        "  * status=flagged when adequacy is Partially Adequate or Inadequate.\n"
        "  * status=insufficient_data when adequacy is Information Not Available.\n"
        "  * Return the named fields. Do not put them only in alignment_rationale.\n"
        "- status=insufficient_data only if the provided fields are still too thin to judge "
        "(prefer ok/flagged when data exists). AI insufficient_data is NOT a design gap.\n"
        "- Overall control_design_status:\n"
        "  * good_design — EVERY evaluated check in results is status=ok.\n"
        "  * has_gaps — one or more checks are status=flagged.\n"
        "  * insufficient_data — no flagged checks, but at least one check is "
        "insufficient_data.\n"
        "- You do NOT need to invent gaps. If the control looks sound, return good_design.\n"
        "- alignment_rationale and proposed_solution: max 3 sentences each.\n"
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


def _empty_detail_fields() -> dict[str, Any]:
    return {
        "alignment": "",
        "alignment_rationale": "",
        "proposed_solution": "",
        "inconsistency": "",
        "recommendation": "",
        "evidence": [],
    }


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

        alignment = _normalize_alignment(
            item.get("alignment") or item.get("alignment_level")
        )
        rationale = _clip_sentences(
            item.get("alignment_rationale")
            or item.get("inconsistency")
            or item.get("explanation")
            or ""
        )
        solution = _clip_sentences(
            item.get("proposed_solution") or item.get("recommendation") or ""
        )

        structured = _structured_fields(check_id, item)
        if structured:
            adequacy = structured.get("adequacy") or ""
            if adequacy == "Adequate":
                status = "ok"
            elif adequacy in {"Partially Adequate", "Inadequate"}:
                status = "flagged"
            elif adequacy == "Information Not Available":
                status = "insufficient_data"
            priority = structured.get("priority") or ""
            if priority:
                item_severity = priority.lower()
            else:
                item_severity = str(item.get("severity") or "info")
            rationale = structured.get("rationale") or ""
            suggestion = (
                structured.get("suggested_risk_wording")
                or structured.get("suggested_control_improvement")
                or ""
            )
            raw_evidence = item.get("evidence") or []
            if isinstance(raw_evidence, str):
                raw_evidence = [raw_evidence]
            if not isinstance(raw_evidence, list):
                raw_evidence = []
            found[check_id] = {
                "check_id": check_id,
                "statement": by_id[check_id].get("statement") or check_id,
                "status": status,
                "severity": item_severity,
                "alignment": adequacy,
                "alignment_rationale": rationale,
                "proposed_solution": suggestion,
                "inconsistency": structured.get("risk_design_gap") or structured.get("control_design_gap") or rationale,
                "recommendation": suggestion,
                "evidence": [str(entry) for entry in raw_evidence][:5],
                "source": "openrouter",
                **structured,
            }
            continue

        if status == "ok" and _alignment_implies_flagged(alignment):
            status = "flagged"
        if status == "flagged" and not alignment:
            alignment = "Weak"

        evidence = item.get("evidence") or []
        if isinstance(evidence, str):
            evidence = [evidence]
        if not isinstance(evidence, list):
            evidence = []

        found[check_id] = {
            "check_id": check_id,
            "statement": by_id[check_id].get("statement") or check_id,
            "status": status,
            "severity": str(item.get("severity") or "info"),
            "alignment": alignment,
            "alignment_rationale": rationale,
            "proposed_solution": solution,
            # Backward-compatible mirrors for older UI consumers
            "inconsistency": rationale,
            "recommendation": solution,
            "evidence": [str(e) for e in evidence][:5],
            "source": "openrouter",
        }

    results: list[dict[str, Any]] = []
    for check in eligible_checks:
        check_id = check["id"]
        if check_id in found:
            results.append(found[check_id])
        else:
            missing = {
                "check_id": check_id,
                "statement": check.get("statement") or check_id,
                "status": "insufficient_data",
                "severity": "info",
                "source": "openrouter_missing",
                **_empty_detail_fields(),
            }
            missing["inconsistency"] = "Model did not return a result for this check."
            missing["proposed_solution"] = "Re-run or inspect model output."
            missing["recommendation"] = missing["proposed_solution"]
            results.append(missing)

    derived = derive_control_design_status(results)
    control_status = model_status if model_status in CONTROL_STATUS_VALUES else derived
    if derived == HAS_GAPS_STATUS:
        control_status = HAS_GAPS_STATUS
    elif derived == GOOD_DESIGN_STATUS:
        control_status = GOOD_DESIGN_STATUS

    summary = _clip_sentences(model_summary) or default_summary_for_status(control_status)
    if control_status == GOOD_DESIGN_STATUS:
        summary = default_summary_for_status(GOOD_DESIGN_STATUS)

    return results, control_status, summary
