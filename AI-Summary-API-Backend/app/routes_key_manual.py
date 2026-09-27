from __future__ import annotations

from flask import Blueprint, jsonify, request

from app.auth import require_api_key
from services.key_manual.service import analyze_control, describe_settings

key_manual_bp = Blueprint("key_manual", __name__, url_prefix="/v1/key-manual")


@key_manual_bp.get("/health")
def key_manual_health():
    try:
        settings = describe_settings()
        return jsonify({"ok": True, "service": "key_manual", **settings})
    except Exception as exc:  # noqa: BLE001
        return jsonify({"ok": False, "error": str(exc)}), 500


@key_manual_bp.post("/analyze")
@require_api_key
def analyze_one():
    body = request.get_json(silent=True) or {}
    control = body.get("control")
    business_process = str(body.get("business_process") or "").strip()
    company_identifier = str(body.get("company_identifier") or "").strip()
    if not isinstance(control, dict) or not control:
        return jsonify({"error": "invalid_request", "message": "Body must include a non-empty object field 'control'."}), 400
    if not business_process:
        return jsonify({"error": "invalid_request", "message": "business_process is required"}), 400
    try:
        result = analyze_control(control, business_process, company_identifier)
    except ValueError as exc:
        return jsonify({"error": "invalid_request", "message": str(exc)}), 400
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": "analyze_failed", "message": str(exc)}), 500
    return jsonify(result)
