from fastapi import FastAPI, UploadFile, File, Form, HTTPException, Depends, Query
from fastapi.responses import Response, JSONResponse
from fastapi.security import OAuth2PasswordRequestForm
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
import os
import json
import redis
import datetime
import secrets
from cryptography.fernet import Fernet
from pydantic import BaseModel
from typing import Optional, List

# Import database models
from database import (
    SessionLocal, FileMetadata, User, PasswordResetToken, OTPRecord, 
    UserSession, SignupVerificationToken, SharedFile, FileShareRecipient, GoogleOAuthSession,
    Folder
)

# Import authentication & security helpers
import auth
from auth import verify_user_token, hash_password, verify_password, hash_token, create_user_session

# Import email service
from email_service import send_password_reset_email, send_otp_email, is_smtp_configured

app = FastAPI(title="Cloud Storage Backend")

# Include auth router for /api/drive/auth-url and /google-callback routes
app.include_router(auth.router)

# --- SAFE & NON-BLOCKING REDIS INITIALIZATION ---
try:
    redis_client = redis.Redis(
        host="localhost",
        port=6379,
        decode_responses=True,
        socket_connect_timeout=0.1,  # Fails instantly in 100ms if Redis is down
        socket_timeout=0.1,
        retry_on_timeout=False
    )
    redis_client.ping()
    REDIS_AVAILABLE = True
except Exception:
    REDIS_AVAILABLE = False


@app.on_event("startup")
async def startup_event():
    try:
        redis_client.ping()
        print("✅ Redis connected successfully!")
    except Exception:
        print("⚠️ Redis is offline — falling back to SQLite database mode.")


def invalidate_frequently_used_cache(username: str):
    if not REDIS_AVAILABLE:
        return
    try:
        redis_client.delete(f"frequently_used:{username}")
    except Exception:
        pass  # Ignore cache errors if Redis is offline

FREQUENT_FILES_CACHE_TTL = 60

allowed_origins_env = os.getenv("ALLOWED_ORIGINS", "").strip()
if allowed_origins_env:
    cors_origins = [o.strip() for o in allowed_origins_env.split(",") if o.strip()]
else:
    cors_origins = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
    ]

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- DATABASE DEPENDENCY ---
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()

# Storage directory setup
STORAGE_DIR = "storage_pool"
os.makedirs(STORAGE_DIR, exist_ok=True)

# --- ENCRYPTION SETUP ---
KEY_FILE = "secret.key"

def load_or_create_key():
    if not os.path.exists(KEY_FILE):
        key = Fernet.generate_key()
        with open(KEY_FILE, "wb") as key_file:
            key_file.write(key)
    else:
        with open(KEY_FILE, "rb") as key_file:
            key = key_file.read()
    return key

encryption_key = load_or_create_key()
cipher_suite = Fernet(encryption_key)

# --- PYDANTIC REQUEST SCHEMAS ---
class ForgotPasswordRequest(BaseModel):
    email: str

class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

class Verify2FARequest(BaseModel):
    username: str
    otp_code: str

class Resend2FARequest(BaseModel):
    username: str
    purpose: str = "login"

class ChangePasswordRequest(BaseModel):
    current_password: str
    new_password: str

class Enable2FARequest(BaseModel):
    current_password: str

class Enable2FAConfirm(BaseModel):
    otp_code: str

class Disable2FARequest(BaseModel):
    current_password: str

class Disable2FAConfirm(BaseModel):
    otp_code: str

class SignupOTPRequest(BaseModel):
    username: str
    email: str

class SignupVerifyOTPRequest(BaseModel):
    email: str
    otp_code: str

class SignupCreateAccountRequest(BaseModel):
    username: str
    email: str
    verification_token: str
    password: str

class CreateShareRequest(BaseModel):
    share_type: str = "public"
    expiration_days: Optional[int] = None
    allow_download: bool = True
    password: Optional[str] = None
    recipient_emails: Optional[List[str]] = None

class VerifySharePasswordRequest(BaseModel):
    password: str

class EditShareRequest(BaseModel):
    expiration_days: Optional[int] = None
    allow_download: Optional[bool] = None
    password: Optional[str] = None
    recipient_emails: Optional[List[str]] = None

class GoogleDriveImportRequest(BaseModel):
    file_id: str
    access_token: Optional[str] = None
    mime_type: Optional[str] = None
    filename: Optional[str] = None

class CreateFolderRequest(BaseModel):
    name: str

class MoveFileRequest(BaseModel):
    folder_id: Optional[int] = None


def mask_email(email: str) -> str:
    if not email or "@" not in email:
        return email or ""
    name, domain = email.split("@", 1)
    if len(name) <= 2:
        masked_name = name[0] + "*"
    else:
        masked_name = name[:2] + "*" * (len(name) - 2)
    return f"{masked_name}@{domain}"


@app.get("/")
def read_root():
    return {"message": "Cloud Storage Backend is running!"}

