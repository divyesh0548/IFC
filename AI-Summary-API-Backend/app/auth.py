from __future__ import annotations

import os
from functools import wraps
from typing import Any, Callable

from flask import jsonify, request


def _extract_api_key() -> str:
    auth = request.headers.get("Authorization") or ""
    if auth.lower().startswith("bearer "):
        return auth[7:].strip()
    return (request.headers.get("X-API-Key") or "").strip()


def require_api_key(view: Callable[..., Any]) -> Callable[..., Any]:
    """Shared access key for all AI summary endpoints (AI_SUMMARY_API_KEY)."""

    @wraps(view)
    def wrapped(*args: Any, **kwargs: Any):
        expected = (os.getenv("AI_SUMMARY_API_KEY") or "").strip()
        if not expected:
            return (
                jsonify(
                    {
                        "error": "server_misconfigured",
                        "message": "AI_SUMMARY_API_KEY is not set on the AI Summary API.",
                    }
                ),
                500,
            )
        provided = _extract_api_key()
        if not provided or provided != expected:
            return (
                jsonify(
                    {
                        "error": "unauthorized",
                        "message": "Invalid or missing API key. "
                        "Send Authorization: Bearer <AI_SUMMARY_API_KEY> "
                        "or X-API-Key header.",
                    }
                ),
                401,
            )
        return view(*args, **kwargs)

    return wrapped
