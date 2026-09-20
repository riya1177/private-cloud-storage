import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from dotenv import load_dotenv

ENV_PATH = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".env")
load_dotenv(dotenv_path=ENV_PATH, override=True)

def get_smtp_config():
    load_dotenv(dotenv_path=ENV_PATH, override=True)
    host = os.getenv("SMTP_HOST", "")
    port_val = os.getenv("SMTP_PORT", "587")
    port = int(port_val) if port_val.isdigit() else 587
    username = os.getenv("SMTP_USERNAME", "")
    password = os.getenv("SMTP_PASSWORD", "")
    from_email = os.getenv("SMTP_FROM_EMAIL", username or "no-reply@cloudstorage.local")
    frontend_url = os.getenv("FRONTEND_URL", "http://localhost:5173")
    return host, port, username, password, from_email, frontend_url

def check_smtp_env_status():
    load_dotenv(dotenv_path=ENV_PATH, override=True)
    host = os.getenv("SMTP_HOST", "")
    port = os.getenv("SMTP_PORT", "")
    username = os.getenv("SMTP_USERNAME", "")
    password = os.getenv("SMTP_PASSWORD", "")
    from_email = os.getenv("SMTP_FROM_EMAIL", "")

    status = {
        "SMTP_HOST": "configured" if host else "not configured",
        "SMTP_PORT": "configured" if port else "not configured",
        "SMTP_USERNAME": "configured" if username else "not configured",
        "SMTP_PASSWORD": "configured" if password else "not configured",
        "SMTP_FROM_EMAIL": "configured" if from_email else "not configured"
    }

    missing = [k for k, v in status.items() if v == "not configured"]
    return status, missing

def is_smtp_configured() -> bool:
    host, _, username, password, _, _ = get_smtp_config()
    return bool(host and username and password)

def send_smtp_message(to_email: str, subject: str, html_content: str) -> dict:
    load_dotenv(dotenv_path=ENV_PATH, override=True)
    host, port, username, password, from_email, _ = get_smtp_config()

    if not is_smtp_configured():
        print("[EMAIL SERVICE] SMTP credentials not configured. Email dispatch skipped.")
        return {"delivered": False, "mode": "smtp_not_configured", "detail": "SMTP settings not fully configured"}

    print(f"[EMAIL SERVICE] ACTUAL RUNTIME SMTP CONFIGURATION: SMTP_HOST={host}, SMTP_PORT={port}, SMTP_USERNAME={username}, SMTP_FROM_EMAIL={from_email}")
    print(f"[EMAIL SERVICE] Attempting to send verification email to recipient {to_email} via {host}:{port}...")

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = from_email
    msg["To"] = to_email
    msg.attach(MIMEText(html_content, "html"))

    try:
        if port == 465:
            server = smtplib.SMTP_SSL(host, port, timeout=15)
        else:
            server = smtplib.SMTP(host, port, timeout=15)
            server.ehlo()
            if server.has_extn("STARTTLS"):
                server.starttls()
                server.ehlo()

        print("[EMAIL SERVICE] SMTP connection and TLS handshake successful.")

        if username and password:
            server.login(username, password)
            print("[EMAIL SERVICE] SMTP authentication successful.")

        server.sendmail(from_email, [to_email], msg.as_string())
        print(f"[EMAIL SERVICE] send_message succeeded. Delivered message to {to_email}.")

        server.quit()
        print("[EMAIL SERVICE] SMTP connection closed gracefully.")
        return {"delivered": True, "mode": "smtp"}

    except smtplib.SMTPAuthenticationError as err:
        print(f"[EMAIL SERVICE ERROR] Exception Type: SMTPAuthenticationError (Code {err.smtp_code}) - {err.smtp_error}")
        return {"delivered": False, "mode": "smtp_auth_error", "error_type": "SMTPAuthenticationError", "detail": f"SMTP authentication failed: {err.smtp_error}"}
    except smtplib.SMTPRecipientsRefused as err:
        print(f"[EMAIL SERVICE ERROR] Exception Type: SMTPRecipientsRefused - Recipient rejected: {to_email}")
        return {"delivered": False, "mode": "recipient_refused", "error_type": "SMTPRecipientsRefused", "detail": f"Recipient rejected: {to_email}"}
    except smtplib.SMTPSenderRefused as err:
        print(f"[EMAIL SERVICE ERROR] Exception Type: SMTPSenderRefused - Sender rejected: {from_email}")
        return {"delivered": False, "mode": "sender_refused", "error_type": "SMTPSenderRefused", "detail": f"Sender rejected: {from_email}"}
    except smtplib.SMTPConnectError as err:
        print(f"[EMAIL SERVICE ERROR] Exception Type: SMTPConnectError - Unable to connect to {host}:{port}")
        return {"delivered": False, "mode": "connection_error", "error_type": "SMTPConnectError", "detail": f"Unable to connect to {host}:{port}"}
    except ConnectionRefusedError as err:
        print(f"[EMAIL SERVICE ERROR] Exception Type: ConnectionRefusedError - Connection refused by target machine at {host}:{port}")
        return {"delivered": False, "mode": "connection_refused", "error_type": "ConnectionRefusedError", "detail": f"Connection refused by {host}:{port}"}
    except TimeoutError as err:
        print(f"[EMAIL SERVICE ERROR] Exception Type: TimeoutError - Connection to {host}:{port} timed out after 15s")
        return {"delivered": False, "mode": "timeout", "error_type": "TimeoutError", "detail": f"Connection to {host}:{port} timed out"}
    except Exception as err:
        print(f"[EMAIL SERVICE ERROR] Exception Type: {type(err).__name__} - {err}")
        return {"delivered": False, "mode": "smtp_error", "error_type": type(err).__name__, "detail": str(err)}