# --- TOKEN LOGIN ENDPOINT ---
@app.post("/token")
async def login(
    form_data: OAuth2PasswordRequestForm = Depends(),
    db: Session = Depends(get_db)
):
    login_identifier = form_data.username.strip()
    password = form_data.password.strip()

    if not login_identifier or not password:
        raise HTTPException(status_code=400, detail="Email/Username and password are required")

    user = db.query(User).filter(
        (User.email.ilike(login_identifier)) | (User.username == login_identifier)
    ).first()

    if not user or not verify_password(password, user.password_hash, user.salt):
        raise HTTPException(status_code=401, detail="Invalid email/username or password")

    if user.two_factor_enabled:
        user_email = user.email

        if not is_smtp_configured():
            raise HTTPException(
                status_code=400,
                detail="Email verification is currently unavailable. Please configure SMTP settings."
            )

        otp_code = f"{secrets.randbelow(1000000):06d}"
        otp_hash = hash_token(otp_code)

        db.query(OTPRecord).filter(
            (OTPRecord.username == user.username) | (OTPRecord.email.ilike(user.email)),
            OTPRecord.purpose == "login",
            OTPRecord.used_at == None
        ).update({"used_at": datetime.datetime.utcnow()}, synchronize_session=False)

        new_otp = OTPRecord(
            username=user.username,
            email=user_email,
            otp_hash=otp_hash,
            purpose="login",
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=5),
            attempts=0
        )
        db.add(new_otp)
        db.commit()

        email_dispatch = send_otp_email(user_email, otp_code, user.username, purpose="login")
        if not email_dispatch.get("delivered"):
            raise HTTPException(
                status_code=400,
                detail="Unable to send verification email. Please check the email/SMTP configuration."
            )

        return {
            "requires_2fa": True,
            "username": user.username,
            "email": user_email,
            "masked_email": mask_email(user_email),
            "message": f"Two-Step Verification code sent to {mask_email(user_email)}.",
            "smtp_configured": True
        }

    token_val = create_user_session(db, user.username)
    return {"access_token": token_val, "token_type": "bearer", "requires_2fa": False, "username": user.username}


# --- 2FA VERIFICATION ENDPOINT ---
@app.post("/auth/verify-2fa")
async def verify_2fa(
    payload: Verify2FARequest,
    db: Session = Depends(get_db)
):
    username = payload.username.strip()
    otp_code = payload.otp_code.strip()

    if not username or not otp_code:
        raise HTTPException(status_code=400, detail="Username and verification code are required")

    user = db.query(User).filter(
        (User.username == username) | (User.email.ilike(username))
    ).first()

    target_username = user.username if user else username
    target_email = user.email if user else username

    otp_record = db.query(OTPRecord).filter(
        (OTPRecord.username == target_username) | (OTPRecord.email.ilike(target_email)),
        OTPRecord.purpose == "login",
        OTPRecord.used_at == None,
        OTPRecord.expires_at > datetime.datetime.utcnow()
    ).order_by(OTPRecord.id.desc()).first()

    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code. Please request a new code.")

    if otp_record.attempts >= 5:
        otp_record.used_at = datetime.datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=400, detail="Maximum verification attempts exceeded. Please request a new code.")

    incoming_hash = hash_token(otp_code)
    if incoming_hash != otp_record.otp_hash:
        otp_record.attempts += 1
        db.commit()
        remaining = 5 - otp_record.attempts
        raise HTTPException(status_code=400, detail=f"Invalid verification code. {remaining} attempt(s) remaining.")

    otp_record.used_at = datetime.datetime.utcnow()
    db.commit()

    token_val = create_user_session(db, target_username)
    return {"access_token": token_val, "token_type": "bearer", "username": target_username}


# --- RESEND 2FA OTP ENDPOINT ---
@app.post("/auth/resend-2fa-otp")
async def resend_2fa_otp(
    payload: Resend2FARequest,
    db: Session = Depends(get_db)
):
    if not is_smtp_configured():
        raise HTTPException(
            status_code=400,
            detail="Email verification is currently unavailable. Please configure SMTP settings."
        )

    username = payload.username.strip()
    purpose = payload.purpose.strip()

    user = db.query(User).filter(
        (User.username == username) | (User.email.ilike(username))
    ).first()
    if not user:
        raise HTTPException(status_code=400, detail="User account not found")

    latest_otp = db.query(OTPRecord).filter(
        (OTPRecord.username == user.username) | (OTPRecord.email.ilike(user.email)),
        OTPRecord.purpose == purpose
    ).order_by(OTPRecord.id.desc()).first()

    if latest_otp and latest_otp.created_at:
        seconds_since = (datetime.datetime.utcnow() - latest_otp.created_at).total_seconds()
        if seconds_since < 30:
            cooldown_left = int(30 - seconds_since)
            raise HTTPException(status_code=429, detail=f"Please wait {cooldown_left} seconds before requesting a new code.")

    otp_code = f"{secrets.randbelow(1000000):06d}"
    otp_hash = hash_token(otp_code)
    user_email = user.email

    db.query(OTPRecord).filter(
        (OTPRecord.username == user.username) | (OTPRecord.email.ilike(user.email)),
        OTPRecord.purpose == purpose,
        OTPRecord.used_at == None
    ).update({"used_at": datetime.datetime.utcnow()}, synchronize_session=False)

    new_otp = OTPRecord(
        username=user.username,
        email=user_email,
        otp_hash=otp_hash,
        purpose=purpose,
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=5),
        attempts=0
    )
    db.add(new_otp)
    db.commit()

    email_dispatch = send_otp_email(user_email, otp_code, user.username, purpose=purpose)
    if not email_dispatch.get("delivered"):
        raise HTTPException(
            status_code=400,
            detail="Unable to send verification email. Please check the email/SMTP configuration."
        )

    return {
        "status": "success",
        "message": "Verification code resent.",
        "smtp_configured": True
    }


