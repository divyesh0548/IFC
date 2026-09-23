from __future__ import annotations

import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from .excel_store import write_excel_store
from .prompts import (
    GOOD_DESIGN_STATUS,
    HAS_GAPS_STATUS,
    default_summary_for_status,
    derive_control_design_status,
)


def write_reports(
    out_dir: Path,
    *,
    meta: dict[str, Any],
    control_results: list[dict[str, Any]],
) -> tuple[Path, Path, Path]:
    out_dir.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(timezone.utc).strftime("%Y%m%dT%H%M%SZ")
    json_path = out_dir / f"design_gap_report_{stamp}.json"
    md_path = out_dir / f"design_gap_report_{stamp}.md"
    xlsx_path = out_dir / f"design_gap_store_{stamp}.xlsx"

    summary = _build_summary(control_results)
    payload = {
        "meta": meta,
        "summary": summary,
        "controls": control_results,
    }
    json_path.write_text(json.dumps(payload, indent=2, ensure_ascii=False), encoding="utf-8")
    md_path.write_text(_to_markdown(meta, summary, control_results), encoding="utf-8")
    write_excel_store(
        xlsx_path,
        control_results=control_results,
        generated_at=str(meta.get("generated_at") or ""),
    )
    return json_path, md_path, xlsx_path


def _build_summary(control_results: list[dict[str, Any]]) -> dict[str, Any]:
    status_counts: Counter[str] = Counter()
    by_check: dict[str, Counter[str]] = {}
    control_status_counts: Counter[str] = Counter()
    api_calls = 0
    tokens = {"prompt_tokens": 0, "completion_tokens": 0, "total_tokens": 0}

    for control in control_results:
        usage = control.get("usage") or {}
        if not usage.get("skipped"):
            api_calls += 1
        for key in tokens:
            tokens[key] += int(usage.get(key) or 0)
        control_status_counts[control.get("control_design_status") or "unknown"] += 1
        for result in control.get("results") or []:
            status = result.get("status") or "unknown"
            status_counts[status] += 1
            check_id = result.get("check_id") or "unknown"
            by_check.setdefault(check_id, Counter())[status] += 1

    return {
        "controls_reviewed": len(control_results),
        "openrouter_calls": api_calls,
        "control_design_status_counts": dict(control_status_counts),
        "status_counts": dict(status_counts),
        "by_check": {k: dict(v) for k, v in by_check.items()},
        "token_usage": tokens,
    }


def _to_markdown(
    meta: dict[str, Any],
    summary: dict[str, Any],
    control_results: list[dict[str, Any]],
) -> str:
    lines: list[str] = []
    lines.append("# Design Gap Report")
    lines.append("")
    lines.append(f"- Generated (UTC): `{meta.get('generated_at')}`")
    lines.append(f"- Model: `{meta.get('model')}`")
    lines.append(
        f"- Filters: company=`{meta.get('company')}`, unit=`{meta.get('unit')}`, "
        f"BP=`{meta.get('business_process')}`, FY=`{meta.get('financial_year')}`, "
        f"limit=`{meta.get('limit')}`"
    )
    lines.append("")
    lines.append("## Summary")
    lines.append("")
    lines.append(f"- Controls reviewed: **{summary.get('controls_reviewed')}**")
    lines.append(f"- OpenRouter calls: **{summary.get('openrouter_calls')}**")
    lines.append(
        f"- Control design status: `{summary.get('control_design_status_counts')}`"
    )
    lines.append(f"- Check status counts: `{summary.get('status_counts')}`")
    lines.append(f"- Token usage: `{summary.get('token_usage')}`")
    lines.append("")

    lines.append("## Good design (no gaps)")
    lines.append("")
    good_any = False
    for control in control_results:
        if control.get("control_design_status") != GOOD_DESIGN_STATUS:
            continue
        good_any = True
        ident = control.get("control_number") or control.get("form_id")
        lines.append(f"- **{ident}**: {control.get('summary')}")
    if not good_any:
        lines.append("_None_")
    lines.append("")

    lines.append("## Flagged (has gaps)")
    lines.append("")
    flagged_any = False
    for control in control_results:
        if control.get("control_design_status") != HAS_GAPS_STATUS:
            # Still list individual flagged checks if present
            pass
        flagged = [r for r in control.get("results") or [] if r.get("status") == "flagged"]
        if not flagged:
            continue
        flagged_any = True
        ident = control.get("control_number") or control.get("form_id")
        lines.append(f"### {ident}")
        lines.append(f"- Overall: `{control.get('control_design_status')}` — {control.get('summary')}")
        for r in flagged:
            lines.append(f"- **{r.get('check_id')}**: {r.get('inconsistency')}")
            if r.get("evidence"):
                lines.append(f"  - Evidence: {'; '.join(r['evidence'])}")
            if r.get("recommendation"):
                lines.append(f"  - Recommendation: {r['recommendation']}")
        lines.append("")
    if not flagged_any:
        lines.append("_None_")
        lines.append("")

    lines.append("## Insufficient data (pre-check or model)")
    lines.append("")
    insuf_any = False
    for control in control_results:
        insuf = [
            r
            for r in control.get("results") or []
            if r.get("status") == "insufficient_data"
        ]
        if not insuf:
            continue
        insuf_any = True
        ident = control.get("control_number") or control.get("form_id")
        lines.append(f"### {ident}")
        for r in insuf:
            src = r.get("source") or ""
            lines.append(f"- **{r.get('check_id')}** ({src}): {r.get('inconsistency')}")
            if r.get("evidence"):
                lines.append(f"  - {'; '.join(r['evidence'])}")
        lines.append("")
    if not insuf_any:
        lines.append("_None_")
        lines.append("")

    return "\n".join(lines)


def enrich_control_overall(control: dict[str, Any]) -> dict[str, Any]:
    """Ensure control_design_status + summary exist from results when AI skipped."""
    results = control.get("results") or []
    status = control.get("control_design_status") or derive_control_design_status(results)
    summary = control.get("summary") or default_summary_for_status(status)
    if status == GOOD_DESIGN_STATUS:
        summary = default_summary_for_status(GOOD_DESIGN_STATUS)
    control["control_design_status"] = status
    control["summary"] = summary
    return control
