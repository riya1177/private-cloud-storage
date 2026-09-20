import client from './client';

/**
 * Check whether Google Drive OAuth is configured on the backend.
 * GET /integrations/google-drive/status
 */
export const getGoogleDriveStatus = async () => {
  const token = localStorage.getItem('token');
  const response = await client.get('/integrations/google-drive/status', {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  return response.data;
};

/**
 * Get Google OAuth authorization URL.
 * GET /integrations/google-drive/auth-url
 */
export const getGoogleDriveAuthUrl = async () => {
  const token = localStorage.getItem('token');
  const response = await client.get('/integrations/google-drive/auth-url', {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  return response.data;
};

/**
 * Exchange Google OAuth code for access token.
 * GET /integrations/google-drive/callback?code={code}
 */
export const exchangeGoogleDriveCode = async (code, state) => {
  const token = localStorage.getItem('token');
  const response = await client.get(
    `/integrations/google-drive/callback?code=${encodeURIComponent(code)}&state=${encodeURIComponent(state || '')}`,
    {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    }
  );
  return response.data;
};

/**
 * Fetch Google Drive file list for current user.
 * GET /integrations/google-drive/files
 */
export const getGoogleDriveFiles = async (accessToken = null) => {
  const token = localStorage.getItem('token');
  const url = accessToken 
    ? `/integrations/google-drive/files?access_token=${encodeURIComponent(accessToken)}`
    : '/integrations/google-drive/files';
  const response = await client.get(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  return response.data;
};

/**
 * Import a selected Google Drive file into Private Cloud Storage.
 * POST /integrations/google-drive/import
 */
export const importGoogleDriveFile = async (importData) => {
  const token = localStorage.getItem('token');
  const response = await client.post('/integrations/google-drive/import', importData, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  return response.data;
};