# --- FORGOT PASSWORD ENDPOINT ---
@app.post("/auth/forgot-password")
async def forgot_password(
    payload: ForgotPasswordRequest,
    db: Session = Depends(get_db)
):
    if not is_smtp_configured():
        raise HTTPException(
            status_code=400,
            detail="Email verification is currently unavailable. Please configure SMTP settings."
        )

    email = payload.email.strip().lower()

    if not email or "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    user = db.query(User).filter(User.email.ilike(email)).first()

    if user and user.email:
        raw_token = secrets.token_urlsafe(32)
        token_hash = hash_token(raw_token)

        db.query(PasswordResetToken).filter(
            PasswordResetToken.username == user.username,
            PasswordResetToken.used_at == None
        ).update({"used_at": datetime.datetime.utcnow()})

        reset_record = PasswordResetToken(
            username=user.username,
            email=user.email,
            token_hash=token_hash,
            expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=20),
            used_at=None
        )
        db.add(reset_record)
        db.commit()

        email_dispatch = send_password_reset_email(user.email, raw_token, user.username)
        if not email_dispatch.get("delivered"):
            raise HTTPException(
                status_code=400,
                detail="Unable to send password reset email. Please check the SMTP configuration."
            )

    return {
        "status": "success",
        "message": "If an account exists for this email, a password reset link has been sent.",
        "smtp_configured": True
    }


# --- RESET PASSWORD ENDPOINT ---
@app.post("/auth/reset-password")
async def reset_password(
    payload: ResetPasswordRequest,
    db: Session = Depends(get_db)
):
    raw_token = payload.token.strip()
    new_pass = payload.new_password.strip()

    if not raw_token:
        raise HTTPException(status_code=400, detail="Reset token is required")

    if len(new_pass) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long")

    token_hash = hash_token(raw_token)
    token_record = db.query(PasswordResetToken).filter(
        PasswordResetToken.token_hash == token_hash,
        PasswordResetToken.used_at == None,
        PasswordResetToken.expires_at > datetime.datetime.utcnow()
    ).first()

    if not token_record:
        raise HTTPException(status_code=400, detail="Invalid or expired password reset link.")

    user = db.query(User).filter(User.username == token_record.username).first()
    if not user:
        raise HTTPException(status_code=400, detail="User account not found.")

    if verify_password(new_pass, user.password_hash, user.salt):
        raise HTTPException(status_code=400, detail="New password cannot be identical to your current password.")

    new_hash, new_salt = hash_password(new_pass)
    user.password_hash = new_hash
    user.salt = new_salt
    token_record.used_at = datetime.datetime.utcnow()
    db.commit()

    return {"status": "success", "message": "Password updated successfully. You can now log in with your new password."}


# --- NEW USER SIGNUP ENDPOINTS ---
@app.post("/auth/signup/request-otp")
async def signup_request_otp(
    payload: SignupOTPRequest,
    db: Session = Depends(get_db)
):
    username = payload.username.strip()
    email = payload.email.strip().lower()

    if not username or len(username) < 3:
        raise HTTPException(status_code=400, detail="Please enter a valid name or username (at least 3 characters).")

    if not email or "@" not in email or "." not in email:
        raise HTTPException(status_code=400, detail="Please enter a valid email address.")

    existing_user_by_name = db.query(User).filter(User.username == username).first()
    if existing_user_by_name:
        raise HTTPException(status_code=400, detail="This name/username is already registered. Please log in or use a different name.")

    existing_user_by_email = db.query(User).filter(User.email.ilike(email)).first()
    if existing_user_by_email:
        raise HTTPException(status_code=400, detail="This email address is already registered. Please log in instead.")

    if not is_smtp_configured():
        raise HTTPException(
            status_code=400,
            detail="Email verification is currently unavailable. Please configure SMTP settings."
        )

    latest_otp = db.query(OTPRecord).filter(
        OTPRecord.email == email,
        OTPRecord.purpose == "signup"
    ).order_by(OTPRecord.id.desc()).first()

    if latest_otp and latest_otp.created_at:
        seconds_since = (datetime.datetime.utcnow() - latest_otp.created_at).total_seconds()
        if seconds_since < 30:
            cooldown_left = int(30 - seconds_since)
            raise HTTPException(status_code=429, detail=f"Please wait {cooldown_left} seconds before requesting a new code.")

    db.query(OTPRecord).filter(
        OTPRecord.email == email,
        OTPRecord.purpose == "signup",
        OTPRecord.used_at == None
    ).update({"used_at": datetime.datetime.utcnow()})

    otp_code = f"{secrets.randbelow(1000000):06d}"
    otp_hash = hash_token(otp_code)

    new_otp = OTPRecord(
        username=username,
        email=email,
        otp_hash=otp_hash,
        purpose="signup",
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=5),
        attempts=0
    )
    db.add(new_otp)
    db.commit()

    email_dispatch = send_otp_email(email, otp_code, username, purpose="signup")
    if not email_dispatch.get("delivered"):
        raise HTTPException(
            status_code=400,
            detail="Unable to send verification email. Please check the email/SMTP configuration."
        )

    return {
        "status": "success",
        "message": f"Verification code sent to {mask_email(email)}.",
        "email": email,
        "masked_email": mask_email(email),
        "smtp_configured": True
    }


