from __future__ import annotations

import json

from .llm import PACKAGE_DIR, complete_comparison_json, load_text, provider_name, resolve_model
from .sanitize import _overlap
from .service import is_risk_analysis_dry_run_enabled

ADDRESS_STATUSES = ("Fully addressed", "Partially addressed", "Not addressed")
MAX_COMPARE_PEERS = 8
MIN_PEER_OVERLAP = 0.2
MAX_FIELD_CHARS = 1200
MAX_REASON_CHARS = 280

_NOT_ADDRESSED_REASON = "No other control in this unit and business process addresses this risk."
_STATUS_REASONS = {
    "Fully addressed": "Another control in this unit and business process already covers this risk.",
    "Partially addressed": "Another control in this unit and business process covers only part of this risk.",
    "Not addressed": _NOT_ADDRESSED_REASON,
}


def _clip(value: str) -> str:
    text = " ".join(str(value or "").split())
    if len(text) <= MAX_FIELD_CHARS:
        return text
    return text[: MAX_FIELD_CHARS - 1].rstrip() + "…"


def compact_peer(peer: dict) -> dict | None:
    if not isinstance(peer, dict):
        return None
    control_number = str(peer.get("controlNumber") or peer.get("control_number") or "").strip()
    details = {
        "controlNumber": control_number,
        "riskDescription": str(peer.get("riskDescription") or peer.get("risk_description") or "").strip(),
        "controlObjective": str(peer.get("controlObjective") or peer.get("control_objective") or "").strip(),
        "standardControlDescription": str(
            peer.get("standardControlDescription") or peer.get("standard_control_description") or ""
        ).strip(),
    }
    if not control_number:
        return None
    if not any(details[key] for key in ("riskDescription", "controlObjective", "standardControlDescription")):
        return None
    return details


def select_relevant_peers(risk: str, peers: list[dict]) -> list[dict]:
    ranked: list[tuple[float, dict]] = []
    seen: set[str] = set()
    for peer in peers:
        compact = compact_peer(peer)
        if not compact:
            continue
        key = compact["controlNumber"].lower()
        if key in seen:
            continue
        source = " ".join(
            compact[field]
            for field in ("riskDescription", "controlObjective", "standardControlDescription")
            if compact[field]
        )
        score = _overlap(risk, source)
        if score < MIN_PEER_OVERLAP:
            continue
        seen.add(key)
        ranked.append((score, compact))
    ranked.sort(key=lambda item: (-item[0], item[1]["controlNumber"].lower()))
    return [
        _prompt_peer(peer)
        for _, peer in ranked[:MAX_COMPARE_PEERS]
    ]


def _prompt_peer(peer: dict) -> dict:
    payload = {"controlNumber": peer["controlNumber"]}
    for key in ("riskDescription", "controlObjective", "standardControlDescription"):
        value = _clip(peer[key])
        if value:
            payload[key] = value
    return payload


def not_addressed_result() -> dict:
    return {
        "addressedStatus": "Not addressed",
        "addressedBy": [],
        "reason": _NOT_ADDRESSED_REASON,
    }


def sanitize_comparison(parsed: dict, shortlist: list[dict]) -> dict:
    allowed = {item["controlNumber"].lower(): item["controlNumber"] for item in shortlist}
    status = str(parsed.get("addressedStatus") or "").strip()
    if status not in ADDRESS_STATUSES:
        status = "Not addressed"
    addressed: list[str] = []
    for item in parsed.get("addressedBy") or []:
        number = str(item or "").strip()
        canonical = allowed.get(number.lower())
        if canonical and canonical not in addressed:
            addressed.append(canonical)
    if status != "Not addressed" and not addressed:
        status = "Not addressed"
    if status == "Not addressed":
        addressed = []
    reason = " ".join(str(parsed.get("reason") or "").split())
    if len(reason) > MAX_REASON_CHARS:
        reason = reason[: MAX_REASON_CHARS - 1].rstrip() + "…"
    if not reason:
        reason = _STATUS_REASONS[status]
    return {
        "addressedStatus": status,
        "addressedBy": addressed,
        "reason": reason,
    }


def build_compare_prompts(risk: str, shortlist: list[dict]) -> tuple[str, str]:
    schema = json.loads((PACKAGE_DIR / "compare_schema.json").read_text(encoding="utf-8"))
    user_prompt = load_text("compare_user_prompt.txt").replace("{risk}", risk).replace(
        "{peers}", json.dumps(shortlist, ensure_ascii=False)
    )
    user_prompt = f"{user_prompt}\n\nSchema: {json.dumps(schema, ensure_ascii=False)}"
    return load_text("compare_system_prompt.txt"), user_prompt


def compare_risk(risk: str, peers: list[dict], *, dry_run: bool = False) -> dict:
    selected = " ".join(str(risk or "").split())
    if not selected:
        raise ValueError("risk is required")
    dry_run = is_risk_analysis_dry_run_enabled(dry_run)
    shortlist = select_relevant_peers(selected, peers if isinstance(peers, list) else [])
    provider = provider_name()
    if not shortlist:
        return {
            "provider": provider,
            "model_name": None,
            "dry_run": False,
            "comparison": not_addressed_result(),
        }

    system_prompt, user_prompt = build_compare_prompts(selected, shortlist)
    if dry_run:
        model = resolve_model()
        dry_run_txt = "\n".join(
            [
                "RISK COMPARISON DRY RUN — INPUT PROMPT",
                f"provider: {provider}",
                f"model: {model}",
                "",
                "=== SYSTEM PROMPT ===",
                system_prompt,
                "",
                "=== USER PROMPT ===",
                user_prompt,
                "",
            ]
        )
        return {
            "provider": provider,
            "model_name": model,
            "dry_run": True,
            "comparison": None,
            "dry_run_txt": dry_run_txt,
        }

    parsed, model = complete_comparison_json(system_prompt, user_prompt)
    return {
        "provider": provider,
        "model_name": model,
        "dry_run": False,
        "comparison": sanitize_comparison(parsed, shortlist),
    }
