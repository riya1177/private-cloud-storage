# ☁️ Private Encrypted Cloud Storage Application

An end-to-end encrypted private cloud storage app built with React, FastAPI, SQLite, and Redis. Features Fernet file encryption, custom folder management, 2FA security, instant cache fallbacks, and secure link sharing with password protection and expiration dates.

## 📸 Screenshot
![Dashboard Screenshot](./frontend/public/screenshot.png)

## ✨ Key Features
* **End-to-End Encryption**: Files encrypted via Fernet before storing on disk.
* **Folder Management**: Create folders, filter, and organize files seamlessly.
* **Two-Factor Authentication (2FA)**: Email OTP verification for account protection.
* **Fault-Tolerant Cache**: Redis integration with zero-latency SQLite fallbacks.
* **Granular Link Sharing**: Expiration dates, passcodes, and download controls.

## 🛠️ Tech Stack
* **Frontend**: React (Vite), Tailwind CSS, Lucide Icons
* **Backend**: FastAPI (Python), SQLAlchemy, SQLite, Redis, Fernet Cryptography
