from __future__ import annotations

from flask import Flask, jsonify

from app.routes_design_gap import design_gap_bp
from services.design_gap.design_gap_lib.config import load_env


def create_app() -> Flask:
    load_env()
    app = Flask(__name__)
    app.register_blueprint(design_gap_bp)

    @app.get("/health")
    def health():
        return jsonify(
            {
                "ok": True,
                "service": "AI-Summary-API-Backend",
                "auth": "AI_SUMMARY_API_KEY via Authorization Bearer or X-API-Key",
            }
        )

    return app
