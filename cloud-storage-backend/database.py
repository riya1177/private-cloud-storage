
import os
import datetime

from sqlalchemy import (
    create_engine,
    Column,
    Integer,
    String,
    DateTime,
    Boolean,
    ForeignKey,
    inspect,
    text,
)
from sqlalchemy.orm import declarative_base, sessionmaker, relationship


# --- DATABASE CONFIGURATION ---
DB_PATH = os.path.join(
    os.path.dirname(os.path.abspath(__file__)),
    "cloudstorage.db",
)
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(
    SQLALCHEMY_DATABASE_URL,
    connect_args={"check_same_thread": False},
)

SessionLocal = sessionmaker(
    autocommit=False,
    autoflush=False,
    bind=engine,
)

Base = declarative_base()


# --- FOLDER MODEL ---
class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    owner = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    files = relationship(
        "FileMetadata",
        back_populates="folder",
        cascade="all, delete-orphan",
    )


# --- FILE MODEL ---
class FileMetadata(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    original_filename = Column(String, index=True)
    encrypted_path = Column(String)
    file_size_bytes = Column(Integer)
    upload_time = Column(DateTime, default=datetime.datetime.utcnow)
    owner = Column(String, default="Pending_OAuth")

    access_count = Column(Integer, default=0)
    last_accessed = Column(DateTime, nullable=True)

    folder_id = Column(
        Integer,
        ForeignKey("folders.id", ondelete="SET NULL"),
        nullable=True,
    )
    folder = relationship("Folder", back_populates="files")


# --- USER MODEL ---
class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)
    password_hash = Column(String, nullable=True)
    salt = Column(String, nullable=True)

    google_id = Column(String, unique=True, index=True, nullable=True)
    auth_provider = Column(String, default="local")
    two_factor_enabled = Column(Boolean, default=False)

    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# --- PASSWORD RESET MODEL ---
class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    email = Column(String, index=True)
    token_hash = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, index=True)
    used_at = Column(DateTime, nullable=True)


# --- OTP MODEL ---
class OTPRecord(Base):
    __tablename__ = "otp_records"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    email = Column(String, index=True)
    otp_hash = Column(String, index=True)
    purpose = Column(String, default="login")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, index=True)
    attempts = Column(Integer, default=0)
    used_at = Column(DateTime, nullable=True)


# --- USER SESSION MODEL ---
class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    token = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, index=True)


# --- SHARED FILE MODEL ---
class SharedFile(Base):
    __tablename__ = "shared_files"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id"), index=True)
    owner = Column(String, index=True)
    share_token = Column(String, unique=True, index=True)
    share_type = Column(String, default="public")
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    password_hash = Column(String, nullable=True)
    salt = Column(String, nullable=True)
    download_allowed = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    access_count = Column(Integer, default=0)


# --- FILE SHARE RECIPIENT MODEL ---
class FileShareRecipient(Base):
    __tablename__ = "file_share_recipients"

    id = Column(Integer, primary_key=True, index=True)
    share_id = Column(Integer, ForeignKey("shared_files.id"), index=True)
    recipient_email = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# --- GOOGLE OAUTH SESSION MODEL ---
class GoogleOAuthSession(Base):
    __tablename__ = "google_oauth_sessions"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    access_token = Column(String)
    refresh_token = Column(String, nullable=True)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


# --- SIGNUP VERIFICATION MODEL ---
class SignupVerificationToken(Base):
    __tablename__ = "signup_verification_tokens"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    email = Column(String, index=True)
    token_hash = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, index=True)
    used_at = Column(DateTime, nullable=True)


# --- CREATE TABLES ---
Base.metadata.create_all(bind=engine)


# --- SAFE SQLITE SCHEMA MIGRATIONS ---
try:
    with engine.begin() as conn:
        inspector = inspect(conn)

        # Existing user table columns
        existing_user_cols = {
            col["name"]
            for col in inspector.get_columns("users")
        }

        user_migrations = {
            "email": "ALTER TABLE users ADD COLUMN email VARCHAR",
            "password_hash": "ALTER TABLE users ADD COLUMN password_hash VARCHAR",
            "salt": "ALTER TABLE users ADD COLUMN salt VARCHAR",
            "google_id": "ALTER TABLE users ADD COLUMN google_id VARCHAR",
            "auth_provider": (
                "ALTER TABLE users ADD COLUMN "
                "auth_provider VARCHAR DEFAULT 'local'"
            ),
            "two_factor_enabled": (
                "ALTER TABLE users ADD COLUMN "
                "two_factor_enabled BOOLEAN DEFAULT 0"
            ),
        }

        for column_name, sql in user_migrations.items():
            if column_name not in existing_user_cols:
                conn.execute(text(sql))
                print(
                    f"[DATABASE] Added missing users.{column_name} column."
                )

        # Existing files table columns
        existing_file_cols = {
            col["name"]
            for col in inspector.get_columns("files")
        }

        if "folder_id" not in existing_file_cols:
            conn.execute(
                text(
                    "ALTER TABLE files ADD COLUMN "
                    "folder_id INTEGER REFERENCES folders(id)"
                )
            )
            print("[DATABASE] Added missing files.folder_id column.")

    print("[DATABASE] Schema migration completed.")

except Exception as e:
    print(f"[DATABASE ERROR] Schema migration failed: {e}")
    raise
