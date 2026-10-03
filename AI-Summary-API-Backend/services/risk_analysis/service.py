from __future__ import annotations

import json
import os

from .llm import PACKAGE_DIR, complete_json, load_text, provider_name, resolve_model


def is_risk_analysis_dry_run_enabled(request_dry_run: bool = False) -> bool:
    if request_dry_run:
        return True
    return (os.getenv("RISK_ANALYSIS_DRY_RUN") or "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def _schema_text(name: str) -> str:
    return json.dumps(json.loads((PACKAGE_DIR / name).read_text(encoding="utf-8")))


def _env_int(name: str, default: int) -> int:
    raw = (os.getenv(name) or "").strip()
    if not raw:
        return default
    try:
        return int(raw)
    except ValueError:
        return default


def _clean_concise_risks(parsed: dict, _controls: list[dict]) -> list[dict]:
    cleaned = []
    seen: dict[str, dict] = {}
    for item in parsed.get("risks") or []:
        if not isinstance(item, dict):
            continue
        sub_process = " ".join(
            str(item.get("subProcess") or item.get("sub_process") or "").split()
        ).strip()
        risk = " ".join(str(item.get("risk") or "").split()).strip()
        if not sub_process or not risk:
            continue
        key = f"{sub_process.lower()}\u0001{risk.lower()}"
        if seen.get(key):
            continue
        entry = {
            "subProcess": sub_process,
            "risk": risk,
        }
        seen[key] = entry
        cleaned.append(entry)
    return cleaned


def _merge_concise_risks(groups: list[list[dict]]) -> list[dict]:
    merged: list[dict] = []
    seen: dict[str, dict] = {}
    for group in groups:
        for item in group:
            if not isinstance(item, dict):
                continue
            risk = " ".join(str(item.get("risk") or "").split()).strip()
            sub_process = " ".join(
                str(item.get("subProcess") or item.get("sub_process") or "").split()
            ).strip()
            if not sub_process or not risk:
                continue
            key = f"{sub_process.lower()}\u0001{risk.lower()}"
            if seen.get(key):
                continue
            entry = {
                "subProcess": sub_process,
                "risk": risk,
            }
            seen[key] = entry
            merged.append(entry)
    return merged


def _concise_batches(pairs: list[dict]) -> list[list[dict]]:
    max_items = max(1, _env_int("RISK_ANALYSIS_CONCISE_BATCH_SIZE", 20))
    max_chars = max(1000, _env_int("RISK_ANALYSIS_CONCISE_BATCH_CHARS", 12000))
    batches: list[list[dict]] = []
    current: list[dict] = []
    current_chars = 0
    for pair in pairs:
        pair_chars = len(json.dumps(pair, ensure_ascii=False))
        if current and (len(current) >= max_items or current_chars + pair_chars > max_chars):
            batches.append(current)
            current = []
            current_chars = 0
        current.append(pair)
        current_chars += pair_chars
    if current:
        batches.append(current)
    return batches


def _complete_concise_batch(
    business_process: str,
    batch: list[dict],
    *,
    max_tokens: int,
) -> tuple[list[dict], str]:
    system_prompt, user_prompt = _build_concise_prompts(business_process, batch)
    try:
        parsed, model = complete_json(
            system_prompt,
            user_prompt,
            schema_name="concise_schema.json",
            max_tokens=max_tokens,
        )
        return _clean_concise_risks(parsed, batch), model
    except RuntimeError as exc:
        message = str(exc).lower()
        can_split = len(batch) > 1 and (
            "invalid json" in message
            or "truncated" in message
            or "unterminated string" in message
        )
        if not can_split:
            raise
        midpoint = max(1, len(batch) // 2)
        left, model = _complete_concise_batch(
            business_process,
            batch[:midpoint],
            max_tokens=max_tokens,
        )
        right, model = _complete_concise_batch(
            business_process,
            batch[midpoint:],
            max_tokens=max_tokens,
        )
        return _merge_concise_risks([left, right]), model


def _build_concise_prompts(business_process: str, controls: list[dict]) -> tuple[str, str]:
    user_prompt = (
        load_text("concise_user_prompt.txt")
        .replace("{business_process}", business_process)
        .replace("{controls_json}", json.dumps(controls, ensure_ascii=False))
        .replace("{schema_json}", _schema_text("concise_schema.json"))
    )
    return load_text("concise_system_prompt.txt"), user_prompt


def format_dry_run_txt(
    *,
    title: str,
    control: dict | None,
    business_process: str,
    form_id: str,
    provider: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
) -> str:
    control_number = ""
    if isinstance(control, dict):
        control_number = str(control.get("controlNumber") or control.get("control_number") or "").strip()
    lines = [
        title,
        f"control_number: {control_number}",
        f"form_id: {form_id}",
        f"business_process: {business_process}",
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
    return "\n".join(lines)


def condense_risks(
    controls: list[dict],
    business_process: str,
    *,
    dry_run: bool = False,
) -> dict:
    pairs = []
    for item in controls:
        if not isinstance(item, dict):
            continue
        sub_process = " ".join(
            str(item.get("subProcess") or item.get("sub_process") or "").split()
        ).strip()
        risk = " ".join(str(item.get("riskDescription") or item.get("risk_description") or "").split()).strip()
        if sub_process and risk:
            pairs.append({
                "subProcess": sub_process,
                "riskDescription": risk,
            })
    if not pairs:
        raise ValueError("No sub-process and risk descriptions are available for this unit and business process")

    dry_run = is_risk_analysis_dry_run_enabled(dry_run)
    system_prompt, user_prompt = _build_concise_prompts(business_process, pairs)
    provider = provider_name()
    model = resolve_model()
    if dry_run:
        return {
            "provider": provider,
            "model_name": model,
            "dry_run": True,
            "risks": None,
            "dry_run_txt": format_dry_run_txt(
                title="RISK ANALYSIS CONCISE LIST DRY RUN — INPUT PROMPT",
                control=None,
                business_process=business_process,
                form_id="",
                provider=provider,
                model=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            ),
        }

    max_tokens = _env_int("RISK_ANALYSIS_CONCISE_MAX_TOKENS", 1800)
    risk_groups = []
    for batch in _concise_batches(pairs):
        batch_risks, model = _complete_concise_batch(
            business_process,
            batch,
            max_tokens=max_tokens,
        )
        risk_groups.append(batch_risks)
    risks = _merge_concise_risks(risk_groups)
    if not risks:
        raise RuntimeError("Concise risk list did not return any risks")
    return {
        "provider": provider,
        "model_name": model,
        "dry_run": False,
        "risks": risks,
    }


def build_prompts(
    control: dict,
    business_process: str,
    concise_risks: list[dict],
    business_process_overview: str,
) -> tuple[str, str]:
    user_prompt = (
        load_text("user_prompt.txt")
        .replace("{business_process}", business_process)
        .replace("{control_json}", json.dumps(control, ensure_ascii=False))
        .replace("{concise_risks_json}", json.dumps(concise_risks, ensure_ascii=False))
        .replace("{schema_json}", _schema_text("schema.json"))
    )
    system_prompt = load_text("system_prompt.txt").replace(
        "{business_process_overview}",
        business_process_overview,
    )
    return system_prompt, user_prompt


def build_overall_missing_prompts(
    business_process: str,
    concise_risks: list[dict],
    business_process_overview: str,
) -> tuple[str, str]:
    user_prompt = (
        load_text("overall_missing_user_prompt.txt")
        .replace("{business_process}", business_process)
        .replace("{concise_risks_json}", json.dumps(concise_risks, ensure_ascii=False))
        .replace("{schema_json}", _schema_text("overall_missing_schema.json"))
    )
    system_prompt = load_text("overall_missing_system_prompt.txt").replace(
        "{business_process_overview}",
        business_process_overview,
    )
    return system_prompt, user_prompt


def _clean_analysis(parsed: dict, concise_risks: list[dict]) -> dict:
    known: dict[str, str] = {}
    for item in concise_risks:
        if not isinstance(item, dict):
            continue
        for number in item.get("controlNumbers") or []:
            text = str(number or "").strip()
            if text:
                known[text.lower()] = text

    risks = []
    missing_risks = []
    pointers = []
    comparisons = {}
    seen: set[str] = set()
    for item in parsed.get("risks") or []:
        if not isinstance(item, dict):
            continue
        risk = " ".join(str(item.get("risk") or "").split()).strip()
        if not risk or risk.lower() in seen:
            continue
        seen.add(risk.lower())
        pointer = " ".join(str(item.get("pointer") or "").split()).strip()
        sub_process = " ".join(
            str(item.get("subProcess") or item.get("sub_process") or "").split()
        ).strip()
        status = " ".join(str(item.get("status") or "").split()).strip().lower()
        addressed_by = []
        for raw in item.get("addressedBy") or []:
            canonical = known.get(str(raw or "").strip().lower())
            if canonical and canonical not in addressed_by:
                addressed_by.append(canonical)
        is_partial = "partial" in status
        is_addressed = (
            "address" in status
            and "missing" not in status
            and "not" not in status
            and len(addressed_by) > 0
        )
        if is_addressed and not is_partial:
            continue
        if is_partial:
            risks.append({
                "risk": risk,
                "status": "Partially Covered Risk",
                "addressedBy": addressed_by,
                "pointer": pointer,
                "subProcess": sub_process,
            })
            comparisons[risk] = {
                "addressedStatus": "Partially addressed",
                "addressedBy": addressed_by,
                "reason": pointer or "This risk is only partially covered by existing controls in this unit and business process.",
            }
            missing_risks.append(risk)
            pointers.append({
                "risk": risk,
                "pointer": pointer or risk,
                "subProcess": sub_process,
                "addressedBy": addressed_by,
            })
        else:
            risks.append({
                "risk": risk,
                "status": "Missing Risk",
                "addressedBy": [],
                "pointer": pointer,
                "subProcess": sub_process,
            })
            missing_risks.append(risk)
            pointers.append({
                "risk": risk,
                "pointer": pointer or risk,
                "subProcess": sub_process,
            })

    return {
        "risks": risks,
        "missingRisks": missing_risks,
        "missingRiskPointers": pointers,
        "riskComparisons": comparisons,
        "matchedSubProcess": None,
        "matchConfidence": None,
        "coverageStatus": "Missing or partially covered risks" if missing_risks else "No missing risks",
    }


def _clean_overall_missing_analysis(parsed: dict) -> dict:
    risks = []
    missing_risks = []
    pointers = []
    seen: set[str] = set()
    for item in parsed.get("risks") or []:
        if not isinstance(item, dict):
            continue
        risk = " ".join(str(item.get("risk") or "").split()).strip()
        sub_process = " ".join(
            str(item.get("subProcess") or item.get("sub_process") or "").split()
        ).strip()
        if not risk or not sub_process:
            continue
        key = f"{sub_process.lower()}\u0001{risk.lower()}"
        if key in seen:
            continue
        seen.add(key)
        pointer = risk
        entry = {
            "risk": risk,
            "status": "Missing Risk",
            "addressedBy": [],
            "pointer": pointer,
            "subProcess": sub_process,
        }
        risks.append(entry)
        missing_risks.append(risk)
        pointers.append({
            "risk": risk,
            "pointer": pointer,
            "subProcess": sub_process,
        })
    return {
        "risks": risks,
        "missingRisks": missing_risks,
        "missingRiskPointers": pointers,
        "riskComparisons": {},
        "matchedSubProcess": None,
        "matchConfidence": None,
        "coverageStatus": "Missing risks" if missing_risks else "No missing risks",
    }


def analyze_control(
    control: dict,
    business_process: str,
    *,
    concise_risks: list[dict] | None = None,
    business_process_overview: str = "",
    dry_run: bool = False,
    form_id: str = "",
) -> dict:
    if not isinstance(concise_risks, list):
        raise ValueError("concise_risks is required")
    business_process_overview = str(business_process_overview or "").strip()
    if not business_process_overview:
        raise ValueError("business_process_overview is required")
    dry_run = is_risk_analysis_dry_run_enabled(dry_run)
    system_prompt, user_prompt = build_prompts(
        control,
        business_process,
        concise_risks,
        business_process_overview,
    )
    provider = provider_name()
    model = resolve_model()
    if dry_run:
        return {
            "provider": provider,
            "model_name": model,
            "dry_run": True,
            "analysis": None,
            "dry_run_txt": format_dry_run_txt(
                title="RISK ANALYSIS DRY RUN — INPUT PROMPT",
                control=control,
                business_process=business_process,
                form_id=form_id,
                provider=provider,
                model=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            ),
        }

    parsed, model = complete_json(
        system_prompt,
        user_prompt,
        schema_name="schema.json",
        max_tokens=_env_int("RISK_ANALYSIS_MAX_TOKENS", 4000),
    )
    return {
        "provider": provider,
        "model_name": model,
        "dry_run": False,
        "analysis": _clean_analysis(parsed, concise_risks),
    }


def analyze_business_process_missing_risks(
    business_process: str,
    *,
    concise_risks: list[dict] | None = None,
    business_process_overview: str = "",
    dry_run: bool = False,
) -> dict:
    if not isinstance(concise_risks, list):
        raise ValueError("concise_risks is required")
    business_process_overview = str(business_process_overview or "").strip()
    if not business_process_overview:
        raise ValueError("business_process_overview is required")
    dry_run = is_risk_analysis_dry_run_enabled(dry_run)
    system_prompt, user_prompt = build_overall_missing_prompts(
        business_process,
        concise_risks,
        business_process_overview,
    )
    provider = provider_name()
    model = resolve_model()
    if dry_run:
        return {
            "provider": provider,
            "model_name": model,
            "dry_run": True,
            "analysis": None,
            "dry_run_txt": format_dry_run_txt(
                title="OVERALL MISSING RISK ANALYSIS DRY RUN — INPUT PROMPT",
                control=None,
                business_process=business_process,
                form_id="",
                provider=provider,
                model=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            ),
        }

    parsed, model = complete_json(
        system_prompt,
        user_prompt,
        schema_name="overall_missing_schema.json",
        max_tokens=_env_int("RISK_ANALYSIS_OVERALL_MAX_TOKENS", 8000),
    )
    return {
        "provider": provider,
        "model_name": model,
        "dry_run": False,
        "analysis": _clean_overall_missing_analysis(parsed),
    }