@app.post("/auth/signup/verify-otp")
async def signup_verify_otp(
    payload: SignupVerifyOTPRequest,
    db: Session = Depends(get_db)
):
    email = payload.email.strip().lower()
    otp_code = payload.otp_code.strip()

    if not email or not otp_code:
        raise HTTPException(status_code=400, detail="Email and verification code are required.")

    otp_record = db.query(OTPRecord).filter(
        OTPRecord.email == email,
        OTPRecord.purpose == "signup",
        OTPRecord.used_at == None,
        OTPRecord.expires_at > datetime.datetime.utcnow()
    ).order_by(OTPRecord.id.desc()).first()

    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code. Please request a new code.")

    if otp_record.attempts >= 5:
        otp_record.used_at = datetime.datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=400, detail="Maximum verification attempts exceeded. Please request a new code.")

    if hash_token(otp_code) != otp_record.otp_hash:
        otp_record.attempts += 1
        db.commit()
        remaining = 5 - otp_record.attempts
        raise HTTPException(status_code=400, detail=f"Invalid verification code. {remaining} attempt(s) remaining.")

    otp_record.used_at = datetime.datetime.utcnow()

    raw_token = secrets.token_urlsafe(32)
    token_hash = hash_token(raw_token)

    db.query(SignupVerificationToken).filter(
        SignupVerificationToken.email == email,
        SignupVerificationToken.used_at == None
    ).update({"used_at": datetime.datetime.utcnow()})

    signup_token_rec = SignupVerificationToken(
        username=otp_record.username,
        email=email,
        token_hash=token_hash,
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=15),
        used_at=None
    )
    db.add(signup_token_rec)
    db.commit()

    return {
        "status": "success",
        "message": "Email verified successfully.",
        "verification_token": raw_token
    }


@app.post("/auth/signup/create-account")
async def signup_create_account(
    payload: SignupCreateAccountRequest,
    db: Session = Depends(get_db)
):
    username = payload.username.strip()
    email = payload.email.strip().lower()
    raw_token = payload.verification_token.strip()
    password = payload.password.strip()

    if not username or not email or not raw_token or not password:
        raise HTTPException(status_code=400, detail="All fields are required.")

    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters long.")

    token_hash = hash_token(raw_token)
    token_rec = db.query(SignupVerificationToken).filter(
        SignupVerificationToken.token_hash == token_hash,
        SignupVerificationToken.used_at == None,
        SignupVerificationToken.expires_at > datetime.datetime.utcnow()
    ).first()

    if not token_rec or token_rec.email.lower() != email or token_rec.username != username:
        raise HTTPException(status_code=400, detail="Invalid, expired, or mismatched verification session. Please verify email again.")

    if db.query(User).filter(User.username == username).first():
        raise HTTPException(status_code=400, detail="Username is already registered.")

    if db.query(User).filter(User.email.ilike(email)).first():
        raise HTTPException(status_code=400, detail="Email address is already registered.")

    pwd_hash, pwd_salt = hash_password(password)

    new_user = User(
        username=username,
        email=email,
        password_hash=pwd_hash,
        salt=pwd_salt,
        two_factor_enabled=False
    )
    db.add(new_user)

    token_rec.used_at = datetime.datetime.utcnow()
    db.commit()

    return {
        "status": "success",
        "message": "Account created successfully. Please log in."
    }


# --- 2FA SETTINGS MANAGEMENT ENDPOINTS ---
@app.get("/auth/2fa-status")
async def get_2fa_status(
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_user_token)
):
    username = current_user.get("username")
    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    user_email = user.email or ""
    return {
        "two_factor_enabled": bool(user.two_factor_enabled),
        "email": user_email,
        "masked_email": mask_email(user_email)
    }


@app.post("/auth/2fa/enable-request")
async def enable_2fa_request(
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_user_token)
):
    if not is_smtp_configured():
        raise HTTPException(
            status_code=400,
            detail="Email verification is currently unavailable. Please configure SMTP settings."
        )

    username = current_user.get("username")
    user = db.query(User).filter(User.username == username).first()
    if not user or not user.email:
        raise HTTPException(status_code=404, detail="User account or registered email not found")

    user_email = user.email
    otp_code = f"{secrets.randbelow(1000000):06d}"
    otp_hash = hash_token(otp_code)

    db.query(OTPRecord).filter(
        OTPRecord.username == username,
        OTPRecord.purpose == "enable_2fa",
        OTPRecord.used_at == None
    ).update({"used_at": datetime.datetime.utcnow()})

    new_otp = OTPRecord(
        username=username,
        email=user_email,
        otp_hash=otp_hash,
        purpose="enable_2fa",
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=5),
        attempts=0
    )
    db.add(new_otp)
    db.commit()

    email_dispatch = send_otp_email(user_email, otp_code, username, purpose="enable_2fa")
    if not email_dispatch.get("delivered"):
        raise HTTPException(
            status_code=400,
            detail="Unable to send verification email. Please check the email/SMTP configuration."
        )

    return {
        "status": "success",
        "message": f"Verification code sent to {mask_email(user_email)}.",
        "email": user_email,
        "masked_email": mask_email(user_email),
        "smtp_configured": True
    }


@app.post("/auth/2fa/enable-confirm")
async def enable_2fa_confirm(
    payload: Enable2FAConfirm,
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_user_token)
):
    username = current_user.get("username")
    otp_code = payload.otp_code.strip()

    otp_record = db.query(OTPRecord).filter(
        OTPRecord.username == username,
        OTPRecord.purpose == "enable_2fa",
        OTPRecord.used_at == None,
        OTPRecord.expires_at > datetime.datetime.utcnow()
    ).order_by(OTPRecord.id.desc()).first()

    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")

    if otp_record.attempts >= 5:
        otp_record.used_at = datetime.datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=400, detail="Maximum verification attempts exceeded. Please request a new code.")

    if hash_token(otp_code) != otp_record.otp_hash:
        otp_record.attempts += 1
        db.commit()
        remaining = 5 - otp_record.attempts
        raise HTTPException(status_code=400, detail=f"Invalid verification code. {remaining} attempt(s) remaining.")

    otp_record.used_at = datetime.datetime.utcnow()
    user = db.query(User).filter(User.username == username).first()
    if user:
        user.two_factor_enabled = True
    db.commit()

    return {"status": "success", "message": "Two-Step Verification enabled successfully."}


