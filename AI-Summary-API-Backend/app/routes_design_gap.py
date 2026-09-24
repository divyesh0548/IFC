from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.auth import require_api_key
from services.design_gap.design_gap_lib.config import load_column_map, load_env, resolve_settings
from services.design_gap.design_gap_lib.service import analyze_control, is_design_gap_dry_run_enabled

design_gap_bp = Blueprint("design_gap", __name__, url_prefix="/v1/design-gap")


@design_gap_bp.get("/health")
def design_gap_health():
    """Unauthenticated liveness for this feature module."""
    try:
        column_map = load_column_map()
        checks = [c["id"] for c in column_map.get("checks") or []]
        return jsonify({"ok": True, "service": "design_gap", "checks": checks})
    except Exception as exc:  # noqa: BLE001 — surface config errors
        return jsonify({"ok": False, "error": str(exc)}), 500


@design_gap_bp.post("/analyze")
@require_api_key
def analyze_one():
    """
    Analyze a single control payload from the Node backend.

    Body:
      {
        "control": { ...fields + assertions / assertion_fields... },
        "dry_run": false
      }
    """
    body = request.get_json(silent=True) or {}
    control = body.get("control")
    if not isinstance(control, dict) or not control:
        return (
            jsonify(
                {
                    "error": "invalid_request",
                    "message": "Body must include a non-empty object field 'control'.",
                }
            ),
            400,
        )

    dry_run = is_design_gap_dry_run_enabled(bool(body.get("dry_run", False)))
    load_env()
    try:
        column_map = load_column_map()
        settings = resolve_settings(column_map, require_openrouter_key=not dry_run)
        result = analyze_control(
            control,
            dry_run=dry_run,
            column_map=column_map,
            settings=settings,
        )
    except RuntimeError as exc:
        return jsonify({"error": "config_error", "message": str(exc)}), 500
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": "analyze_failed", "message": str(exc)}), 500

    return jsonify(result)


@design_gap_bp.post("/analyze-batch")
@require_api_key
def analyze_batch():
    """
    Analyze multiple controls in one request (sequential).

    Body:
      {
        "controls": [ {...}, {...} ],
        "dry_run": false
      }
    """
    body = request.get_json(silent=True) or {}
    controls = body.get("controls")
    if not isinstance(controls, list) or not controls:
        return (
            jsonify(
                {
                    "error": "invalid_request",
                    "message": "Body must include a non-empty array field 'controls'.",
                }
            ),
            400,
        )

    dry_run = is_design_gap_dry_run_enabled(bool(body.get("dry_run", False)))
    load_env()
    try:
        column_map = load_column_map()
        settings = resolve_settings(column_map, require_openrouter_key=not dry_run)
    except RuntimeError as exc:
        return jsonify({"error": "config_error", "message": str(exc)}), 500

    results = []
    errors = []
    for idx, control in enumerate(controls):
        if not isinstance(control, dict):
            errors.append({"index": idx, "error": "control must be an object"})
            continue
        try:
            results.append(
                analyze_control(
                    control,
                    dry_run=dry_run,
                    column_map=column_map,
                    settings=settings,
                )
            )
        except Exception as exc:  # noqa: BLE001
            errors.append(
                {
                    "index": idx,
                    "form_id": control.get("form_id"),
                    "error": str(exc),
                }
            )

    return jsonify(
        {
            "count": len(results),
            "error_count": len(errors),
            "results": results,
            "errors": errors,
            "dry_run": dry_run,
        }
    )
