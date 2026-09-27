from __future__ import annotations

import json

from .llm import PACKAGE_DIR, complete_json, load_text, provider_name, resolve_model


def analyze_control(control: dict, business_process: str, company_identifier: str = "") -> dict:
    schema = json.loads((PACKAGE_DIR / "schema.json").read_text(encoding="utf-8"))
    user_prompt = "\n".join(
        [
            load_text("user_prompt.txt")
            .replace("{company_identifier}", str(company_identifier or "").strip())
            .replace("{business_process}", str(business_process or "").strip()),
            "",
            f"Schema: {json.dumps(schema)}",
            "",
            "Use the exact input controlNumber value in the output.",
            f"Input control: {json.dumps(control)}",
        ]
    )
    parsed, model = complete_json(load_text("system_prompt.txt"), user_prompt)
    expected = str(control.get("controlNumber") or "").strip()
    returned = str(parsed.get("controlNumber") or "").strip()
    if expected and returned != expected:
        raise RuntimeError(f"Model returned control {returned} for input {expected}")
    return {
        "provider": provider_name(),
        "model_name": model,
        "summary": parsed,
    }


def describe_settings() -> dict:
    return {
        "provider": provider_name(),
        "model": resolve_model(),
    }
