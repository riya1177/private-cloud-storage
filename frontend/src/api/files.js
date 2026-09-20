import client from './client';

/**
 * Fetch all files owned by authenticated user.
 * GET /files
 * Returns array of file objects: [{ id, filename, size, uploaded_at, owner }]
 */
export const getFiles = async () => {
  const response = await client.get('/files');
  return response.data;
};

/**
 * Upload a single file.
 * POST /upload
 * Request: multipart/form-data with field 'file'
 */
export const uploadFile = async (file, onProgress) => {
  const formData = new FormData();
  formData.append('file', file);

  const response = await client.post('/upload', formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    onUploadProgress: (progressEvent) => {
      if (onProgress && progressEvent.total) {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        onProgress(percent);
      }
    },
  });

  return response.data;
};

/**
 * Download a file by filename as binary blob.
 * GET /download/{filename}
 */
export const downloadFile = async (filename) => {
  const response = await client.get(`/download/${encodeURIComponent(filename)}`, {
    responseType: 'blob',
  });

  // Create temporary Blob URL and trigger browser download
  const blob = new Blob([response.data], {
    type: response.headers['content-type'] || 'application/octet-stream',
  });
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', filename);
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
};

/**
 * Rename a file by file_id using query parameter new_filename.
 * PATCH /files/{file_id}?new_filename={new_filename}
 */
export const renameFile = async (fileId, newFilename) => {
  const response = await client.patch(
    `/files/${fileId}?new_filename=${encodeURIComponent(newFilename)}`
  );
  return response.data;
};

/**
 * Delete a file by file_id.
 * DELETE /files/{file_id}
 */
export const deleteFile = async (fileId) => {
  const response = await client.delete(`/files/${fileId}`);
  return response.data;
};
export const getFrequentlyUsedFiles = async () => {
  const response = await client.get('/files/frequently-used');
  return response.data;
};