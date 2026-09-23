from __future__ import annotations

import json
import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv


PACKAGE_DIR = Path(__file__).resolve().parent.parent
DEFAULT_COLUMN_MAP = PACKAGE_DIR / "column_map.yaml"
BACKEND_DIR = PACKAGE_DIR.parent.parent
DEFAULT_ENV_PATH = BACKEND_DIR / ".env"
SHARED_CLASSIFICATION_PATH = (
    BACKEND_DIR / "config" / "control_classification_allowed_values.json"
)
SHARED_REF = "$shared"
SHARED_NON_KEY_REF = "$shared_non_key"
ALLOWED_REF = "$allowed"


@dataclass
class Settings:
    model: str
    temperature: float
    max_tokens: int
    max_field_chars: int
    openrouter_base_url: str
    http_referer: str
    app_title: str
    api_key: str
    database_url: str


@dataclass
class AllowedValueCatalog:
    """Parsed allowed_values from column_map.yaml."""

    # field → all accepted raw spellings (High, H, …)
    flat: dict[str, list[str]]
    # field → alias_token → canonical label (e.g. "h" → "High")
    canonical_by_alias: dict[str, dict[str, str]]
    # field → canonical → definition text
    definition_by_canonical: dict[str, dict[str, str]]


def load_env(env_path: Path | None = None) -> None:
    path = env_path or DEFAULT_ENV_PATH
    if path.is_file():
        load_dotenv(path)
    else:
        load_dotenv()


def load_shared_classification_values(
    path: Path | None = None,
) -> dict[str, list[str]]:
    """Load single-source allowed values for classified RACM fields."""
    config_path = path or SHARED_CLASSIFICATION_PATH
    with config_path.open(encoding="utf-8") as fh:
        data = json.load(fh)
    if not isinstance(data, dict):
        raise ValueError(f"Invalid classification config: {config_path}")
    out: dict[str, list[str]] = {}
    for key, values in data.items():
        if not isinstance(values, list):
            raise ValueError(f"Expected list for {key} in {config_path}")
        out[str(key)] = [str(v) for v in values]
    return out


def _norm_token(value: Any) -> str:
    raw = str(value or "").strip().lower()
    return "".join(ch for ch in raw if ch.isalnum())


def _is_non_key_allowed_value(value: str) -> bool:
    """Match shared key_control spellings that mean non-key (No / Non-Key / …)."""
    token = _norm_token(value)
    return token == "no" or token.startswith("non")


def shared_non_key_values(shared: dict[str, list[str]]) -> list[str]:
    """Non-key entries from shared key_control list (e.g. ['No'] from ['Yes','No'])."""
    values = shared.get("key_control") or []
    return [v for v in values if _is_non_key_allowed_value(str(v))]


def parse_allowed_value_catalog(raw: Any) -> AllowedValueCatalog:
    """
    Support both shapes under allowed_values.<field>:

    1) Simple list: ["Yes", "No"]
    2) Canonical map with aliases + definition:
         High:
           aliases: ["High", "H"]
           definition: "High — …"
    """
    flat: dict[str, list[str]] = {}
    canonical_by_alias: dict[str, dict[str, str]] = {}
    definition_by_canonical: dict[str, dict[str, str]] = {}

    if not isinstance(raw, dict):
        return AllowedValueCatalog(flat={}, canonical_by_alias={}, definition_by_canonical={})

    for field, spec in raw.items():
        field_key = str(field)
        aliases: list[str] = []
        alias_map: dict[str, str] = {}
        definitions: dict[str, str] = {}

        if isinstance(spec, list):
            for item in spec:
                text = str(item)
                aliases.append(text)
                token = _norm_token(text)
                if token:
                    alias_map[token] = text
        elif isinstance(spec, dict):
            for canonical, detail in spec.items():
                canonical_label = str(canonical)
                if isinstance(detail, dict):
                    alias_list = detail.get("aliases") or [canonical_label]
                    definition = str(detail.get("definition") or canonical_label)
                elif isinstance(detail, list):
                    alias_list = detail
                    definition = canonical_label
                else:
                    alias_list = [canonical_label, str(detail)]
                    definition = canonical_label

                definitions[canonical_label] = definition
                for alias in alias_list:
                    text = str(alias)
                    aliases.append(text)
                    token = _norm_token(text)
                    if token:
                        alias_map[token] = canonical_label
                # Always accept the canonical spelling itself
                aliases.append(canonical_label)
                token = _norm_token(canonical_label)
                if token:
                    alias_map[token] = canonical_label
        else:
            raise ValueError(
                f"allowed_values.{field_key} must be a list or canonical map"
            )

        # de-dupe while preserving order
        seen: set[str] = set()
        unique_aliases: list[str] = []
        for item in aliases:
            key = _norm_token(item)
            if not key or key in seen:
                continue
            seen.add(key)
            unique_aliases.append(item)

        flat[field_key] = unique_aliases
        canonical_by_alias[field_key] = alias_map
        definition_by_canonical[field_key] = definitions

    return AllowedValueCatalog(
        flat=flat,
        canonical_by_alias=canonical_by_alias,
        definition_by_canonical=definition_by_canonical,
    )


