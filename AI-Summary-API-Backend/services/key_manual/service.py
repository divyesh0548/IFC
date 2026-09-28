from __future__ import annotations

import json
import os

from .llm import PACKAGE_DIR, complete_json, load_text, provider_name, resolve_model


def is_key_manual_dry_run_enabled(request_dry_run: bool = False) -> bool:
    """True when the request asks for dry_run OR KEY_MANUAL_DRY_RUN is set."""
    if request_dry_run:
        return True
    return (os.getenv("KEY_MANUAL_DRY_RUN") or "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def build_prompts(control: dict, business_process: str, company_identifier: str = "") -> tuple[str, str]:
    template = load_text("user_prompt.txt")
    control_json = json.dumps(control, ensure_ascii=False)
    user_prompt = (
        template.replace("{company_identifier}", str(company_identifier or "").strip())
        .replace("{business_process}", str(business_process or "").strip())
        .replace("{control_json}", control_json)
    )
    if "{control_json}" not in template:
        user_prompt = f"{user_prompt}\n\nInput control: {control_json}"
    return load_text("system_prompt.txt"), user_prompt


def format_dry_run_txt(
    *,
    control: dict,
    business_process: str,
    company_identifier: str,
    provider: str,
    model: str,
    system_prompt: str,
    user_prompt: str,
) -> str:
    control_number = str(control.get("controlNumber") or control.get("control_number") or "").strip()
    lines = [
        "AUTOMATION OPPORTUNITY DRY RUN — INPUT PROMPT",
        f"control_number: {control_number}",
        f"company_identifier: {company_identifier}",
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
    company_identifier: str = "",
    *,
    dry_run: bool = False,
) -> dict:
    dry_run = is_key_manual_dry_run_enabled(dry_run)
    system_prompt, user_prompt = build_prompts(control, business_process, company_identifier)
    provider = provider_name()
    model = resolve_model()
    if dry_run:
        return {
            "provider": provider,
            "model_name": model,
            "dry_run": True,
            "dry_run_txt": format_dry_run_txt(
                control=control,
                business_process=business_process,
                company_identifier=str(company_identifier or "").strip(),
                provider=provider,
                model=model,
                system_prompt=system_prompt,
                user_prompt=user_prompt,
            ),
        }
    parsed, model = complete_json(system_prompt, user_prompt)
    expected = str(control.get("controlNumber") or "").strip()
    returned = str(parsed.get("controlNumber") or "").strip()
    if expected and returned != expected:
        raise RuntimeError(f"Model returned control {returned} for input {expected}")
    return {
        "provider": provider,
        "model_name": model,
        "summary": parsed,
    }


def describe_settings() -> dict:
    return {
        "provider": provider_name(),
        "model": resolve_model(),
    }
