"""Domain exception hierarchy for DRISTI-NET.

Services raise these; route handlers (and the global handler in main.py) translate
them to HTTP responses. This keeps HTTP status codes out of business logic.

See docs/engineering/ERROR_HANDLING_STANDARD.md for the full contract.
"""
from __future__ import annotations


class DristiBaseError(Exception):
    """Root of all domain exceptions. Never raise this directly — use a subclass."""

    http_status: int = 500
    code: str = "INTERNAL_ERROR"

    def __init__(self, message: str, *, detail: dict | None = None) -> None:
        super().__init__(message)
        self._message = message
        self.detail = detail

    def safe_message(self) -> str:
        """Human-readable message safe for returning to API clients."""
        return self._message


# ── 404 ─────────────────────────────────────────────────────────────────────

class NotFoundError(DristiBaseError):
    http_status = 404
    code = "NOT_FOUND"

    def __init__(self, resource_type: str, resource_id: str) -> None:
        super().__init__(f"{resource_type} '{resource_id}' not found")
        self.resource_type = resource_type
        self.resource_id = resource_id


# ── 403 ─────────────────────────────────────────────────────────────────────

class AuthorizationError(DristiBaseError):
    http_status = 403
    code = "ACCESS_DENIED"


class CaseAccessDeniedError(AuthorizationError):
    code = "CASE_ACCESS_DENIED"

    def __init__(self, case_id: str, user_id: str) -> None:
        super().__init__(f"user '{user_id}' is not authorized to access case '{case_id}'")
        self.case_id = case_id
        self.user_id = user_id


class RoleRequiredError(AuthorizationError):
    code = "ROLE_REQUIRED"

    def __init__(self, required_roles: list[str], actual_role: str) -> None:
        super().__init__(
            f"this action requires role {' or '.join(required_roles)}, got {actual_role}"
        )
        self.required_roles = required_roles
        self.actual_role = actual_role


# ── 409 ─────────────────────────────────────────────────────────────────────

class ConflictError(DristiBaseError):
    http_status = 409
    code = "CONFLICT"


class DuplicateEvidenceError(ConflictError):
    code = "DUPLICATE_EVIDENCE"

    def __init__(self, evidence_id: str, sha256: str) -> None:
        super().__init__(
            f"a file with SHA-256 {sha256[:16]}… already exists in this case as {evidence_id}"
        )
        self.evidence_id = evidence_id
        self.sha256 = sha256


class IntegrityMismatchError(ConflictError):
    code = "INTEGRITY_MISMATCH"

    def __init__(self, evidence_id: str, expected: str, actual: str | None) -> None:
        super().__init__(
            "evidence integrity verification failed: stored hash does not match manifest"
        )
        self.evidence_id = evidence_id
        self.expected = expected
        self.actual = actual


class EvidenceStateConflictError(ConflictError):
    code = "EVIDENCE_QUARANTINED"

    def __init__(self, evidence_id: str, status: str, action: str) -> None:
        super().__init__(
            f"evidence '{evidence_id}' is in state {status} and cannot perform {action}"
        )
        self.evidence_id = evidence_id
        self.status = status
        self.action = action


# ── 422 ─────────────────────────────────────────────────────────────────────

class DristiValidationError(DristiBaseError):
    http_status = 422
    code = "VALIDATION_ERROR"


class UploadRejectedError(DristiValidationError):
    code = "UPLOAD_REJECTED"

    def __init__(self, reason: str) -> None:
        super().__init__(f"upload rejected: {reason}")
        self.reason = reason


class ProcessingError(DristiBaseError):
    http_status = 422
    code = "PROCESSING_ERROR"


# ── 503 ─────────────────────────────────────────────────────────────────────

class InfrastructureError(DristiBaseError):
    http_status = 503
    code = "SERVICE_UNAVAILABLE"


class StorageUnavailableError(InfrastructureError):
    code = "STORAGE_UNAVAILABLE"

    def __init__(self) -> None:
        super().__init__(
            "evidence storage is unavailable; the upload was not accepted"
        )


class ScannerUnavailableError(InfrastructureError):
    code = "SCANNER_UNAVAILABLE"

    def __init__(self) -> None:
        super().__init__(
            "malware scanner is unavailable; the file remains quarantined and is not clean"
        )
