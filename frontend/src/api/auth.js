import client from './client';

/**
 * Authenticates user against FastAPI OAuth2 endpoint.
 * Request format: application/x-www-form-urlencoded
 * Payload: grant_type=password&username=...&password=...
 */
export const login = async (username, password) => {
  const params = new URLSearchParams();
  params.append('grant_type', 'password');
  params.append('username', username);
  params.append('password', password);

  const response = await client.post('/token', params, {
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
    },
  });

  return response.data; // Expecting { access_token: string, token_type: "bearer" }
};

/**
 * Changes user password against PATCH /auth/change-password endpoint.
 * Payload: { current_password, new_password }
 */
export const changePassword = async (currentPassword, newPassword) => {
  const response = await client.patch('/auth/change-password', {
    current_password: currentPassword,
    new_password: newPassword,
  });
  return response.data;
};

/**
 * Initiates forgot password reset link request.
 */
export const forgotPassword = async (email) => {
  const response = await client.post('/auth/forgot-password', { email });
  return response.data;
};

/**
 * Resets user password using raw reset token.
 */
export const resetPassword = async (token, newPassword) => {
  const response = await client.post('/auth/reset-password', {
    token,
    new_password: newPassword,
  });
  return response.data;
};

/**
 * Verifies 2FA 6-digit OTP code during login.
 */
export const verifyTwoFactorCode = async (username, otpCode) => {
  const response = await client.post('/auth/verify-2fa', {
    username,
    otp_code: otpCode,
  });
  return response.data;
};

/**
 * Resends 2FA 6-digit OTP code (enforces 30s cooldown).
 */
export const resendTwoFactorCode = async (username, purpose = 'login') => {
  const response = await client.post('/auth/resend-2fa-otp', {
    username,
    purpose,
  });
  return response.data;
};

/**
 * Fetches current 2FA status for logged in user.
 */
export const getTwoFactorStatus = async () => {
  const response = await client.get('/auth/2fa-status');
  return response.data;
};

/**
 * Requests OTP code to enable 2FA after password confirmation.
 */
export const requestEnableTwoFactor = async () => {
  const response = await client.post('/auth/2fa/enable-request');
  return response.data;
};

/**
 * Confirms 6-digit OTP code to complete enabling 2FA.
 */
export const confirmEnableTwoFactor = async (otpCode) => {
  const response = await client.post('/auth/2fa/enable-confirm', {
    otp_code: otpCode,
  });
  return response.data;
};

/**
 * Requests OTP code to disable 2FA after password confirmation.
 */
export const requestDisableTwoFactor = async (currentPassword) => {
  const response = await client.post('/auth/2fa/disable-request', {
    current_password: currentPassword,
  });
  return response.data;
};

/**
 * Confirms 6-digit OTP code to complete disabling 2FA.
 */
export const confirmDisableTwoFactor = async (otpCode) => {
  const response = await client.post('/auth/2fa/disable-confirm', {
    otp_code: otpCode,
  });
  return response.data;
};

/**
 * Requests a 6-digit OTP code to start signup email verification.
 */
export const requestSignupOtp = async (username, email) => {
  const response = await client.post('/auth/signup/request-otp', {
    username,
    email,
  });
  return response.data;
};

/**
 * Verifies the 6-digit OTP code during signup to obtain a signup verification token.
 */
export const verifySignupOtp = async (email, otpCode) => {
  const response = await client.post('/auth/signup/verify-otp', {
    email,
    otp_code: otpCode,
  });
  return response.data;
};

/**
 * Completes new user account creation after OTP verification and password creation.
 */
export const createSignupAccount = async (username, email, verificationToken, password) => {
  const response = await client.post('/auth/signup/create-account', {
    username,
    email,
    verification_token: verificationToken,
    password,
  });
  return response.data;
};

