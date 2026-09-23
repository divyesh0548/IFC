from __future__ import annotations

import re
from pathlib import Path
from typing import Any

from .prompts import SYSTEM_PROMPT, build_user_prompt


def _safe_filename_part(value: Any, fallback: str = "unknown") -> str:
    text = str(value or "").strip() or fallback
    text = re.sub(r"[^\w.\-]+", "_", text)
    return text[:80] or fallback


def write_dry_run_prompt(
    out_dir: Path,
    *,
    control: dict[str, Any],
    payload: dict[str, Any],
    model: str,
    index: int,
) -> Path:
    """
    Save the exact system + user prompt that would be sent to OpenRouter.
    No API call is made.
    """
    out_dir.mkdir(parents=True, exist_ok=True)
    form_id = _safe_filename_part(control.get("form_id"), "no_form_id")
    cn = _safe_filename_part(control.get("control_number"), "no_cn")
    path = out_dir / f"{index:03d}_{cn}_{form_id}_prompt.txt"

    user_prompt = build_user_prompt(payload)
    eligible_ids = [c.get("id") for c in (payload.get("checks") or [])]

    body = "\n".join(
        [
            "=" * 72,
            "DESIGN GAP — DRY RUN PROMPT (not sent to OpenRouter)",
            "=" * 72,
            f"form_id: {control.get('form_id')}",
            f"control_number: {control.get('control_number')}",
            f"company_identifier: {control.get('company_identifier')}",
            f"unit_id: {control.get('unit_id')}",
            f"business_process: {control.get('business_process')}",
            f"financial_year: {control.get('financial_year')}",
            f"model (would use): {model}",
            f"eligible_checks: {eligible_ids}",
            "",
            "-" * 72,
            "SYSTEM MESSAGE",
            "-" * 72,
            SYSTEM_PROMPT,
            "",
            "-" * 72,
            "USER MESSAGE",
            "-" * 72,
            user_prompt,
            "",
        ]
    )
    path.write_text(body, encoding="utf-8")
    return path
