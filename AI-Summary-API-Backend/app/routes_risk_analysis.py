from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.auth import require_api_key
from services.risk_analysis.catalog import list_business_processes
from services.risk_analysis.llm import provider_name, resolve_model
from services.risk_analysis.compare import compare_risk
from services.risk_analysis.service import analyze_control, is_risk_analysis_dry_run_enabled

risk_analysis_bp = Blueprint("risk_analysis", __name__, url_prefix="/v1/risk-analysis")


@risk_analysis_bp.get("/health")
def risk_analysis_health():
    try:
        return jsonify(
            {
                "ok": True,
                "service": "risk_analysis",
                "provider": provider_name(),
                "model": resolve_model(),
                "dry_run": is_risk_analysis_dry_run_enabled(False),
                "business_processes": list_business_processes(),
            }
        )
    except Exception as exc:  # noqa: BLE001
        return jsonify({"ok": False, "error": str(exc)}), 500


@risk_analysis_bp.post("/analyze")
@require_api_key
def analyze_one():
    body = request.get_json(silent=True) or {}
    control = body.get("control")
    business_process = str(body.get("business_process") or "").strip()
    if not isinstance(control, dict) or not control:
        return jsonify({"error": "invalid_request", "message": "Body must include a non-empty object field 'control'."}), 400
    if not business_process:
        return jsonify({"error": "invalid_request", "message": "business_process is required"}), 400
    try:
        result = analyze_control(
            control,
            business_process,
            dry_run=bool(body.get("dry_run", False)),
            form_id=str(body.get("form_id") or "").strip(),
        )
    except ValueError as exc:
        return jsonify({"error": "invalid_request", "message": str(exc)}), 400
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": "analyze_failed", "message": str(exc)}), 500
    return jsonify(result)


@risk_analysis_bp.post("/compare")
@require_api_key
def compare_one():
    body = request.get_json(silent=True) or {}
    risk = str(body.get("risk") or "").strip()
    peers = body.get("peers")
    if not risk:
        return jsonify({"error": "invalid_request", "message": "risk is required"}), 400
    if peers is None:
        peers = []
    if not isinstance(peers, list):
        return jsonify({"error": "invalid_request", "message": "peers must be an array"}), 400
    try:
        result = compare_risk(risk, peers, dry_run=bool(body.get("dry_run", False)))
    except ValueError as exc:
        return jsonify({"error": "invalid_request", "message": str(exc)}), 400
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": "compare_failed", "message": str(exc)}), 500
    return jsonify(result)
