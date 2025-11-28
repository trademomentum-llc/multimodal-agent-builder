"""Lightweight API key issuance and management endpoints."""

from typing import Dict, List, Optional
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from src.utils.auth_utils import (
    ApiKeyRecord,
    issue_api_key,
    list_api_keys,
    revoke_api_key,
)

router = APIRouter(prefix="/auth", tags=["Auth"])


class ApiKeyCreateRequest(BaseModel):
    """Request payload to mint an API key."""

    name: str = Field(..., description="Display name/owner of the key")
    ttl_seconds: Optional[int] = Field(
        default=None, description="Optional time-to-live for the key in seconds"
    )
    metadata: Dict[str, str] = Field(default_factory=dict, description="Optional metadata tags")


class ApiKeyResponse(BaseModel):
    """Response containing a newly created API key."""

    token: str = Field(..., description="Bearer token in the format <key_id>.<secret>")
    key_id: str
    name: str
    expires_at: Optional[float]


class ApiKeyListItem(BaseModel):
    """Summary view for stored keys (no secret returned)."""

    key_id: str
    name: str
    active: bool
    created_at: float
    expires_at: Optional[float]
    metadata: Dict[str, str] = Field(default_factory=dict)


@router.post("/keys", response_model=ApiKeyResponse)
async def create_api_key(request: ApiKeyCreateRequest) -> ApiKeyResponse:
    """Create a new API key."""
    token = issue_api_key(
        name=request.name,
        ttl_seconds=request.ttl_seconds,
        metadata=request.metadata,
    )
    key_id, _ = token.split(".", 1)
    record = list_api_keys(include_inactive=True)[key_id]
    return ApiKeyResponse(
        token=token,
        key_id=record.key_id,
        name=record.name,
        expires_at=record.expires_at,
    )


@router.get("/keys", response_model=List[ApiKeyListItem])
async def list_keys(include_inactive: bool = False) -> List[ApiKeyListItem]:
    """List stored API keys (secret never returned)."""
    keys = list_api_keys(include_inactive=include_inactive)
    items: List[ApiKeyListItem] = []
    for record in keys.values():
        items.append(
            ApiKeyListItem(
                key_id=record.key_id,
                name=record.name,
                active=record.active and not record.is_expired,
                created_at=record.created_at,
                expires_at=record.expires_at,
                metadata=record.metadata,
            )
        )
    return items


@router.delete("/keys/{key_id}")
async def delete_key(key_id: str) -> Dict[str, str]:
    """Revoke an API key."""
    success = revoke_api_key(key_id)
    if not success:
        raise HTTPException(status_code=404, detail="API key not found")
    return {"message": f"Key {key_id} revoked"}
