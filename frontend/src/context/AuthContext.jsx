import React, { createContext, useContext, useState, useEffect } from 'react';
import { login as apiLogin } from '../api/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(() => localStorage.getItem('token') || null);
  const [username, setUsername] = useState(() => localStorage.getItem('username') || '');
  const [isLoading, setIsLoading] = useState(false);

  const loginUser = async (email, password) => {
    setIsLoading(true);
    try {
      const data = await apiLogin(email, password);
      
      if (data.requires_2fa) {
        return {
          success: true,
          requires2FA: true,
          username: data.username,
          email: data.email,
          maskedEmail: data.masked_email,
          message: data.message,
          smtpConfigured: data.smtp_configured
        };
      }

      const accessToken = data.access_token;
      if (!accessToken) {
        throw new Error('No access token returned from server');
      }

      const authUsername = data.username || email;
      setToken(accessToken);
      setUsername(authUsername);
      localStorage.setItem('token', accessToken);
      localStorage.setItem('username', authUsername);
      return { success: true, requires2FA: false };
    } catch (err) {
      console.error('Login error:', err);
      let errorMessage = 'Invalid email or password.';
      if (err.response && err.response.data && err.response.data.detail) {
        errorMessage = err.response.data.detail;
      } else if (err.message) {
        errorMessage = err.message;
      }
      return { success: false, error: errorMessage };
    } finally {
      setIsLoading(false);
    }
  };

  const completeTwoFactorLogin = (user, accessToken) => {
    setToken(accessToken);
    setUsername(user);
    localStorage.setItem('token', accessToken);
    localStorage.setItem('username', user);
  };

  const logoutUser = () => {
    setToken(null);
    setUsername('');
    localStorage.removeItem('token');
    localStorage.removeItem('username');
  };

  const isAuthenticated = Boolean(token);

  return (
    <AuthContext.Provider
      value={{
        token,
        username,
        isAuthenticated,
        isLoading,
        loginUser,
        completeTwoFactorLogin,
        logoutUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
