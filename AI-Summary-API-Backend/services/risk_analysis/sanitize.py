from __future__ import annotations

import re

STOPWORDS = {
    "about", "after", "also", "been", "being", "from", "have", "into", "that", "this",
    "they", "them", "their", "with", "without", "will", "shall", "such", "than", "then",
    "when", "where", "which", "while", "would", "could", "should", "may", "might",
    "result", "results", "resulting", "lead", "leads", "leading", "ensure", "ensures",
    "process", "does", "not", "and", "the", "for", "are", "was", "were",
}


def _normalize_name(value: str) -> str:
    return str(value or "").strip().lower()


def _normalize_text(value: str) -> str:
    return re.sub(r"[^a-z0-9]+", " ", str(value or "").lower()).strip()


def _tokenize(value: str) -> list[str]:
    tokens = []
    for token in _normalize_text(value).split():
        if token.endswith("ies") and len(token) > 5:
            token = f"{token[:-3]}y"
        elif token.endswith("s") and not token.endswith("ss") and len(token) > 4:
            token = token[:-1]
        if len(token) > 3 and token not in STOPWORDS:
            tokens.append(token)
    return tokens


def _overlap(risk_text: str, source_text: str) -> float:
    risk_tokens = _tokenize(risk_text)
    source_tokens = set(_tokenize(source_text))
    if not risk_tokens or not source_tokens:
        return 0
    hits = sum(1 for token in risk_tokens if token in source_tokens)
    return hits / len(risk_tokens)


def _exact(risk_text: str, candidates: list[str]) -> str:
    normalized = _normalize_text(risk_text)
    if not normalized:
        return ""
    for candidate in candidates:
        if _normalize_text(candidate) == normalized:
            return candidate
    return ""


def _covered(risk_text: str, control: dict) -> bool:
    risk_description = str(control.get("riskDescription") or "").strip()
    details = " ".join(
        str(control.get(key) or "").strip()
        for key in ("riskDescription", "controlObjective", "standardControlDescription")
        if str(control.get(key) or "").strip()
    )
    if risk_description and _overlap(risk_text, risk_description) >= 0.45:
        return True
    return _overlap(risk_text, details) >= 0.5


def resolve_matched_candidate(matched_sub_process: str, candidates: list[dict]) -> dict:
    wanted = _normalize_name(matched_sub_process)
    for candidate in candidates:
        if _normalize_name(candidate.get("subProcess")) == wanted:
            return candidate
    raise ValueError(
        "The model returned a matched sub-process that is not present in the risk analysis master file."
    )


def sanitize_result(parsed: dict, matched_candidate: dict, control: dict) -> dict:
    candidate_risks = list(matched_candidate.get("risks") or [])
    allowed: list[str] = []
    for risk_text in parsed.get("missingRisks") or []:
        exact = _exact(risk_text, candidate_risks)
        canonical = exact or risk_text
        if _covered(canonical, control):
            continue
        if exact and exact not in allowed:
            allowed.append(exact)

    pointers = []
    for item in parsed.get("missingRiskPointers") or []:
        risk_text = str(item.get("risk") or "")
        exact = _exact(risk_text, candidate_risks) or _exact(risk_text, allowed)
        canonical = exact or risk_text
        if _covered(canonical, control):
            continue
        if not exact and canonical not in allowed:
            continue
        pointers.append({"risk": exact or canonical, "pointer": item.get("pointer")})

    missing = allowed or list(dict.fromkeys(item["risk"] for item in pointers))
    return {
        "matchedSubProcess": str(matched_candidate.get("subProcess") or parsed.get("matchedSubProcess") or "").strip(),
        "matchConfidence": str(parsed.get("matchConfidence") or "").strip(),
        "coverageStatus": str(parsed.get("coverageStatus") or "").strip() if missing else "Covered",
        "missingRisks": missing,
        "missingRiskPointers": [item for item in pointers if item["risk"] in missing],
    }
