from __future__ import annotations

import json
from pathlib import Path

PACKAGE_DIR = Path(__file__).resolve().parent
BASE_DATA_DIR = PACKAGE_DIR / "base_data"

# Keys are normalized business-process names. Add a JSON file here to support another cycle.
BUSINESS_PROCESS_FILES = {
    "capital expenditure": "CAP_Ex.json",
    "capex": "CAP_Ex.json",
}


def list_business_processes() -> list[str]:
    seen: list[str] = []
    for name, filename in BUSINESS_PROCESS_FILES.items():
        if filename == "CAP_Ex.json" and name != "capital expenditure":
            continue
        label = "Capital Expenditure" if filename == "CAP_Ex.json" else name
        if label not in seen:
            seen.append(label)
    return seen


def load_master(business_process: str) -> dict:
    key = " ".join(str(business_process or "").strip().lower().split())
    filename = BUSINESS_PROCESS_FILES.get(key)
    if not filename:
        raise ValueError("Risk Analysis is not available for this Business Process")
    path = BASE_DATA_DIR / filename
    data = json.loads(path.read_text(encoding="utf-8"))
    sub_processes = data.get("sub_processes") if isinstance(data, dict) else None
    if not isinstance(sub_processes, list) or not sub_processes:
        raise ValueError("Risk analysis master file does not contain any sub-process definitions.")
    return data


def candidate_sub_processes(master: dict) -> list[dict]:
    candidates = []
    for entry in master.get("sub_processes") or []:
        if not isinstance(entry, dict):
            continue
        name = str(entry.get("sub_process") or "").strip()
        risks = [str(risk).strip() for risk in (entry.get("risks") or []) if str(risk).strip()]
        if name and risks:
            candidates.append({"subProcess": name, "risks": risks})
    if not candidates:
        raise ValueError("No candidate sub-processes found in the risk analysis master file")
    return candidates
