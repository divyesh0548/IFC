from __future__ import annotations

import json
from typing import Any

import requests

from .config import Settings
from .prompts import SYSTEM_PROMPT, build_user_prompt, normalize_ai_results


class OpenRouterError(RuntimeError):
    pass


def review_control(
    settings: Settings,
    payload: dict[str, Any],
    eligible_checks: list[dict[str, Any]],
) -> tuple[list[dict[str, Any]], dict[str, Any], dict[str, Any] | None]:
    """
    One OpenRouter chat completion for a single control.
    Returns (normalized_results, usage_meta, raw_ai_json).
    """
    if not eligible_checks:
        return (
            [],
            {"skipped": True, "prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0},
            None,
        )

    url = f"{settings.openrouter_base_url}/chat/completions"
    headers = {
        "Authorization": f"Bearer {settings.api_key}",
        "Content-Type": "application/json",
    }
    if settings.http_referer:
        headers["HTTP-Referer"] = settings.http_referer
    if settings.app_title:
        headers["X-Title"] = settings.app_title

    body = {
        "model": settings.model,
        "temperature": settings.temperature,
        "max_tokens": settings.max_tokens,
        "response_format": {"type": "json_object"},
        "messages": [
            {"role": "system", "content": SYSTEM_PROMPT},
            {"role": "user", "content": build_user_prompt(payload)},
        ],
    }

    resp = requests.post(url, headers=headers, json=body, timeout=180)
    if resp.status_code >= 400:
        raise OpenRouterError(
            f"OpenRouter HTTP {resp.status_code}: {resp.text[:800]}"
        )

    data = resp.json()
    try:
        content = data["choices"][0]["message"]["content"]
    except (KeyError, IndexError, TypeError) as exc:
        raise OpenRouterError(f"Unexpected OpenRouter response: {data!r}") from exc

    parsed = _parse_json_content(content)
    results, control_design_status, summary = normalize_ai_results(
        parsed, eligible_checks
    )

    # Ensure stored AI JSON always includes the overall status fields
    raw_ai: dict[str, Any]
    if isinstance(parsed, dict):
        raw_ai = dict(parsed)
    else:
        raw_ai = {"results": parsed}
    raw_ai["control_design_status"] = control_design_status
    raw_ai["summary"] = summary

    usage = data.get("usage") or {}
    meta = {
        "skipped": False,
        "model": data.get("model") or settings.model,
        "prompt_tokens": int(usage.get("prompt_tokens") or 0),
        "completion_tokens": int(usage.get("completion_tokens") or 0),
        "total_tokens": int(usage.get("total_tokens") or 0),
        "raw_content_chars": len(content or ""),
        "control_design_status": control_design_status,
        "summary": summary,
    }
    return results, meta, raw_ai


def _parse_json_content(content: str) -> dict[str, Any] | list[Any]:
    text = (content or "").strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    try:
        return json.loads(text)
    except json.JSONDecodeError as exc:
        raise OpenRouterError(f"Model returned non-JSON content: {text[:500]}") from exc
