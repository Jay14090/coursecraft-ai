from dataclasses import dataclass
import asyncio
from functools import lru_cache

import jwt
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import get_settings


bearer = HTTPBearer(auto_error=False)


@dataclass(frozen=True)
class CurrentUser:
    id: str
    email: str
    name: str | None = None


@lru_cache(maxsize=4)
def _jwks_client(supabase_url: str) -> jwt.PyJWKClient:
    return jwt.PyJWKClient(f"{supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json", cache_jwk_set=True, lifespan=900)


def _decode_supabase_token(token: str, supabase_url: str, legacy_secret: str | None) -> dict:
    algorithm = jwt.get_unverified_header(token).get("alg", "")
    common = {"algorithms": [algorithm], "audience": "authenticated"}
    if algorithm == "HS256" and legacy_secret:
        return jwt.decode(token, legacy_secret, **common)
    signing_key = _jwks_client(supabase_url).get_signing_key_from_jwt(token)
    return jwt.decode(token, signing_key.key, **common)


async def get_current_user(credentials: HTTPAuthorizationCredentials | None = Depends(bearer)) -> CurrentUser:
    settings = get_settings()
    if settings.demo_mode and credentials is None:
        return CurrentUser(id="demo-user", email="jay@example.com", name="Jay")
    if not credentials or not settings.supabase_url:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Authentication required")
    try:
        payload = await asyncio.to_thread(
            _decode_supabase_token,
            credentials.credentials,
            settings.supabase_url,
            settings.supabase_jwt_secret,
        )
    except (jwt.PyJWTError, ValueError) as exc:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token") from exc
    subject = payload.get("sub")
    if not subject:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid access token")
    metadata = payload.get("user_metadata") or {}
    return CurrentUser(id=subject, email=payload.get("email", ""), name=metadata.get("name") or metadata.get("full_name"))
