from __future__ import annotations

from typing import Any
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

import psycopg2
import psycopg2.extras


CONTROL_COLUMNS = [
    "form_id",
    "control_number",
    "company_identifier",
    "unit_id",
    "business_process",
    "financial_year",
    "area",
    "sub_process",
    "risk_description",
    "risk_heat",
    "control_objective",
    "standard_control_description",
    "nature_of_control",
    "control_type_ma",
    "control_type_fo",
    "key_control",
    "whether_fraud_risks_exist",
    "application_name",
    "ipe_reference",
    "process_walkthrough",
    "active",
    "status",
]

# Prisma puts schema= in DATABASE_URL; psycopg2 rejects unknown query params.
_PSYCOPG2_ALLOWED_QUERY_KEYS = frozenset(
    {
        "host",
        "port",
        "dbname",
        "user",
        "password",
        "sslmode",
        "connect_timeout",
        "application_name",
        "options",
        "sslrootcert",
        "sslcert",
        "sslkey",
        "target_session_attrs",
    }
)


def normalize_database_url(database_url: str) -> str:
    """Strip Prisma-only query params (e.g. schema=public) for psycopg2."""
    parsed = urlparse(database_url)
    if not parsed.query:
        return database_url
    kept = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if k.lower() in _PSYCOPG2_ALLOWED_QUERY_KEYS
    ]
    return urlunparse(parsed._replace(query=urlencode(kept)))


def _connect(database_url: str):
    return psycopg2.connect(normalize_database_url(database_url))


def fetch_controls(
    database_url: str,
    *,
    company: str,
    unit: str | None,
    business_process: str | None,
    financial_year: str | None,
    limit: int,
    active_only: bool = True,
) -> list[dict[str, Any]]:
    """Load control_forms rows plus assertion section fields (any template shape)."""
    if limit <= 0:
        raise ValueError("--limit must be > 0")

    where = ["cf.company_identifier = %s"]
    params: list[Any] = [company]

    if unit:
        where.append("cf.unit_id = %s")
        params.append(unit)
    if business_process:
        where.append("cf.business_process = %s")
        params.append(business_process)
    if financial_year:
        where.append("cf.financial_year = %s")
        params.append(financial_year)
    if active_only:
        where.append("COALESCE(cf.active, false) = true")

    cols_sql = ", ".join(f"cf.{c}" for c in CONTROL_COLUMNS)
    sql = f"""
        SELECT {cols_sql}
        FROM control_forms cf
        WHERE {' AND '.join(where)}
        ORDER BY cf.control_number NULLS LAST, cf.form_id
        LIMIT %s
    """
    params.append(limit)

    with _connect(database_url) as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            cur.execute(sql, params)
            rows = [dict(r) for r in cur.fetchall()]
            if not rows:
                return []

            form_ids = [r["form_id"] for r in rows if r.get("form_id")]
            assertions_by_form = _fetch_assertions(cur, form_ids)

    for row in rows:
        form_id = row.get("form_id")
        assertion_fields = assertions_by_form.get(form_id, [])
        # field_key → value (for gates / legacy lookups)
        assertions = {
            item["field_key"]: item.get("value") or ""
            for item in assertion_fields
            if item.get("field_key")
        }
        row["assertion_fields"] = assertion_fields
        row["assertions"] = assertions
        # Synthetic helper: any non-empty assertion value (free text OK)
        row["assertions.any"] = (
            "yes"
            if any(str(item.get("value") or "").strip() for item in assertion_fields)
            else ""
        )

    return rows


def _fetch_assertions(cur, form_ids: list[str]) -> dict[str, list[dict[str, str]]]:
    """
    Return all assertion-section fields for each form (1 or many columns).
    Ordered by template display_order.
    """
    if not form_ids:
        return {}

    cur.execute(
        """
        SELECT
            rfv.form_id,
            rtf.field_key,
            rtf.label,
            rfv.value_text,
            rtf.display_order
        FROM racm_field_values rfv
        JOIN racm_template_fields rtf ON rtf.id = rfv.template_field_id
        WHERE rfv.form_id = ANY(%s)
          AND rtf.section_key = 'assertions'
        ORDER BY rfv.form_id, rtf.display_order ASC, rtf.field_key ASC
        """,
        (form_ids,),
    )
    out: dict[str, list[dict[str, str]]] = {}
    for row in cur.fetchall():
        form_id = row["form_id"]
        out.setdefault(form_id, []).append(
            {
                "field_key": row["field_key"] or "",
                "label": (row["label"] or row["field_key"] or "").strip(),
                "value": row["value_text"] or "",
            }
        )
    return out
