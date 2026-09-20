import React, { useState, useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { AuthProvider, useAuth } from './context/AuthContext';
import { ToastProvider, useToast } from './context/ToastContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import AppLayout from './components/layout/AppLayout';

// Pages
import LoginPage from './pages/LoginPage';
import SignupPage from './pages/SignupPage';
import ForgotPasswordPage from './pages/ForgotPasswordPage';
import ResetPasswordPage from './pages/ResetPasswordPage';
import DashboardPage from './pages/DashboardPage';
import MyFilesPage from './pages/MyFilesPage';
import SettingsPage from './pages/SettingsPage';
import SharedByMePage from './pages/SharedByMePage';
import SharedWithMePage from './pages/SharedWithMePage';
import PublicSharePage from './pages/PublicSharePage';

// Modals
import RenameModal from './components/files/RenameModal';
import ConfirmDialog from './components/ui/ConfirmDialog';

// API
import { getFiles, downloadFile, renameFile, deleteFile } from './api/files';

// Component to handle Google OAuth Redirection Callback
function GoogleCallbackHandler() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { showSuccess, showError } = useToast();

  // Inside GoogleCallbackHandler in App.jsx
// Inside GoogleCallbackHandler in App.jsx
useEffect(() => {
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  if (code) {
    const token = localStorage.getItem('token') || localStorage.getItem('auth_token');

    // Added /api prefix to match FastAPI router mounting
    axios.get(`http://localhost:8000/api/google-callback?code=${code}&state=${state}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {}
    })
    .then((res) => {
      if (res.data && res.data.access_token) {
        localStorage.setItem('google_drive_token', res.data.access_token);
      }
      showSuccess('Google Drive connected successfully!', 'Drive Connected');
      navigate('/dashboard', { replace: true });
    })
    .catch((err) => {
      console.error('Failed to exchange Google OAuth code:', err.response?.data || err.message);
      showError(err.response?.data?.detail || 'Failed to connect Google Drive.', 'OAuth Error');
      navigate('/dashboard', { replace: true });
    });
  } else {
    navigate('/dashboard', { replace: true });
  }
}, [searchParams, navigate, showSuccess, showError]);

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-slate-950 text-white text-sm">
      <div className="flex flex-col items-center gap-3">
        <div className="w-8 h-8 border-4 border-indigo-500 border-t-transparent rounded-full animate-spin"></div>
        <span>Connecting your Google Drive...</span>
      </div>
    </div>
  );
}

function MainAppRoutes() {
  const { isAuthenticated } = useAuth();
  const { showSuccess, showError } = useToast();

  const [files, setFiles] = useState([]);
  const [isLoadingFiles, setIsLoadingFiles] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Modals state
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [renameTarget, setRenameTarget] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const [isRenaming, setIsRenaming] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch real file list from GET /files
  const fetchFileList = useCallback(async () => {
    if (!isAuthenticated) return;
    setIsLoadingFiles(true);
    try {
      const data = await getFiles();
      if (Array.isArray(data)) {
        setFiles(data);
      } else {
        setFiles([]);
      }
    } catch (err) {
      console.error('Failed to fetch file list:', err);
    } finally {
      setIsLoadingFiles(false);
    }
  }, [isAuthenticated]);

  useEffect(() => {
    if (isAuthenticated) {
      fetchFileList();
    }
  }, [isAuthenticated, fetchFileList]);

  // Download Handler (Blob binary handling)
  const handleDownload = async (filename) => {
    try {
      showSuccess(`Downloading "${filename}"...`, 'Download Started');
      await downloadFile(filename);
    } catch (err) {
      console.error('Download error:', err);
      showError(`Failed to download "${filename}".`, 'Download Failed');
    }
  };

  // Rename Handler
  const handleRenameSubmit = async (fileId, newFilename) => {
    setIsRenaming(true);
    try {
      await renameFile(fileId, newFilename);
      showSuccess(`File renamed to "${newFilename}".`);
      setRenameTarget(null);
      fetchFileList();
    } catch (err) {
      console.error('Rename error:', err);
      let msg = 'Failed to rename file.';
      if (err.response?.data?.detail) {
        msg = err.response.data.detail;
      }
      showError(msg, 'Rename Error');
    } finally {
      setIsRenaming(false);
    }
  };

  // Delete Handler
  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      await deleteFile(deleteTarget.id);
      showSuccess(`File "${deleteTarget.filename}" deleted.`);
      setDeleteTarget(null);
      fetchFileList();
    } catch (err) {
      console.error('Delete error:', err);
      let msg = 'Failed to delete file.';
      if (err.response?.data?.detail) {
        msg = err.response.data.detail;
      }
      showError(msg, 'Delete Error');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <>
      <Routes>
        {/* Public Routes */}
        <Route
          path="/login"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <LoginPage />}
        />
        <Route
          path="/signup"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <SignupPage />}
        />
        <Route
          path="/forgot-password"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ForgotPasswordPage />}
        />
        <Route
          path="/reset-password"
          element={isAuthenticated ? <Navigate to="/dashboard" replace /> : <ResetPasswordPage />}
        />
        <Route
          path="/shared/:shareToken"
          element={<PublicSharePage />}
        />

        {/* Protected App Routes */}
        <Route element={<ProtectedRoute />}>
          {/* Google OAuth Callback Handler */}
          <Route
            path="/google-callback"
            element={<GoogleCallbackHandler />}
          />

          <Route
            path="/dashboard"
            element={
              <AppLayout
                title="Dashboard"
                files={files}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              >
                <DashboardPage
                  files={files}
                  isLoading={isLoadingFiles}
                  searchQuery={searchQuery}
                  refreshFiles={fetchFileList}
                  onDownload={handleDownload}
                  onRenameClick={(file) => setRenameTarget(file)}
                  onDeleteClick={(file) => setDeleteTarget(file)}
                  onUploadClick={() => setIsUploadModalOpen(true)}
                />
              </AppLayout>
            }
          />

          <Route
            path="/files"
            element={
              <AppLayout
                title="My Files"
                files={files}
                searchQuery={searchQuery}
                onSearchChange={setSearchQuery}
              >
                <MyFilesPage
                  files={files}
                  isLoading={isLoadingFiles}
                  searchQuery={searchQuery}
                  onSearchChange={setSearchQuery}
                  refreshFiles={fetchFileList}
                  onDownload={handleDownload}
                  onRenameClick={(file) => setRenameTarget(file)}
                  onDeleteClick={(file) => setDeleteTarget(file)}
                  isUploadModalOpen={isUploadModalOpen}
                  setIsUploadModalOpen={setIsUploadModalOpen}
                />
              </AppLayout>
            }
          />

          <Route
            path="/shared-by-me"
            element={
              <AppLayout
                title="Shared by Me"
                files={files}
              >
                <SharedByMePage />
              </AppLayout>
            }
          />

          <Route
            path="/shared-with-me"
            element={
              <AppLayout
                title="Shared with Me"
                files={files}
              >
                <SharedWithMePage />
              </AppLayout>
            }
          />

          <Route
            path="/settings"
            element={
              <AppLayout
                title="Settings"
                files={files}
              >
                <SettingsPage files={files} />
              </AppLayout>
            }
          />
        </Route>

        {/* Default Redirect */}
        <Route path="*" element={<Navigate to="/dashboard" replace />} />
      </Routes>

      {/* Global Modals for Rename & Delete */}
      <RenameModal
        isOpen={Boolean(renameTarget)}
        onClose={() => setRenameTarget(null)}
        file={renameTarget}
        onRename={handleRenameSubmit}
        isRenaming={isRenaming}
      />

      <ConfirmDialog
        isOpen={Boolean(deleteTarget)}
        onClose={() => setDeleteTarget(null)}
        onConfirm={handleDeleteConfirm}
        title="Delete File"
        message={`Are you sure you want to delete "${deleteTarget?.filename}"? It will be permanently removed from your storage pool.`}
        confirmText="Delete File"
        isDeleting={isDeleting}
      />
    </>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <ToastProvider>
          <MainAppRoutes />
        </ToastProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}