def send_password_reset_email(email: str, raw_reset_token: str, username: str) -> dict:
    """
    Sends a password reset email via SMTP if configured.
    """
    _, _, _, _, _, frontend_url = get_smtp_config()
    reset_link = f"{frontend_url}/reset-password?token={raw_reset_token}"
    subject = "Private Cloud Storage - Password Reset Request"
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #4f46e5; margin-bottom: 8px;">Private Cloud Storage</h2>
      <p style="color: #334155; font-size: 15px;">Hello <strong>{username}</strong>,</p>
      <p style="color: #334155; font-size: 14px; line-height: 1.5;">
        We received a request to reset your password. Click the link below to set a new password for your account:
      </p>
      <div style="margin: 24px 0; text-align: center;">
        <a href="{reset_link}" style="background-color: #4f46e5; color: #ffffff; padding: 12px 24px; text-decoration: none; border-radius: 8px; font-weight: bold; display: inline-block;">
          Reset My Password
        </a>
      </div>
      <p style="color: #64748b; font-size: 12px;">
        This reset link expires in 20 minutes and can only be used once.<br/>
        If you did not request a password reset, please ignore this email.
      </p>
    </div>
    """
    return send_smtp_message(email, subject, html_content)

def send_otp_email(email: str, otp_code: str, username: str, purpose: str = "login") -> dict:
    """
    Sends a 2FA / Signup OTP verification code email via SMTP if configured.
    """
    subject = f"Private Cloud Storage - Your Verification Code"
    if purpose == "signup":
        action_desc = "creating your account"
    elif purpose == "login":
        action_desc = "signing into your account"
    else:
        action_desc = "modifying your Two-Step Verification settings"
    
    html_content = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px;">
      <h2 style="color: #4f46e5; margin-bottom: 8px;">Private Cloud Storage</h2>
      <p style="color: #334155; font-size: 15px;">Hello <strong>{username}</strong>,</p>
      <p style="color: #334155; font-size: 14px;">
        Use the following 6-digit code to complete {action_desc}:
      </p>
      <div style="margin: 20px 0; text-align: center;">
        <span style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #4f46e5; background: #eef2ff; padding: 10px 20px; border-radius: 8px; display: inline-block;">
          {otp_code}
        </span>
      </div>
      <p style="color: #64748b; font-size: 12px;">
        This code is valid for 5 minutes and can only be used once.<br/>
        If you did not initiate this request, please ignore this email.
      </p>
    </div>
    """
    return send_smtp_message(email, subject, html_content)
