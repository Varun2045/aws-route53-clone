import base64
import hashlib
import hmac
from typing import Optional
from fastapi import Depends, Header, Cookie, HTTPException, status
from sqlalchemy.orm import Session
from . import crud, models
from .database import get_db

SECRET_KEY = "route53-mock-secret-key-67890"

def create_session_token(username: str) -> str:
    """Generate a simple signed token: base64(username) + "." + hmac_sha256(username)"""
    username_bytes = username.encode('utf-8')
    b64_username = base64.b64encode(username_bytes).decode('utf-8')
    signature = hmac.new(SECRET_KEY.encode('utf-8'), username_bytes, hashlib.sha256).hexdigest()
    return f"{b64_username}.{signature}"

def verify_session_token(token: str) -> Optional[str]:
    """Verify signed token and return the username if valid"""
    try:
        parts = token.split(".")
        if len(parts) != 2:
            return None
        b64_username, signature = parts
        username_bytes = base64.b64decode(b64_username.encode('utf-8'))
        username = username_bytes.decode('utf-8')
        expected_sig = hmac.new(SECRET_KEY.encode('utf-8'), username_bytes, hashlib.sha256).hexdigest()
        if hmac.compare_digest(signature, expected_sig):
            return username
    except Exception:
        return None
    return None

def get_current_user(
    authorization: Optional[str] = Header(None),
    session: Optional[str] = Cookie(None),
    db: Session = Depends(get_db)
) -> models.User:
    """Dependency to retrieve the currently authenticated user"""
    token = None
    if authorization and authorization.startswith("Bearer "):
        token = authorization[7:]
    elif session:
        token = session
        
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication credentials were not provided."
        )
        
    username = verify_session_token(token)
    if not username:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session token is invalid or expired."
        )
        
    db_user = crud.get_user_by_username(db, username=username)
    if not db_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="User not found."
        )
        
    return db_user