@app.post("/auth/2fa/disable-request")
async def disable_2fa_request(
    payload: Disable2FARequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_user_token)
):
    username = current_user.get("username")
    curr_pass = payload.current_password.strip()

    user = db.query(User).filter(User.username == username).first()
    if not user or not verify_password(curr_pass, user.password_hash, user.salt):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    if not is_smtp_configured():
        raise HTTPException(
            status_code=400,
            detail="Email verification is currently unavailable. Please configure SMTP settings."
        )

    user_email = user.email
    otp_code = f"{secrets.randbelow(1000000):06d}"
    otp_hash = hash_token(otp_code)

    db.query(OTPRecord).filter(
        OTPRecord.username == username,
        OTPRecord.purpose == "disable_2fa",
        OTPRecord.used_at == None
    ).update({"used_at": datetime.datetime.utcnow()})

    new_otp = OTPRecord(
        username=username,
        email=user_email,
        otp_hash=otp_hash,
        purpose="disable_2fa",
        expires_at=datetime.datetime.utcnow() + datetime.timedelta(minutes=5),
        attempts=0
    )
    db.add(new_otp)
    db.commit()

    email_dispatch = send_otp_email(user_email, otp_code, username, purpose="disable_2fa")
    if not email_dispatch.get("delivered"):
        raise HTTPException(
            status_code=400,
            detail="Unable to send verification email. Please check the email/SMTP configuration."
        )

    return {
        "status": "success",
        "message": f"Verification code sent to {mask_email(user_email)}.",
        "email": user_email,
        "masked_email": mask_email(user_email),
        "smtp_configured": True
    }


@app.post("/auth/2fa/disable-confirm")
async def disable_2fa_confirm(
    payload: Disable2FAConfirm,
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_user_token)
):
    username = current_user.get("username")
    otp_code = payload.otp_code.strip()

    otp_record = db.query(OTPRecord).filter(
        OTPRecord.username == username,
        OTPRecord.purpose == "disable_2fa",
        OTPRecord.used_at == None,
        OTPRecord.expires_at > datetime.datetime.utcnow()
    ).order_by(OTPRecord.id.desc()).first()

    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid or expired verification code.")

    if otp_record.attempts >= 5:
        otp_record.used_at = datetime.datetime.utcnow()
        db.commit()
        raise HTTPException(status_code=400, detail="Maximum verification attempts exceeded. Please request a new code.")

    if hash_token(otp_code) != otp_record.otp_hash:
        otp_record.attempts += 1
        db.commit()
        remaining = 5 - otp_record.attempts
        raise HTTPException(status_code=400, detail=f"Invalid verification code. {remaining} attempt(s) remaining.")

    otp_record.used_at = datetime.datetime.utcnow()
    user = db.query(User).filter(User.username == username).first()
    if user:
        user.two_factor_enabled = False
    db.commit()

    return {"status": "success", "message": "Two-Step Verification has been disabled."}


# --- CHANGE PASSWORD ENDPOINT ---
@app.patch("/auth/change-password")
async def change_password(
    payload: ChangePasswordRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_user_token)
):
    username = current_user.get("username")
    curr_pass = payload.current_password.strip()
    new_pass = payload.new_password.strip()

    if not curr_pass or not new_pass:
        raise HTTPException(status_code=400, detail="Current password and new password are required")

    if len(new_pass) < 6:
        raise HTTPException(status_code=400, detail="New password must be at least 6 characters long")

    if curr_pass == new_pass:
        raise HTTPException(status_code=400, detail="New password cannot be identical to current password")

    user = db.query(User).filter(User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="User account not found")

    if not verify_password(curr_pass, user.password_hash, user.salt):
        raise HTTPException(status_code=400, detail="Current password is incorrect")

    new_hash, new_salt = hash_password(new_pass)
    user.password_hash = new_hash
    user.salt = new_salt
    db.commit()

    return {"status": "success", "message": "Password changed successfully"}


# --- FOLDER MANAGEMENT ENDPOINTS ---

@app.post("/folders")
async def create_folder(
    payload: CreateFolderRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_user_token)
):
    folder_name = payload.name.strip()
    if not folder_name:
        raise HTTPException(status_code=400, detail="Folder name cannot be empty.")

    existing = db.query(Folder).filter(
        Folder.name == folder_name,
        Folder.owner == current_user["username"]
    ).first()

    if existing:
        raise HTTPException(status_code=400, detail="A folder with this name already exists.")

    new_folder = Folder(name=folder_name, owner=current_user["username"])
    db.add(new_folder)
    db.commit()
    db.refresh(new_folder)

    return {"status": "success", "folder": {"id": new_folder.id, "name": new_folder.name}}


@app.get("/folders")
async def list_folders(
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_user_token)
):
    folders = db.query(Folder).filter(Folder.owner == current_user["username"]).all()
    result = []
    for f in folders:
        file_count = db.query(FileMetadata).filter(FileMetadata.folder_id == f.id).count()
        result.append({
            "id": f.id,
            "name": f.name,
            "created_at": f.created_at.isoformat() if f.created_at else None,
            "file_count": file_count
        })
    return result


@app.delete("/folders/{folder_id}")
async def delete_folder(
    folder_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_user_token)
):
    folder = db.query(Folder).filter(
        Folder.id == folder_id,
        Folder.owner == current_user["username"]
    ).first()

    if not folder:
        raise HTTPException(status_code=404, detail="Folder not found.")

    # Unassign files from deleted folder (move back to root)
    db.query(FileMetadata).filter(FileMetadata.folder_id == folder_id).update({"folder_id": None})
    db.delete(folder)
    db.commit()

    return {"status": "success", "message": "Folder deleted successfully."}