def resolve_value_with_definition(
    catalog: AllowedValueCatalog,
    field: str,
    raw_value: Any,
) -> str:
    """Return raw value, or 'H (High — …)' when a definition exists."""
    text = str(raw_value or "").strip()
    if not text:
        return ""
    token = _norm_token(text)
    canonical = (catalog.canonical_by_alias.get(field) or {}).get(token)
    if not canonical:
        return text
    definition = (catalog.definition_by_canonical.get(field) or {}).get(canonical)
    if not definition:
        if _norm_token(text) == _norm_token(canonical):
            return text
        return f"{text} ({canonical})"
    if _norm_token(text) == _norm_token(canonical):
        return f"{text} ({definition})"
    return f"{text} ({definition})"


def _resolve_required_classified(
    required_classified: Any,
    shared: dict[str, list[str]],
    allowed_catalog: AllowedValueCatalog,
) -> dict[str, list[str]]:
    if not required_classified:
        return {}
    if not isinstance(required_classified, dict):
        raise ValueError(
            "required_classified must be a mapping of field → allowed list, "
            f"'{SHARED_REF}', '{SHARED_NON_KEY_REF}', or '{ALLOWED_REF}'"
        )

    resolved: dict[str, list[str]] = {}
    for field, allowed in required_classified.items():
        field_key = str(field)
        if allowed == SHARED_REF or allowed is None:
            if field_key not in shared:
                raise ValueError(
                    f"required_classified.{field_key} uses {SHARED_REF} but "
                    f"{field_key} is missing from {SHARED_CLASSIFICATION_PATH.name}"
                )
            resolved[field_key] = list(shared[field_key])
        elif allowed == SHARED_NON_KEY_REF:
            if field_key != "key_control":
                raise ValueError(
                    f"{SHARED_NON_KEY_REF} is only valid for key_control "
                    f"(got required_classified.{field_key})"
                )
            non_key = shared_non_key_values(shared)
            if not non_key:
                raise ValueError(
                    f"{SHARED_NON_KEY_REF} needs a non-key value in "
                    f"{SHARED_CLASSIFICATION_PATH.name} key_control "
                    "(e.g. \"No\")"
                )
            resolved[field_key] = non_key
        elif allowed == ALLOWED_REF:
            if field_key not in allowed_catalog.flat:
                raise ValueError(
                    f"required_classified.{field_key} uses {ALLOWED_REF} but "
                    f"{field_key} is missing from column_map allowed_values"
                )
            resolved[field_key] = list(allowed_catalog.flat[field_key])
        elif isinstance(allowed, list):
            resolved[field_key] = [str(v) for v in allowed]
        else:
            raise ValueError(
                f"required_classified.{field_key} must be a list, "
                f"'{SHARED_REF}', '{SHARED_NON_KEY_REF}', or '{ALLOWED_REF}'"
            )
    return resolved


def load_column_map(path: Path | None = None) -> dict[str, Any]:
    map_path = path or DEFAULT_COLUMN_MAP
    with map_path.open(encoding="utf-8") as fh:
        data = yaml.safe_load(fh)
    if not isinstance(data, dict) or "checks" not in data:
        raise ValueError(f"Invalid column map (missing checks): {map_path}")

    shared = load_shared_classification_values()
    allowed_catalog = parse_allowed_value_catalog(data.get("allowed_values"))
    default_columns = [
        str(c)
        for c in ((data.get("settings") or {}).get("default_columns") or [])
    ]
    for check in data.get("checks") or []:
        if not isinstance(check, dict):
            continue
        check["required_classified"] = _resolve_required_classified(
            check.get("required_classified"),
            shared,
            allowed_catalog,
        )
        # Merge default_columns first, then check-specific columns (deduped)
        check_columns = [str(c) for c in (check.get("columns") or [])]
        merged: list[str] = []
        seen: set[str] = set()
        for col in default_columns + check_columns:
            if col in seen:
                continue
            seen.add(col)
            merged.append(col)
        check["columns"] = merged

    data["shared_classification_values"] = shared
    data["allowed_value_catalog"] = allowed_catalog
    return data


def resolve_settings(
    column_map: dict[str, Any],
    *,
    require_api_key: bool = True,
) -> Settings:
    raw = column_map.get("settings") or {}
    api_key = (os.getenv("OPENROUTER_API_KEY") or "").strip()
    database_url = (os.getenv("DATABASE_URL") or "").strip()
    if require_api_key and not api_key:
        raise RuntimeError("OPENROUTER_API_KEY is not set (check backend/.env)")
    if not database_url:
        raise RuntimeError("DATABASE_URL is not set (check backend/.env)")

    return Settings(
        model=str(raw.get("model") or "openai/gpt-4.1-mini"),
        temperature=float(raw.get("temperature", 0)),
        max_tokens=int(raw.get("max_tokens", 2500)),
        max_field_chars=int(raw.get("max_field_chars", 1200)),
        openrouter_base_url=str(
            raw.get("openrouter_base_url") or "https://openrouter.ai/api/v1"
        ).rstrip("/"),
        http_referer=str(raw.get("http_referer") or ""),
        app_title=str(raw.get("app_title") or "IFC Design Gap Prototype"),
        api_key=api_key,
        database_url=database_url,
    )
