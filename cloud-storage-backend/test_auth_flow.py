import os
import sys
import unittest
import datetime
import secrets
import asyncio
from unittest.mock import MagicMock, patch
from fastapi import HTTPException
from fastapi.security import OAuth2PasswordRequestForm

# Ensure cloud-storage-backend is in sys.path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from database import Base, engine, SessionLocal, User, OTPRecord, UserSession, PasswordResetToken, SignupVerificationToken
from main import (
    login, verify_2fa, resend_2fa_otp, signup_request_otp, signup_verify_otp, signup_create_account,
    forgot_password, reset_password,
    Verify2FARequest, Resend2FARequest, SignupOTPRequest, SignupVerifyOTPRequest, SignupCreateAccountRequest,
    ForgotPasswordRequest, ResetPasswordRequest,
    hash_token, hash_password, verify_password
)
from auth import google_login, GoogleLoginRequest, create_user_session, verify_user_token

def run_async(coro):
    return asyncio.run(coro)

class TestAuthFlow(unittest.TestCase):

    @classmethod
    def setUpClass(cls):
        Base.metadata.create_all(bind=engine)

    def setUp(self):
        self.db = SessionLocal()
        # Clean up test records
        self.db.query(OTPRecord).delete()
        self.db.query(UserSession).delete()
        self.db.query(PasswordResetToken).delete()
        self.db.query(SignupVerificationToken).delete()
        self.db.query(User).filter(User.username.like("testuser_%")).delete()
        self.db.commit()

    def tearDown(self):
        self.db.close()

    def test_full_end_to_end_otp_regression_flow(self):
        """
        Full regression test covering the complete frontend request sequence:
        1. Log in using email address
        2. Receive canonical username & trigger OTP delivery
        3. Verify OTP record stored in database
        4. Exercise resend flow & invalidate previous OTP
        5. Verify latest valid OTP successfully
        6. Confirm resulting bearer token works with auth middleware
        7. Confirm previous OTP is rejected after resend
        8. Confirm incorrect, expired, and already-used OTPs are rejected
        """
        # Create test user with 2FA enabled
        pwd_hash, salt = hash_password("SecurePass123!")
        user = User(
            username="testuser_fullflow",
            email="testuser_fullflow@example.com",
            password_hash=pwd_hash,
            salt=salt,
            two_factor_enabled=True
        )
        self.db.add(user)
        self.db.commit()

        # Step 1 & 2: Log in using email address
        with patch("main.send_otp_email", return_value={"delivered": True}):
            with patch("main.is_smtp_configured", return_value=True):
                form_data = OAuth2PasswordRequestForm(username="testuser_fullflow@example.com", password="SecurePass123!")
                login_resp = run_async(login(form_data=form_data, db=self.db))
                self.assertTrue(login_resp["requires_2fa"])
                canonical_username = login_resp["username"]
                self.assertEqual(canonical_username, "testuser_fullflow")

        # Step 3: Verify OTP record was stored in DB
        first_otp_rec = self.db.query(OTPRecord).filter(
            OTPRecord.username == canonical_username,
            OTPRecord.purpose == "login",
            OTPRecord.used_at == None
        ).order_by(OTPRecord.id.desc()).first()
        self.assertIsNotNone(first_otp_rec)
        first_otp_id = first_otp_rec.id

        # Set a known code for first OTP
        first_code = "111111"
        first_otp_rec.otp_hash = hash_token(first_code)
        self.db.commit()

        # Fast-forward time past cooldown to allow resend
        first_otp_rec.created_at = datetime.datetime.utcnow() - datetime.timedelta(seconds=35)
        self.db.commit()

        # Step 4: Exercise resend flow -> invalidates previous code and creates newest record
        with patch("main.send_otp_email", return_value={"delivered": True}):
            with patch("main.is_smtp_configured", return_value=True):
                resend_resp = run_async(resend_2fa_otp(payload=Resend2FARequest(username="testuser_fullflow@example.com", purpose="login"), db=self.db))
                self.assertEqual(resend_resp["status"], "success")

        # Verify previous OTP was marked used/invalidated
        rechecked_first_otp = self.db.query(OTPRecord).filter(OTPRecord.id == first_otp_id).first()
        self.assertIsNotNone(rechecked_first_otp.used_at)

        # Get newest OTP record created by resend
        second_otp_rec = self.db.query(OTPRecord).filter(
            OTPRecord.username == canonical_username,
            OTPRecord.purpose == "login",
            OTPRecord.used_at == None
        ).order_by(OTPRecord.id.desc()).first()
        self.assertIsNotNone(second_otp_rec)
        self.assertNotEqual(second_otp_rec.id, first_otp_id)

        # Set known code for second OTP
        second_code = "222222"
        second_otp_rec.otp_hash = hash_token(second_code)
        self.db.commit()

        # Step 7: Confirm previous OTP is rejected after resend
        with self.assertRaises(HTTPException) as ctx_old:
            run_async(verify_2fa(payload=Verify2FARequest(username="testuser_fullflow@example.com", otp_code=first_code), db=self.db))
        self.assertEqual(ctx_old.exception.status_code, 400)

        # Step 8a: Confirm incorrect OTP is rejected
        with self.assertRaises(HTTPException) as ctx_inc:
            run_async(verify_2fa(payload=Verify2FARequest(username="testuser_fullflow@example.com", otp_code="999999"), db=self.db))
        self.assertEqual(ctx_inc.exception.status_code, 400)

        # Step 5: Verify latest valid OTP successfully
        verify_resp = run_async(verify_2fa(payload=Verify2FARequest(username="testuser_fullflow@example.com", otp_code=second_code), db=self.db))
        self.assertIn("access_token", verify_resp)
        token = verify_resp["access_token"]

        # Step 6: Confirm bearer token works with verify_user_token middleware
        user_dict = verify_user_token(token=token)
        self.assertEqual(user_dict["username"], "testuser_fullflow")
        self.assertEqual(user_dict["email"], "testuser_fullflow@example.com")

        # Step 8b: Confirm already-used OTP is rejected
        with self.assertRaises(HTTPException) as ctx_used:
            run_async(verify_2fa(payload=Verify2FARequest(username="testuser_fullflow@example.com", otp_code=second_code), db=self.db))
        self.assertEqual(ctx_used.exception.status_code, 400)

        # Step 8c: Confirm expired OTP is rejected
        exp_code = "333333"
        exp_otp = OTPRecord(
            username=canonical_username,
            email="testuser_fullflow@example.com",
            otp_hash=hash_token(exp_code),
            purpose="login",
            expires_at=datetime.datetime.utcnow() - datetime.timedelta(minutes=2),
            attempts=0
        )
        self.db.add(exp_otp)
        self.db.commit()

        with self.assertRaises(HTTPException) as ctx_exp:
            run_async(verify_2fa(payload=Verify2FARequest(username=canonical_username, otp_code=exp_code), db=self.db))
        self.assertEqual(ctx_exp.exception.status_code, 400)

if __name__ == "__main__":
    unittest.main()