@app.patch("/files/{file_id}/move")
async def move_file_to_folder(
    file_id: int,
    payload: MoveFileRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_user_token)
):
    file_rec = db.query(FileMetadata).filter(
        FileMetadata.id == file_id,
        FileMetadata.owner == current_user["username"]
    ).first()

    if not file_rec:
        raise HTTPException(status_code=404, detail="File not found.")

    if payload.folder_id is not None:
        folder = db.query(Folder).filter(
            Folder.id == payload.folder_id,
            Folder.owner == current_user["username"]
        ).first()
        if not folder:
            raise HTTPException(status_code=404, detail="Target folder not found.")

    file_rec.folder_id = payload.folder_id
    db.commit()

    return {"status": "success", "message": "File moved successfully."}


# --- FILE ENDPOINTS ---

@app.post("/upload")
async def upload_file(
    file: UploadFile = File(...), 
    folder_id: Optional[int] = Form(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_user_token)
):
    file_location = f"{STORAGE_DIR}/{file.filename}.encrypted"
    
    raw_data = await file.read()
    file_size = len(raw_data)
    encrypted_data = cipher_suite.encrypt(raw_data)
    
    with open(file_location, "wb+") as file_object:
        file_object.write(encrypted_data)
        
    db_file = FileMetadata(
        original_filename=file.filename,
        encrypted_path=file_location,
        file_size_bytes=file_size,
        owner=current_user["username"],
        folder_id=folder_id
    )
    db.add(db_file)
    db.commit()
    db.refresh(db_file)
    
    invalidate_frequently_used_cache(current_user["username"])
        
    return {
        "filename": file.filename,
        "status": "success",
        "database_id": db_file.id,
        "folder_id": db_file.folder_id,
        "owner": current_user["username"],
        "message": "File encrypted, saved securely, and metadata logged!"
    }


@app.get("/download/{filename}")
async def download_file(
    filename: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_user_token)
):
    db_file = db.query(FileMetadata).filter(
        FileMetadata.original_filename == filename,
        FileMetadata.owner == current_user["username"]
    ).first()

    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    file_location = db_file.encrypted_path

    if not os.path.exists(file_location):
        raise HTTPException(status_code=404, detail="File not found on server")

    db_file.access_count = (db_file.access_count or 0) + 1
    db_file.last_accessed = datetime.datetime.utcnow()

    db.commit()
    invalidate_frequently_used_cache(current_user["username"])

    with open(file_location, "rb") as file_object:
        encrypted_data = file_object.read()

    try:
        decrypted_data = cipher_suite.decrypt(encrypted_data)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to decrypt the file. Key might be invalid.")

    return Response(
        content=decrypted_data,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )


@app.get("/files")
async def list_files(
    folder_id: Optional[int] = Query(None),
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_user_token)
):
    query = db.query(FileMetadata).filter(FileMetadata.owner == current_user["username"])

    if folder_id is not None:
        query = query.filter(FileMetadata.folder_id == folder_id)

    files = query.order_by(FileMetadata.upload_time.desc()).all()

    return [
        {
            "id": file.id,
            "filename": file.original_filename,
            "size": file.file_size_bytes,
            "uploaded_at": file.upload_time,
            "owner": file.owner,
            "folder_id": file.folder_id
        }
        for file in files
    ]


@app.delete("/files/{file_id}")
async def delete_file(
    file_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_user_token)
):
    db_file = db.query(FileMetadata).filter(
        FileMetadata.id == file_id,
        FileMetadata.owner == current_user["username"]
    ).first()

    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    if os.path.exists(db_file.encrypted_path):
        os.remove(db_file.encrypted_path)

    db.delete(db_file)
    db.commit()
    
    invalidate_frequently_used_cache(current_user["username"])
    return {"status": "success", "message": "File deleted successfully"}


@app.patch("/files/{file_id}")
async def rename_file(
    file_id: int,
    new_filename: str,
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_user_token)
):
    db_file = db.query(FileMetadata).filter(
        FileMetadata.id == file_id,
        FileMetadata.owner == current_user["username"]
    ).first()

    if not db_file:
        raise HTTPException(status_code=404, detail="File not found")

    new_filename = os.path.basename(new_filename).strip()

    if not new_filename:
        raise HTTPException(status_code=400, detail="Filename cannot be empty")

    old_path = db_file.encrypted_path
    new_path = f"{STORAGE_DIR}/{new_filename}.encrypted"

    if os.path.exists(new_path) and new_path != old_path:
        raise HTTPException(status_code=409, detail="A file with this name already exists")

    if os.path.exists(old_path):
        os.rename(old_path, new_path)

    db_file.original_filename = new_filename
    db_file.encrypted_path = new_path

    db.commit()
    db.refresh(db_file)
    
    invalidate_frequently_used_cache(current_user["username"])

    return {
        "status": "success",
        "message": "File renamed successfully",
        "filename": db_file.original_filename
    }


