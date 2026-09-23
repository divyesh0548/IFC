from __future__ import annotations

import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))

from app import create_app  # noqa: E402

app = create_app()


if __name__ == "__main__":
    host = (os.getenv("AI_SUMMARY_HOST") or "127.0.0.1").strip()
    port = int(os.getenv("AI_SUMMARY_PORT") or "5001")
    debug = (os.getenv("AI_SUMMARY_DEBUG") or "").strip().lower() in {
        "1",
        "true",
        "yes",
    }
    app.run(host=host, port=port, debug=debug)
