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


def _known_controls(controls: list[dict]) -> dict[str, str]:
    known: dict[str, str] = {}
    for item in controls:
        if not isinstance(item, dict):
            continue
        number = str(item.get("controlNumber") or item.get("control_number") or "").strip()
        if number:
            known[number.lower()] = number
    return known


def _clean_concise_risks(parsed: dict, controls: list[dict]) -> list[dict]:
    known = _known_controls(controls)
    cleaned = []
    seen: set[str] = set()
    for item in parsed.get("risks") or []:
        if not isinstance(item, dict):
            continue
        risk = " ".join(str(item.get("risk") or "").split()).strip()
        if not risk:
            continue
        numbers = []
        for raw in item.get("controlNumbers") or []:
            canonical = known.get(str(raw or "").strip().lower())
            if canonical and canonical not in numbers:
                numbers.append(canonical)
        if not numbers:
            continue
        key = risk.lower()
        if key in seen:
            continue
        seen.add(key)
        cleaned.append({"risk": risk, "controlNumbers": numbers})
    return cleaned


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
        number = str(item.get("controlNumber") or item.get("control_number") or "").strip()
        risk = " ".join(str(item.get("riskDescription") or item.get("risk_description") or "").split()).strip()
        if number and risk:
            pairs.append({"controlNumber": number, "riskDescription": risk})
    if not pairs:
        raise ValueError("No risk descriptions are available for this unit and business process")

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

    parsed, model = complete_json(
        system_prompt,
        user_prompt,
        schema_name="concise_schema.json",
        max_tokens=2000,
    )
    risks = _clean_concise_risks(parsed, pairs)
    if not risks:
        raise RuntimeError("Concise risk list did not return any risks")
    return {
        "provider": provider,
        "model_name": model,
        "dry_run": False,
        "risks": risks,
    }


def build_prompts(control: dict, business_process: str, concise_risks: list[dict]) -> tuple[str, str]:
    user_prompt = (
        load_text("user_prompt.txt")
        .replace("{business_process}", business_process)
        .replace("{control_json}", json.dumps(control, ensure_ascii=False))
        .replace("{concise_risks_json}", json.dumps(concise_risks, ensure_ascii=False))
        .replace("{schema_json}", _schema_text("schema.json"))
    )
    return load_text("system_prompt.txt"), user_prompt


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
        status = " ".join(str(item.get("status") or "").split()).strip().lower()
        addressed_by = []
        for raw in item.get("addressedBy") or []:
            canonical = known.get(str(raw or "").strip().lower())
            if canonical and canonical not in addressed_by:
                addressed_by.append(canonical)
        is_addressed = (
            "address" in status
            and "missing" not in status
            and "not" not in status
            and len(addressed_by) > 0
        )
        if is_addressed:
            risks.append({
                "risk": risk,
                "status": "Addressed Risk",
                "addressedBy": addressed_by,
                "pointer": pointer,
            })
            comparisons[risk] = {
                "addressedStatus": "Fully addressed",
                "addressedBy": addressed_by,
                "reason": pointer or "This risk is already recorded on another control in this unit and business process.",
            }
        else:
            risks.append({
                "risk": risk,
                "status": "Missing Risk",
                "addressedBy": [],
                "pointer": pointer,
            })
            missing_risks.append(risk)
            pointers.append({"risk": risk, "pointer": pointer or risk})

    return {
        "risks": risks,
        "missingRisks": missing_risks,
        "missingRiskPointers": pointers,
        "riskComparisons": comparisons,
        "matchedSubProcess": None,
        "matchConfidence": None,
        "coverageStatus": "Missing risks" if missing_risks else "No missing risks",
    }


def analyze_control(
    control: dict,
    business_process: str,
    *,
    concise_risks: list[dict] | None = None,
    dry_run: bool = False,
    form_id: str = "",
) -> dict:
    if not isinstance(concise_risks, list):
        raise ValueError("concise_risks is required")
    dry_run = is_risk_analysis_dry_run_enabled(dry_run)
    system_prompt, user_prompt = build_prompts(control, business_process, concise_risks)
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

    parsed, model = complete_json(system_prompt, user_prompt, schema_name="schema.json", max_tokens=2000)
    return {
        "provider": provider,
        "model_name": model,
        "dry_run": False,
        "analysis": _clean_analysis(parsed, concise_risks),
    }
