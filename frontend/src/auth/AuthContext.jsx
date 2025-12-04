// src/auth/AuthContext.jsx
import { createContext, useContext, useEffect, useState } from "react";
import { authFetch, getAccessToken, logout as clearTokens } from "../auth";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    async function init() {
      const token = getAccessToken();
      if (!token) {
        setLoadingUser(false);
        return;
      }

      try {
        const res = await authFetch("/api/auth/me/");
        if (!res.ok) {
          setUser(null);
        } else {
          const data = await res.json();
          setUser(data);
        }
      } catch (e) {
        console.error("Error loading current user", e);
        setUser(null);
      } finally {
        setLoadingUser(false);
      }
    }

    init();
  }, []);

  function logout() {
    clearTokens();
    setUser(null);
  }

  const value = {
    user,
    setUser,
    isAuthenticated: !!user,
    loadingUser,
    logout,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}