# --- SAFE FREQUENTLY USED ENDPOINT ---
@app.get("/files/frequently-used")
async def frequently_used_files(
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_user_token)
):
    cache_key = f"frequently_used:{current_user['username']}"

    # 1. Try reading from Redis cache if available
    if REDIS_AVAILABLE:
        try:
            cached_data = redis_client.get(cache_key)
            if cached_data:
                return json.loads(cached_data)
        except Exception:
            pass

    # 2. Direct SQLite Query
    files = db.query(FileMetadata).filter(
        FileMetadata.owner == current_user["username"]
    ).order_by(
        FileMetadata.access_count.desc(),
        FileMetadata.last_accessed.desc()
    ).limit(10).all()

    result = [
        {
            "id": file.id,
            "filename": file.original_filename,
            "size": file.file_size_bytes,
            "uploaded_at": file.upload_time.isoformat() if file.upload_time else None,
            "access_count": file.access_count or 0,
            "last_accessed": file.last_accessed.isoformat() if file.last_accessed else None,
            "folder_id": file.folder_id
        }
        for file in files
    ]

    # 3. Try writing back to cache
    if REDIS_AVAILABLE:
        try:
            redis_client.setex(cache_key, FREQUENT_FILES_CACHE_TTL, json.dumps(result))
        except Exception:
            pass

    return result


# ==============================================================================
# SECURE FILE SHARING ENDPOINTS
# ==============================================================================

@app.post("/files/{file_id}/share")
async def create_file_share(
    file_id: int,
    payload: CreateShareRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_user_token)
):
    db_file = db.query(FileMetadata).filter(
        FileMetadata.id == file_id,
        FileMetadata.owner == current_user["username"]
    ).first()

    if not db_file:
        raise HTTPException(status_code=404, detail="File not found or access denied")

    share_token = secrets.token_urlsafe(32)

    expires_at = None
    if payload.expiration_days and payload.expiration_days > 0:
        expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=payload.expiration_days)

    pwd_hash = None
    pwd_salt = None
    if payload.password and payload.password.strip():
        pwd_hash, pwd_salt = hash_password(payload.password.strip())

    share_record = SharedFile(
        file_id=file_id,
        owner=current_user["username"],
        share_token=share_token,
        share_type=payload.share_type,
        expires_at=expires_at,
        password_hash=pwd_hash,
        salt=pwd_salt,
        download_allowed=payload.allow_download,
        is_active=True,
        access_count=0
    )
    db.add(share_record)
    db.commit()
    db.refresh(share_record)

    if payload.share_type == "private" and payload.recipient_emails:
        for email_addr in payload.recipient_emails:
            clean_email = email_addr.strip().lower()
            if clean_email:
                recipient = FileShareRecipient(
                    share_id=share_record.id,
                    recipient_email=clean_email
                )
                db.add(recipient)
        db.commit()

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    share_url = f"{frontend_url}/shared/{share_token}"

    return {
        "status": "success",
        "share_id": share_record.id,
        "share_token": share_token,
        "share_url": share_url,
        "share_type": share_record.share_type,
        "expires_at": share_record.expires_at.isoformat() if share_record.expires_at else None,
        "allow_download": share_record.download_allowed,
        "password_protected": bool(pwd_hash)
    }


@app.get("/shared-by-me")
async def get_shared_by_me(
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_user_token)
):
    shares = db.query(SharedFile).filter(
        SharedFile.owner == current_user["username"]
    ).order_by(SharedFile.created_at.desc()).all()

    result = []
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")

    for s in shares:
        file_rec = db.query(FileMetadata).filter(FileMetadata.id == s.file_id).first()
        filename = file_rec.original_filename if file_rec else "Unknown File"
        size = file_rec.file_size_bytes if file_rec else 0

        is_expired = s.expires_at is not None and s.expires_at <= datetime.datetime.utcnow()
        if not s.is_active:
            status_str = "Revoked"
        elif is_expired:
            status_str = "Expired"
        else:
            status_str = "Active"

        recipients = [r.recipient_email for r in db.query(FileShareRecipient).filter(FileShareRecipient.share_id == s.id).all()]

        result.append({
            "share_id": s.id,
            "share_token": s.share_token,
            "share_url": f"{frontend_url}/shared/{s.share_token}",
            "file_id": s.file_id,
            "filename": filename,
            "size": size,
            "share_type": s.share_type,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "expires_at": s.expires_at.isoformat() if s.expires_at else None,
            "download_allowed": s.download_allowed,
            "is_active": s.is_active,
            "status": status_str,
            "access_count": s.access_count or 0,
            "password_protected": bool(s.password_hash),
            "recipients": recipients
        })

    return result


@app.patch("/shared-by-me/{share_id}/revoke")
async def revoke_share_link(
    share_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_user_token)
):
    share_rec = db.query(SharedFile).filter(
        SharedFile.id == share_id,
        SharedFile.owner == current_user["username"]
    ).first()

    if not share_rec:
        raise HTTPException(status_code=404, detail="Share link not found or access denied")

    share_rec.is_active = False
    db.commit()

    return {"status": "success", "message": "Share link revoked successfully."}


@app.patch("/shared-by-me/{share_id}/edit")
async def edit_share_link(
    share_id: int,
    payload: EditShareRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_user_token)
):
    share_rec = db.query(SharedFile).filter(
        SharedFile.id == share_id,
        SharedFile.owner == current_user["username"]
    ).first()

    if not share_rec:
        raise HTTPException(status_code=404, detail="Share link not found or access denied")

    if payload.expiration_days is not None:
        if payload.expiration_days > 0:
            share_rec.expires_at = datetime.datetime.utcnow() + datetime.timedelta(days=payload.expiration_days)
        else:
            share_rec.expires_at = None

    if payload.allow_download is not None:
        share_rec.download_allowed = payload.allow_download

    if payload.password is not None:
        if payload.password.strip():
            pwd_hash, pwd_salt = hash_password(payload.password.strip())
            share_rec.password_hash = pwd_hash
            share_rec.salt = pwd_salt
        else:
            share_rec.password_hash = None
            share_rec.salt = None

    if payload.recipient_emails is not None:
        db.query(FileShareRecipient).filter(FileShareRecipient.share_id == share_rec.id).delete()
        for email_addr in payload.recipient_emails:
            clean_email = email_addr.strip().lower()
            if clean_email:
                db.add(FileShareRecipient(share_id=share_rec.id, recipient_email=clean_email))

    db.commit()
    return {"status": "success", "message": "Share settings updated successfully."}


