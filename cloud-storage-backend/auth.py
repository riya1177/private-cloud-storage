import hashlib
import secrets
import os
import requests
from typing import Optional
from urllib.parse import urlencode
from fastapi import APIRouter, Security, HTTPException, Query, status
from fastapi.security import OAuth2PasswordBearer
from pydantic import BaseModel

router = APIRouter()

# OAuth2 bearer token scheme
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="token")

class GoogleDriveImportRequest(BaseModel):
    file_id: str
    access_token: Optional[str] = None
    mime_type: Optional[str] = None
    filename: Optional[str] = None


def hash_password(password: str, salt: str = None) -> tuple:
    """
    Hashes a password securely using PBKDF2-HMAC-SHA256.
    Returns (hashed_hex_string, salt_hex_string).
    """
    if not salt:
        salt = secrets.token_hex(16)
    hashed = hashlib.pbkdf2_hmac(
        'sha256',
        password.encode('utf-8'),
        salt.encode('utf-8'),
        100000
    ).hex()
    return hashed, salt


def verify_password(password: str, hashed: str, salt: str) -> bool:
    """
    Verifies a plain password against stored hash and salt using constant-time comparison.
    """
    if not hashed or not salt:
        return False
    new_hash, _ = hash_password(password, salt)
    return secrets.compare_digest(new_hash, hashed)


def hash_token(token_str: str) -> str:
    """
    Hashes a sensitive token or OTP using SHA-256 for secure storage.
    """
    return hashlib.sha256(token_str.encode('utf-8')).hexdigest()


def verify_user_token(token: str = Security(oauth2_scheme)):
    """
    Verifies the bearer token against active sessions in SQLite database.
    """
    if not token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing authentication token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    
    from database import SessionLocal, User, UserSession
    import datetime

    db = SessionLocal()
    try:
        session = db.query(UserSession).filter(
            UserSession.token == token,
            UserSession.expires_at > datetime.datetime.utcnow()
        ).first()

        if not session:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid or expired authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        user = db.query(User).filter(User.username == session.username).first()
        if not user:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid authentication token",
                headers={"WWW-Authenticate": "Bearer"},
            )

        return {"username": user.username, "email": user.email}
    finally:
        db.close()


# ==============================================================================
# GOOGLE DRIVE OAUTH & INTEGRATION ROUTES
# ==============================================================================

@router.get("/integrations/google-drive/status")
@router.get("/api/drive/status")
def google_drive_status():
    """
    Checks if Google Drive OAuth credentials are configured in environment variables.
    """
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
    return {
        "configured": bool(client_id and client_secret),
        "client_id": client_id if client_id else None
    }


@router.get("/integrations/google-drive/auth-url")
@router.get("/api/drive/auth-url")
def get_google_drive_auth_url(current_user: dict = Security(verify_user_token)):
    """
    Generates a properly encoded Google OAuth 2.0 URL for Google Drive integration.
    """
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "").strip()

    if not client_id or not redirect_uri:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth credentials are missing in backend .env file"
        )

    params = {
        "client_id": client_id,
        "redirect_uri": redirect_uri,
        "response_type": "code",
        "scope": "https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email",
        "access_type": "offline",
        "prompt": "consent",
        "state": current_user.get("username", "user")
    }

    auth_url = f"https://accounts.google.com/o/oauth2/v2/auth?{urlencode(params)}"
    return {"auth_url": auth_url}


@router.get("/google-callback")
@router.get("/api/google-callback")
@router.get("/integrations/google-drive/callback")
def google_callback(code: str = Query(...), state: str = Query(None)):
    """
    Receives authorization code from Google OAuth and exchanges it for access tokens.
    """
    client_id = os.getenv("GOOGLE_CLIENT_ID", "").strip()
    client_secret = os.getenv("GOOGLE_CLIENT_SECRET", "").strip()
    redirect_uri = os.getenv("GOOGLE_REDIRECT_URI", "").strip()

    if not client_id or not client_secret or not redirect_uri:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Google OAuth settings missing in backend .env file"
        )

    token_url = "https://oauth2.googleapis.com/token"
    payload = {
        "client_id": client_id,
        "client_secret": client_secret,
        "code": code,
        "grant_type": "authorization_code",
        "redirect_uri": redirect_uri,
    }

    try:
        response = requests.post(token_url, data=payload, timeout=10)
        token_data = response.json()

        if response.status_code != 200 or "error" in token_data:
            error_msg = token_data.get("error_description", token_data.get("error", "Failed code exchange"))
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"Google OAuth Error: {error_msg}"
            )

        access_token = token_data.get("access_token")
        refresh_token = token_data.get("refresh_token", "")

        from database import SessionLocal, GoogleOAuthSession
        import datetime

        username = state if state else "unknown"
        db = SessionLocal()
        try:
            db.query(GoogleOAuthSession).filter(GoogleOAuthSession.username == username).delete()
            oauth_sess = GoogleOAuthSession(
                username=username,
                access_token=access_token,
                refresh_token=refresh_token,
                expires_at=datetime.datetime.utcnow() + datetime.timedelta(seconds=token_data.get("expires_in", 3600))
            )
            db.add(oauth_sess)
            db.commit()
        except Exception as e:
            print(f"Warning: Could not save OAuth session to DB: {e}")
            db.rollback()
        finally:
            db.close()

        return {
            "status": "success",
            "message": "Google Drive connected successfully",
            "access_token": access_token,
            "refresh_token": refresh_token
        }

    except requests.RequestException as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Network error contacting Google OAuth servers: {str(err)}"
        )


