"""Shared helpers for searchable, paged list endpoints (frontend redesign, 2026-11-04).

Optional and additive: without `q`, `limit` and `offset` an endpoint returns the same full list as before, so existing callers
are unaffected. The total number of matching rows (before paging) is sent in the `X-Total-Count` header.
"""
from __future__ import annotations

from fastapi import Response
from sqlalchemy import or_
from sqlalchemy.orm import Query

MAX_LIMIT = 500


def like_pattern(q: str) -> str:
    """Case-insensitive substring pattern with LIKE wildcards escaped (a search for "50%" matches the text "50%")."""
    esc = q.strip().lower().replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{esc}%"


def text_filter(query: Query, q: str | None, *columns) -> Query:
    if not q or not q.strip():
        return query
    pat = like_pattern(q)
    return query.filter(or_(*[c.ilike(pat, escape="\\") for c in columns]))


def page(query: Query, response: Response, limit: int | None, offset: int) -> list:
    """Apply offset/limit and set X-Total-Count. limit=None keeps the old behaviour (everything)."""
    response.headers["X-Total-Count"] = str(query.order_by(None).count())
    if offset:
        query = query.offset(offset)
    if limit is not None:
        query = query.limit(limit)
    return query.all()
