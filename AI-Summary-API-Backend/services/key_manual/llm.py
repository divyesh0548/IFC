from __future__ import annotations

import json
import os
from typing import Any

import requests

from services.design_gap.design_gap_lib.config import load_env

PACKAGE_DIR = __import__("pathlib").Path(__file__).resolve().parent

SUMMARY_FIELDS = (
    "controlNumber",
    "currentManualActivity",
    "automationOpportunity",
    "proposedSolution",
    "benefit",
    "dependency",
    "residualRiskOrLimitation",
)


def load_text(name: str) -> str:
    return (PACKAGE_DIR / name).read_text(encoding="utf-8").strip()


def provider_name() -> str:
    load_env()
    value = (os.getenv("KEY_MANUAL_PROVIDER") or "openrouter").strip().lower()
    if value not in {"openrouter", "ollama"}:
        raise RuntimeError("KEY_MANUAL_PROVIDER must be openrouter or ollama")
    return value


def resolve_model() -> str:
    load_env()
    if provider_name() == "ollama":
        model = (os.getenv("KEY_MANUAL_OLLAMA_MODEL") or os.getenv("OLLAMA_MODEL") or "").strip()
        if not model:
            raise RuntimeError("KEY_MANUAL_OLLAMA_MODEL is not set")
        return model
    model = (os.getenv("KEY_MANUAL_MODEL") or os.getenv("DESIGN_GAP_MODEL") or "").strip()
    if not model:
        raise RuntimeError("KEY_MANUAL_MODEL or DESIGN_GAP_MODEL is not set")
    return model


def complete_json(system_prompt: str, user_prompt: str) -> tuple[dict[str, Any], str]:
    provider = provider_name()
    model = resolve_model()
    if provider == "ollama":
        return _complete_ollama(model, system_prompt, user_prompt), model
    return _complete_openrouter(model, system_prompt, user_prompt), model


def _complete_openrouter(model: str, system_prompt: str, user_prompt: str) -> dict[str, Any]:
    api_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
    if not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set")
    base_url = (os.getenv("OPENROUTER_BASE_URL") or "https://openrouter.ai/api/v1").rstrip("/")
    response = requests.post(
        f"{base_url}/chat/completions",
        headers={
            "Authorization": f"Bearer {api_key}",
            "Content-Type": "application/json",
        },
        json={
            "model": model,
            "temperature": 0,
            "max_tokens": 1600,
            "response_format": {"type": "json_object"},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        },
        timeout=180,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"OpenRouter HTTP {response.status_code}: {response.text[:800]}")
    content = response.json()["choices"][0]["message"]["content"]
    return _parse_json(content)


def _complete_ollama(model: str, system_prompt: str, user_prompt: str) -> dict[str, Any]:
    url = (os.getenv("KEY_MANUAL_OLLAMA_URL") or os.getenv("OLLAMA_CHAT_URL") or "").strip()
    if not url:
        raise RuntimeError("KEY_MANUAL_OLLAMA_URL is not set")
    schema = json.loads((PACKAGE_DIR / "schema.json").read_text(encoding="utf-8"))
    response = requests.post(
        url,
        json={
            "model": model,
            "stream": False,
            "format": schema,
            "options": {"temperature": 0, "num_predict": 1200, "top_p": 0.9},
            "messages": [
                {"role": "system", "content": system_prompt},
                {"role": "user", "content": user_prompt},
            ],
        },
        timeout=int(os.getenv("OLLAMA_REQUEST_TIMEOUT_MS") or "600000") / 1000,
    )
    if response.status_code >= 400:
        raise RuntimeError(f"Ollama HTTP {response.status_code}: {response.text[:800]}")
    content = str((response.json().get("message") or {}).get("content") or "").strip()
    if not content:
        raise RuntimeError("Ollama response content is empty.")
    return _parse_json(content)


def _parse_json(content: str) -> dict[str, Any]:
    text = (content or "").strip()
    if text.startswith("```"):
        lines = text.splitlines()
        if lines and lines[0].startswith("```"):
            lines = lines[1:]
        if lines and lines[-1].strip().startswith("```"):
            lines = lines[:-1]
        text = "\n".join(lines).strip()
    parsed = json.loads(text)
    if not isinstance(parsed, dict):
        raise RuntimeError("Key manual response is not a JSON object.")
    cleaned: dict[str, str] = {}
    for key in SUMMARY_FIELDS:
        value = str(parsed.get(key) or "").strip()
        if not value:
            raise RuntimeError(f"Key manual response is missing {key}.")
        cleaned[key] = value
    return cleaned
