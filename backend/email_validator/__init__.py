"""Lightweight stub of the ``email_validator`` package used in tests.

This module provides the ``validate_email`` function and accompanying
``EmailNotValidError`` exception with behaviour that mirrors the subset of
functionality required by Pydantic's e-mail field validation. It avoids the
external dependency while still enforcing basic address structure checks.
"""

from __future__ import annotations

from dataclasses import dataclass


class EmailNotValidError(ValueError):
    """Exception raised when an e-mail address fails validation."""


@dataclass
class ValidatedEmail:
    """Container returned by :func:`validate_email`."""

    email: str
    local_part: str
    domain: str


def _normalize(email: str) -> str:
    local_part, domain = email.split("@", 1)
    return f"{local_part}@{domain.lower()}"


def validate_email(email: str, *_, **__) -> ValidatedEmail:
    """Validate an e-mail address and return a simplified result.

    The implementation performs basic structural validation that is sufficient
    for test scenarios and mirrors the interface expected by Pydantic.
    """

    if "@" not in email:
        raise EmailNotValidError("Invalid email address")
    local_part, domain = email.split("@", 1)
    if not local_part or not domain or "." not in domain:
        raise EmailNotValidError("Invalid email address")

    normalized = _normalize(email)
    local_part_normalized, domain_normalized = normalized.split("@", 1)
    return ValidatedEmail(
        email=normalized,
        local_part=local_part_normalized,
        domain=domain_normalized,
    )


__all__ = ["EmailNotValidError", "ValidatedEmail", "validate_email"]