@app.get("/shared-with-me")
async def get_shared_with_me(
    db: Session = Depends(get_db),
    current_user: dict = Depends(verify_user_token)
):
    user_email = (current_user.get("email") or "").lower()
    username = current_user.get("username", "").lower()

    recipients = db.query(FileShareRecipient).filter(
        (FileShareRecipient.recipient_email.ilike(user_email)) | 
        (FileShareRecipient.recipient_email == username)
    ).all()

    share_ids = [r.share_id for r in recipients]
    shares = db.query(SharedFile).filter(
        SharedFile.id.in_(share_ids),
        SharedFile.is_active == True
    ).all()

    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    result = []

    for s in shares:
        if s.expires_at and s.expires_at <= datetime.datetime.utcnow():
            continue

        file_rec = db.query(FileMetadata).filter(FileMetadata.id == s.file_id).first()
        filename = file_rec.original_filename if file_rec else "Shared File"
        size = file_rec.file_size_bytes if file_rec else 0

        result.append({
            "share_id": s.id,
            "share_token": s.share_token,
            "share_url": f"{frontend_url}/shared/{s.share_token}",
            "filename": filename,
            "size": size,
            "shared_by": s.owner,
            "created_at": s.created_at.isoformat() if s.created_at else None,
            "expires_at": s.expires_at.isoformat() if s.expires_at else None,
            "download_allowed": s.download_allowed,
            "password_protected": bool(s.password_hash)
        })

    return result


@app.get("/shared/{share_token}")
async def get_public_shared_file_info(
    share_token: str,
    db: Session = Depends(get_db)
):
    share_rec = db.query(SharedFile).filter(
        SharedFile.share_token == share_token,
        SharedFile.is_active == True
    ).first()

    if not share_rec:
        raise HTTPException(status_code=404, detail="Share link is invalid, revoked, or non-existent.")

    if share_rec.expires_at and share_rec.expires_at <= datetime.datetime.utcnow():
        raise HTTPException(status_code=410, detail="This share link has expired.")

    file_rec = db.query(FileMetadata).filter(FileMetadata.id == share_rec.file_id).first()
    if not file_rec:
        raise HTTPException(status_code=404, detail="Shared file was deleted or is unavailable.")

    return {
        "filename": file_rec.original_filename,
        "size": file_rec.file_size_bytes,
        "owner": share_rec.owner,
        "created_at": share_rec.created_at.isoformat() if share_rec.created_at else None,
        "expires_at": share_rec.expires_at.isoformat() if share_rec.expires_at else None,
        "download_allowed": share_rec.download_allowed,
        "password_protected": bool(share_rec.password_hash),
        "requires_password": bool(share_rec.password_hash)
    }


@app.post("/shared/{share_token}/verify-password")
async def verify_shared_file_password(
    share_token: str,
    payload: VerifySharePasswordRequest,
    db: Session = Depends(get_db)
):
    share_rec = db.query(SharedFile).filter(
        SharedFile.share_token == share_token,
        SharedFile.is_active == True
    ).first()

    if not share_rec or (share_rec.expires_at and share_rec.expires_at <= datetime.datetime.utcnow()):
        raise HTTPException(status_code=404, detail="Share link is invalid or expired.")

    if not share_rec.password_hash:
        return {"valid": True, "message": "No password required."}

    if not verify_password(payload.password.strip(), share_rec.password_hash, share_rec.salt):
        raise HTTPException(status_code=400, detail="Incorrect share password.")

    return {"valid": True, "message": "Password verified successfully."}


@app.get("/shared/{share_token}/download")
async def download_public_shared_file(
    share_token: str,
    password: Optional[str] = None,
    db: Session = Depends(get_db)
):
    share_rec = db.query(SharedFile).filter(
        SharedFile.share_token == share_token,
        SharedFile.is_active == True
    ).first()

    if not share_rec:
        raise HTTPException(status_code=404, detail="Share link is invalid or revoked.")

    if share_rec.expires_at and share_rec.expires_at <= datetime.datetime.utcnow():
        raise HTTPException(status_code=410, detail="This share link has expired.")

    if not share_rec.download_allowed:
        raise HTTPException(status_code=403, detail="File download is disabled by the owner for this share link.")

    if share_rec.password_hash:
        if not password or not verify_password(password.strip(), share_rec.password_hash, share_rec.salt):
            raise HTTPException(status_code=401, detail="Incorrect or missing password for this shared file.")

    file_rec = db.query(FileMetadata).filter(FileMetadata.id == share_rec.file_id).first()
    if not file_rec or not os.path.exists(file_rec.encrypted_path):
        raise HTTPException(status_code=404, detail="Encrypted file not found on server.")

    share_rec.access_count = (share_rec.access_count or 0) + 1
    file_rec.access_count = (file_rec.access_count or 0) + 1
    file_rec.last_accessed = datetime.datetime.utcnow()
    db.commit()

    with open(file_rec.encrypted_path, "rb") as f_obj:
        encrypted_bytes = f_obj.read()

    try:
        decrypted_bytes = cipher_suite.decrypt(encrypted_bytes)
    except Exception:
        raise HTTPException(status_code=500, detail="Failed to decrypt shared file content.")

    return Response(
        content=decrypted_bytes,
        media_type="application/octet-stream",
        headers={"Content-Disposition": f'attachment; filename="{file_rec.original_filename}"'}
    )