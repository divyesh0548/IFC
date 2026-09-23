#!/usr/bin/env python3
"""
Standalone design-gap audit runner.

Edit the RUN CONFIG block below, then:
  python run_design_gap.py
"""
from __future__ import annotations

import sys
import time
from datetime import datetime, timezone
from pathlib import Path

from design_gap_lib.config import load_column_map, load_env, resolve_settings
from design_gap_lib.dry_run import write_dry_run_prompt
from design_gap_lib.extract import fetch_controls
from design_gap_lib.gates import build_control_payload, partition_checks
from design_gap_lib.openrouter_client import OpenRouterError, review_control
from design_gap_lib.prompts import default_summary_for_status, derive_control_design_status
from design_gap_lib.report import enrich_control_overall, write_reports

# ---------------------------------------------------------------------------
# RUN CONFIG — edit these values before running
# ---------------------------------------------------------------------------
COMPANY = "ALEMBI3C6C"          # company_identifier (required)
UNIT = "API1XX87A3"                      # unit_id, or None for all units
BUSINESS_PROCESS = "Purchase to Pay"           # e.g. "Procure to Pay", or None
FINANCIAL_YEAR = "2026-27"             # e.g. "FY25", or None
LIMIT = 2                        # max controls to review
ACTIVE_ONLY = False                # False → include inactive controls
DRY_RUN = False                # True → no OpenRouter; save prompts to text files
SLEEP_MS = 0                      # delay between OpenRouter calls (rate limiting)
COLUMN_MAP_PATH = None            # Path to column_map.yaml, or None for default
OUT_DIR = Path(__file__).resolve().parent / "output"
# ---------------------------------------------------------------------------


def main() -> int:
    load_env()
    column_map = load_column_map(COLUMN_MAP_PATH)
    # Dry-run only needs DB; OpenRouter key is optional until DRY_RUN=False
    settings = resolve_settings(column_map, require_api_key=not DRY_RUN)
    checks = column_map["checks"]
    allowed_catalog = column_map.get("allowed_value_catalog")

    if not str(COMPANY or "").strip() or COMPANY == "YOUR_COMPANY":
        print(
            "Set COMPANY (and other filters) in the RUN CONFIG block at the top of "
            "run_design_gap.py, then run again.",
            file=sys.stderr,
        )
        return 1

    prompt_dir = OUT_DIR / "dry_run_prompts"
    print(
        f"Loading controls: company={COMPANY!r} unit={UNIT!r} "
        f"bp={BUSINESS_PROCESS!r} fy={FINANCIAL_YEAR!r} limit={LIMIT} "
        f"dry_run={DRY_RUN}"
    )
    controls = fetch_controls(
        settings.database_url,
        company=COMPANY,
        unit=UNIT,
        business_process=BUSINESS_PROCESS,
        financial_year=FINANCIAL_YEAR,
        limit=LIMIT,
        active_only=ACTIVE_ONLY,
    )
    print(f"Loaded {len(controls)} control(s). Model={settings.model}")
    if DRY_RUN:
        print(f"DRY_RUN: prompts will be saved under {prompt_dir}")

    control_results = []
    for idx, control in enumerate(controls, start=1):
        form_id = control.get("form_id")
        cn = control.get("control_number")
        eligible, precheck_results = partition_checks(control, checks)
        print(
            f"[{idx}/{len(controls)}] {cn or form_id}: "
            f"eligible={len(eligible)} skipped_precheck={len(precheck_results)}"
        )

        ai_results: list = []
        raw_ai_json = None
        usage = {
            "skipped": True,
            "prompt_tokens": 0,
            "completion_tokens": 0,
            "total_tokens": 0,
        }
        control_design_status = None
        summary = None

        if eligible and not DRY_RUN:
            payload = build_control_payload(
                control,
                eligible,
                settings.max_field_chars,
                allowed_catalog=allowed_catalog,
            )
            try:
                ai_results, usage, raw_ai_json = review_control(
                    settings, payload, eligible
                )
                control_design_status = usage.get("control_design_status")
                summary = usage.get("summary")
            except OpenRouterError as exc:
                print(f"  OpenRouter error: {exc}", file=sys.stderr)
                ai_results = [
                    {
                        "check_id": c["id"],
                        "statement": c["statement"],
                        "status": "insufficient_data",
                        "severity": "info",
                        "inconsistency": f"OpenRouter call failed: {exc}",
                        "evidence": [],
                        "recommendation": "Retry later.",
                        "source": "openrouter_error",
                    }
                    for c in eligible
                ]
                raw_ai_json = {
                    "control_design_status": "insufficient_data",
                    "summary": f"OpenRouter call failed: {exc}",
                    "results": ai_results,
                    "source": "openrouter_error",
                }
            if SLEEP_MS > 0:
                time.sleep(SLEEP_MS / 1000.0)
        elif eligible and DRY_RUN:
            payload = build_control_payload(
                control,
                eligible,
                settings.max_field_chars,
                allowed_catalog=allowed_catalog,
            )
            prompt_path = write_dry_run_prompt(
                prompt_dir,
                control=control,
                payload=payload,
                model=settings.model,
                index=idx,
            )
            print(f"  dry-run prompt -> {prompt_path}")
            ai_results = [
                {
                    "check_id": c["id"],
                    "statement": c["statement"],
                    "status": "insufficient_data",
                    "severity": "info",
                    "inconsistency": (
                        f"Dry-run: prompt saved to {prompt_path.name}; "
                        "OpenRouter not called."
                    ),
                    "evidence": [],
                    "recommendation": "",
                    "source": "dry_run",
                }
                for c in eligible
            ]
            raw_ai_json = {
                "control_design_status": "insufficient_data",
                "summary": "Dry-run: prompt saved locally; OpenRouter not called.",
                "results": ai_results,
                "source": "dry_run",
                "prompt_file": str(prompt_path),
            }
        elif not eligible:
            print("  (no eligible checks — no prompt file)")

        merged = precheck_results + ai_results
        order = {c["id"]: i for i, c in enumerate(checks)}
        merged.sort(key=lambda r: order.get(r.get("check_id"), 999))

        if control_design_status is None:
            control_design_status = derive_control_design_status(merged)
        if summary is None:
            summary = default_summary_for_status(control_design_status)

        row = enrich_control_overall(
            {
                "form_id": form_id,
                "control_number": cn,
                "company_identifier": control.get("company_identifier"),
                "unit_id": control.get("unit_id"),
                "business_process": control.get("business_process"),
                "financial_year": control.get("financial_year"),
                "control_design_status": control_design_status,
                "summary": summary,
                "usage": usage,
                "results": merged,
                "ai_response_json": raw_ai_json,
            }
        )
        print(f"  -> {row['control_design_status']}: {row['summary']}")
        control_results.append(row)

    meta = {
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "model": settings.model,
        "company": COMPANY,
        "unit": UNIT,
        "business_process": BUSINESS_PROCESS,
        "financial_year": FINANCIAL_YEAR,
        "limit": LIMIT,
        "dry_run": DRY_RUN,
        "checks_configured": [c["id"] for c in checks],
    }
    json_path, md_path, xlsx_path = write_reports(
        OUT_DIR, meta=meta, control_results=control_results
    )
    print(f"Wrote {json_path}")
    print(f"Wrote {md_path}")
    print(f"Wrote {xlsx_path}")
    if DRY_RUN:
        print(f"Dry-run prompts: {prompt_dir}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