@router.get("/integrations/google-drive/files")
@router.get("/api/drive/files")
def list_google_drive_files(
    access_token: Optional[str] = Query(None),
    current_user: dict = Security(verify_user_token)
):
    """
    Fetches the list of accessible files from Google Drive API.
    """
    token = access_token
    if not token:
        from database import SessionLocal, GoogleOAuthSession
        import datetime
        db = SessionLocal()
        try:
            sess = db.query(GoogleOAuthSession).filter(
                GoogleOAuthSession.username == current_user["username"],
                GoogleOAuthSession.expires_at > datetime.datetime.utcnow()
            ).first()
            if sess:
                token = sess.access_token
        finally:
            db.close()

    if not token:
        return {"files": []}

    url = "https://www.googleapis.com/drive/v3/files?fields=files(id,name,mimeType,size,modifiedTime)&pageSize=100"
    headers = {"Authorization": f"Bearer {token}"}

    try:
        resp = requests.get(url, headers=headers, timeout=10)
        if resp.status_code != 200:
            return {"files": []}

        drive_files = resp.json().get("files", [])
        result = []
        for f in drive_files:
            mime = f.get("mimeType", "")
            if mime == "application/vnd.google-apps.folder":
                continue

            size = int(f.get("size", 0)) if f.get("size") else 0
            result.append({
                "id": f.get("id"),
                "name": f.get("name"),
                "mimeType": mime,
                "size": size,
                "modifiedTime": f.get("modifiedTime"),
                "isGoogleDoc": mime.startswith("application/vnd.google-apps.")
            })

        return {"files": result}
    except Exception as e:
        print(f"Error fetching Google Drive files: {e}")
        return {"files": []}


@router.post("/integrations/google-drive/import")
@router.post("/api/drive/import")
def import_google_drive_file(
    payload: GoogleDriveImportRequest,
    current_user: dict = Security(verify_user_token)
):
    """
    Downloads a file from Google Drive, encrypts it with Fernet cipher, and stores it in storage_pool.
    """
    from database import SessionLocal, FileMetadata, GoogleOAuthSession
    from main import cipher_suite, STORAGE_DIR, invalidate_frequently_used_cache
    import datetime

    file_id = payload.file_id.strip()
    token = payload.access_token

    db = SessionLocal()
    try:
        if not token:
            sess = db.query(GoogleOAuthSession).filter(
                GoogleOAuthSession.username == current_user["username"],
                GoogleOAuthSession.expires_at > datetime.datetime.utcnow()
            ).first()
            if sess:
                token = sess.access_token

        if not token:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Google Drive is not connected. Please connect Google Drive first."
            )

        headers = {"Authorization": f"Bearer {token}"}

        meta_url = f"https://www.googleapis.com/drive/v3/files/{file_id}?fields=id,name,mimeType,size"
        meta_resp = requests.get(meta_url, headers=headers, timeout=10)

        if meta_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Failed to retrieve file metadata from Google Drive."
            )

        meta_data = meta_resp.json()
        original_name = payload.filename or meta_data.get("name", f"imported_file_{file_id}")
        mime_type = payload.mime_type or meta_data.get("mimeType", "")

        if mime_type.startswith("application/vnd.google-apps."):
            export_mime = "application/pdf"
            ext = ".pdf"
            if "document" in mime_type:
                export_mime = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
                ext = ".docx"
            elif "spreadsheet" in mime_type:
                export_mime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                ext = ".xlsx"

            if not original_name.endswith(ext):
                original_name = f"{original_name}{ext}"

            download_url = f"https://www.googleapis.com/drive/v3/files/{file_id}/export?mimeType={export_mime}"
        else:
            download_url = f"https://www.googleapis.com/drive/v3/files/{file_id}?alt=media"

        file_resp = requests.get(download_url, headers=headers, timeout=30)
        if file_resp.status_code != 200:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Unable to download selected file from Google Drive."
            )

        raw_data = file_resp.content
        file_size = len(raw_data)

        encrypted_data = cipher_suite.encrypt(raw_data)
        file_location = f"{STORAGE_DIR}/{original_name}.encrypted"

        with open(file_location, "wb+") as file_obj:
            file_obj.write(encrypted_data)

        db_file = FileMetadata(
            original_filename=original_name,
            encrypted_path=file_location,
            file_size_bytes=file_size,
            owner=current_user["username"]
        )
        db.add(db_file)
        db.commit()
        db.refresh(db_file)

        invalidate_frequently_used_cache(current_user["username"])

        return {
            "status": "success",
            "message": f"File '{original_name}' imported from Google Drive and encrypted successfully.",
            "database_id": db_file.id,
            "filename": original_name,
            "size": file_size
        }
    finally:
        db.close()