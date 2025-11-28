"""Utility helpers for simple API key management."""

import hashlib
import hmac
import secrets
import time
from dataclasses import dataclass, field
from typing import Dict, Optional


def _hash_secret(secret: str) -> str:
    """Return a SHA-256 hash for a secret."""
    return hashlib.sha256(secret.encode("utf-8")).hexdigest()


@dataclass
class ApiKeyRecord:
    """Stored metadata for an issued API key."""

    key_id: str
    hashed_secret: str
    name: str
    created_at: float
    expires_at: Optional[float] = None
    active: bool = True
    metadata: Dict[str, str] = field(default_factory=dict)

    @property
    def is_expired(self) -> bool:
        return bool(self.expires_at and time.time() > self.expires_at)


# In-memory key store; replace with a database/Redis in production deployments.
api_keys_store: Dict[str, ApiKeyRecord] = {}


def issue_api_key(name: str, ttl_seconds: Optional[int] = None, metadata: Optional[Dict[str, str]] = None) -> str:
    """Create and register a new API key.

    Returns the token in the format <key_id>.<secret>. Only the hash is stored.
    """
    key_id = secrets.token_hex(8)
    secret = secrets.token_hex(24)
    token = f"{key_id}.{secret}"
    expires_at = time.time() + ttl_seconds if ttl_seconds else None
    record = ApiKeyRecord(
        key_id=key_id,
        hashed_secret=_hash_secret(secret),
        name=name,
        created_at=time.time(),
        expires_at=expires_at,
        metadata=metadata or {},
    )
    api_keys_store[key_id] = record
    return token


def revoke_api_key(key_id: str) -> bool:
    """Deactivate a stored API key."""
    record = api_keys_store.get(key_id)
    if not record:
        return False
    record.active = False
    return True


def verify_api_key_token(token: str) -> ApiKeyRecord:
    """Verify a bearer token and return its record."""
    if not token or "." not in token:
        raise ValueError("Malformed API key")

    key_id, secret = token.split(".", 1)
    record = api_keys_store.get(key_id)
    if not record:
        raise ValueError("Unknown API key")
    if not record.active:
        raise ValueError("API key inactive")
    if record.is_expired:
        raise ValueError("API key expired")

    if not hmac.compare_digest(record.hashed_secret, _hash_secret(secret)):
        raise ValueError("Invalid API key")

    return record


def list_api_keys(include_inactive: bool = False) -> Dict[str, ApiKeyRecord]:
    """Return a filtered view of stored keys."""
    if include_inactive:
        return dict(api_keys_store)
    return {k: v for k, v in api_keys_store.items() if v.active and not v.is_expired}
