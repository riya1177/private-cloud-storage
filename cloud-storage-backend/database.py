import os
import datetime
from sqlalchemy import create_engine, Column, Integer, String, DateTime, Boolean, ForeignKey, inspect, text
from sqlalchemy.orm import declarative_base, sessionmaker, relationship

DB_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), "cloudstorage.db")
SQLALCHEMY_DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False})
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# --- NEW: FOLDER MODEL ---
class Folder(Base):
    __tablename__ = "folders"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String, index=True)
    owner = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)

    # Relationship to files inside this folder
    files = relationship("FileMetadata", back_populates="folder", cascade="all, delete-orphan")


class FileMetadata(Base):
    __tablename__ = "files"

    id = Column(Integer, primary_key=True, index=True)
    original_filename = Column(String, index=True)
    encrypted_path = Column(String)
    file_size_bytes = Column(Integer)
    upload_time = Column(DateTime, default=datetime.datetime.utcnow)
    owner = Column(String, default="Pending_OAuth")

    # File usage tracking
    access_count = Column(Integer, default=0)
    last_accessed = Column(DateTime, nullable=True)

    # Foreign Key & Relationship for Folder Organization
    folder_id = Column(Integer, ForeignKey("folders.id", ondelete="SET NULL"), nullable=True)
    folder = relationship("Folder", back_populates="files")


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, unique=True, index=True)
    email = Column(String, unique=True, index=True, nullable=True)
    password_hash = Column(String)
    salt = Column(String)
    two_factor_enabled = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class PasswordResetToken(Base):
    __tablename__ = "password_reset_tokens"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    email = Column(String, index=True)
    token_hash = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, index=True)
    used_at = Column(DateTime, nullable=True)


class OTPRecord(Base):
    __tablename__ = "otp_records"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    email = Column(String, index=True)
    otp_hash = Column(String, index=True)
    purpose = Column(String, default="login")  # 'login', 'enable_2fa', 'disable_2fa', 'signup'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, index=True)
    attempts = Column(Integer, default=0)
    used_at = Column(DateTime, nullable=True)


class UserSession(Base):
    __tablename__ = "user_sessions"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    token = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, index=True)


class SharedFile(Base):
    __tablename__ = "shared_files"

    id = Column(Integer, primary_key=True, index=True)
    file_id = Column(Integer, ForeignKey("files.id"), index=True)
    owner = Column(String, index=True)
    share_token = Column(String, unique=True, index=True)
    share_type = Column(String, default="public")  # 'public' or 'private'
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, nullable=True)
    password_hash = Column(String, nullable=True)
    salt = Column(String, nullable=True)
    download_allowed = Column(Boolean, default=True)
    is_active = Column(Boolean, default=True)
    access_count = Column(Integer, default=0)


class FileShareRecipient(Base):
    __tablename__ = "file_share_recipients"

    id = Column(Integer, primary_key=True, index=True)
    share_id = Column(Integer, ForeignKey("shared_files.id"), index=True)
    recipient_email = Column(String, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class GoogleOAuthSession(Base):
    __tablename__ = "google_oauth_sessions"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    access_token = Column(String)
    refresh_token = Column(String, nullable=True)
    expires_at = Column(DateTime)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)


class SignupVerificationToken(Base):
    __tablename__ = "signup_verification_tokens"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String, index=True)
    email = Column(String, index=True)
    token_hash = Column(String, unique=True, index=True)
    created_at = Column(DateTime, default=datetime.datetime.utcnow)
    expires_at = Column(DateTime, index=True)
    used_at = Column(DateTime, nullable=True)


# Generate database tables
Base.metadata.create_all(bind=engine)

# Auto-migrate SQLite schema for missing columns
try:
    with engine.connect() as conn:
        inspector = inspect(engine)

        # Check 'users' table columns
        existing_user_cols = [col['name'] for col in inspector.get_columns('users')]
        if 'email' not in existing_user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN email VARCHAR"))
            print("[DATABASE] Auto-migrated: Added 'email' column to users table.")
        if 'two_factor_enabled' not in existing_user_cols:
            conn.execute(text("ALTER TABLE users ADD COLUMN two_factor_enabled BOOLEAN DEFAULT 0"))
            print("[DATABASE] Auto-migrated: Added 'two_factor_enabled' column to users table.")

        # Check 'files' table columns for folder support
        existing_file_cols = [col['name'] for col in inspector.get_columns('files')]
        if 'folder_id' not in existing_file_cols:
            conn.execute(text("ALTER TABLE files ADD COLUMN folder_id INTEGER REFERENCES folders(id)"))
            print("[DATABASE] Auto-migrated: Added 'folder_id' column to files table.")

        conn.commit()
except Exception as e:
    print(f"[DATABASE NOTICE] Schema check completed: {e}")