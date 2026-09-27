from __future__ import annotations

import json
import os

from .catalog import candidate_sub_processes, load_master
from .llm import PACKAGE_DIR, complete_json, load_text, provider_name, resolve_model
from .sanitize import resolve_matched_candidate, sanitize_result


def is_risk_analysis_dry_run_enabled(request_dry_run: bool = False) -> bool:
    if request_dry_run:
        return True
    return (os.getenv("RISK_ANALYSIS_DRY_RUN") or "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def build_prompts(control: dict, business_process: str) -> tuple[str, str, list[dict]]:
    master = load_master(business_process)
    candidates = candidate_sub_processes(master)
    names = [item["subProcess"] for item in candidates]
    schema = json.loads((PACKAGE_DIR / "schema.json").read_text(encoding="utf-8"))
    user_prompt = "\n".join(
        [
            load_text("user_prompt.txt").replace("{business_process}", business_process),
            "",
            f"Schema: {json.dumps(schema)}",
            f"Candidate sub-process names: {json.dumps(names)}",
            "",
            f"Input control: {json.dumps(control)}",
            f"Candidate sub-processes: {json.dumps(candidates)}",
        ]
    )
    return load_text("system_prompt.txt"), user_prompt, candidates


def format_dry_run_txt(
    *,
    control: dict,
    business_process: str,
    form_id: str,
    provider: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
) -> str:
    control_number = str(control.get("controlNumber") or control.get("control_number") or "").strip()
    lines = [
        "RISK ANALYSIS DRY RUN — INPUT PROMPT",
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


def analyze_control(
    control: dict,
    business_process: str,
    *,
    dry_run: bool = False,
    form_id: str = "",
) -> dict:
    dry_run = is_risk_analysis_dry_run_enabled(dry_run)
    system_prompt, user_prompt, candidates = build_prompts(control, business_process)
    provider = provider_name()
    model = resolve_model()
    if dry_run:
        return {
            "provider": provider,
            "model_name": model,
            "dry_run": True,
            "analysis": None,
            "dry_run_txt": format_dry_run_txt(
                control=control,
                business_process=business_process,
                form_id=form_id,
                provider=provider,
                model=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            ),
            "dry_run_prompt": {
                "provider": provider,
                "model": model,
                "system": system_prompt,
                "user": user_prompt,
            },
        }

    parsed, model = complete_json(system_prompt, user_prompt)
    matched = resolve_matched_candidate(str(parsed.get("matchedSubProcess") or ""), candidates)
    analysis = sanitize_result(parsed, matched, control)
    return {
        "provider": provider,
        "model_name": model,
        "dry_run": False,
        "analysis": analysis,
    }
