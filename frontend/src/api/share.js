import client from './client';

/**
 * Create a new file share link (public or private).
 * POST /files/{file_id}/share
 */
export const createShareLink = async (fileId, shareData) => {
  const response = await client.post(`/files/${fileId}/share`, shareData);
  return response.data;
};

/**
 * Get all file shares created by authenticated user.
 * GET /shared-by-me
 */
export const getSharedByMe = async () => {
  const response = await client.get('/shared-by-me');
  return response.data;
};

/**
 * Revoke a share link.
 * PATCH /shared-by-me/{share_id}/revoke
 */
export const revokeShareLink = async (shareId) => {
  const response = await client.patch(`/shared-by-me/${shareId}/revoke`);
  return response.data;
};

/**
 * Edit a share link.
 * PATCH /shared-by-me/{share_id}/edit
 */
export const editShareLink = async (shareId, editData) => {
  const response = await client.patch(`/shared-by-me/${shareId}/edit`, editData);
  return response.data;
};

/**
 * Get private shares sent to the authenticated user.
 * GET /shared-with-me
 */
export const getSharedWithMe = async () => {
  const response = await client.get('/shared-with-me');
  return response.data;
};

/**
 * Fetch public metadata for a shared file.
 * GET /shared/{share_token}
 */
export const getPublicSharedFileInfo = async (shareToken) => {
  const response = await client.get(`/shared/${shareToken}`);
  return response.data;
};

/**
 * Verify password for a protected shared file.
 * POST /shared/{share_token}/verify-password
 */
export const verifyPublicSharePassword = async (shareToken, password) => {
  const response = await client.post(`/shared/${shareToken}/verify-password`, { password });
  return response.data;
};

/**
 * Download a shared file content by token.
 * GET /shared/{share_token}/download
 */
export const downloadPublicSharedFile = async (shareToken, filename, password = null) => {
  const url = password 
    ? `/shared/${shareToken}/download?password=${encodeURIComponent(password)}`
    : `/shared/${shareToken}/download`;
    
  const response = await client.get(url, {
    responseType: 'blob',
  });

  const blob = new Blob([response.data], {
    type: response.headers['content-type'] || 'application/octet-stream',
  });
  const blobUrl = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = blobUrl;
  link.setAttribute('download', filename || 'shared_file');
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(blobUrl);
};
