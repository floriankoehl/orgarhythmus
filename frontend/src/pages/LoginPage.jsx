// frontend/src/pages/LoginPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { NavLink } from "react-router-dom";
import { login, authFetch } from "../auth";
import { useAuth } from "../auth/AuthContext";
import { LogIn, AlertCircle, Loader2 } from "lucide-react";
import Button from "@mui/material/Button";

export default function LoginPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("Logging in...");
    setError("");
    setIsLoading(true);

    try {
      // 1) Ask backend for tokens
      await login(username, password);

      // 2) Now that we have tokens, load current user
      const res = await authFetch("/api/auth/me/");
      if (!res.ok) {
        setError("Login OK, but could not load user info");
        setIsLoading(false);
        return;
      }
      const data = await res.json();

      // 3) Save user in context
      setUser(data);

      setStatus("Logged in! Redirecting...");
      // 4) Redirect after a brief moment
      setTimeout(() => navigate("/orgarhythmus"), 500);
    } catch (err) {
      setError(err.message || "Login failed");
      setStatus("");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <div className="min-h-screen w-full bg-gradient-to-b from-slate-50 to-slate-100 flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        
        {/* Header Card */}
        <div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm p-8 mb-6">
          <div className="flex items-center justify-center mb-6">
            <div className="h-14 w-14 rounded-lg bg-blue-100 flex items-center justify-center">
              <LogIn size={28} className="text-blue-600" />
            </div>
          </div>

          <h1 className="text-3xl font-semibold text-slate-900 text-center">
            Welcome back
          </h1>
          <p className="text-slate-600 text-center mt-2 text-sm">
            Log in to your OrgaRhythmus account
          </p>
        </div>

        {/* Login Form Card */}
        <div className="rounded-2xl border border-slate-200 bg-white/90 backdrop-blur-sm shadow-sm p-6">
          
          {/* Error Message */}
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 border border-red-200 p-3 flex items-start gap-3">
              <AlertCircle size={18} className="text-red-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-red-700">{error}</p>
            </div>
          )}

          {/* Success Message */}
          {status && !error && (
            <div className="mb-4 rounded-lg bg-green-50 border border-green-200 p-3 flex items-start gap-3">
              <Loader2 size={18} className="text-green-600 flex-shrink-0 mt-0.5 animate-spin" />
              <p className="text-sm text-green-700">{status}</p>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            
            {/* Username Field */}
            <div>
              <label htmlFor="username" className="block text-xs font-semibold text-slate-700 mb-2">
                Username
              </label>
              <input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Enter your username"
                disabled={isLoading}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-xs font-semibold text-slate-700 mb-2">
                Password
              </label>
              <input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your password"
                disabled={isLoading}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Login Button */}
            <Button
              type="submit"
              disabled={isLoading || !username.trim() || !password.trim()}
              fullWidth
              variant="contained"
              size="large"
              style={{
                textTransform: "none",
                borderRadius: "8px",
                marginTop: "1.5rem",
                padding: "10px",
                fontSize: "15px",
              }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={18} className="animate-spin" />
                  Logging in...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <LogIn size={18} />
                  Log In
                </span>
              )}
            </Button>

          </form>

          {/* Divider */}
          <div className="relative my-6">
            <div className="absolute inset-x-0 top-1/2 h-[1px] bg-slate-200"></div>
            <div className="relative flex justify-center text-xs">
              <span className="bg-white px-2 text-slate-500">or</span>
            </div>
          </div>

          {/* Register Link */}
          <NavLink
            to="/register"
            className="block w-full px-4 py-2.5 rounded-lg border border-slate-300 text-center text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Create a new account
          </NavLink>

        </div>

        {/* Back to Home */}
        <div className="text-center mt-6">
          <NavLink
            to="/landing"
            className="text-sm text-slate-600 hover:text-slate-900 transition-colors"
          >
            ← Back to Home
          </NavLink>
        </div>

      </div>
    </div>
  );
}
