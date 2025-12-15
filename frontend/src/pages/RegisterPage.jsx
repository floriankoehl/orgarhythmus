// frontend/src/pages/RegisterPage.jsx
import { useState } from "react";
import { useNavigate, NavLink } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { login, authFetch } from "../auth";
import { UserPlus, AlertCircle, CheckCircle2, Loader2, Eye, EyeOff } from "lucide-react";
import Button from "@mui/material/Button";

export default function RegisterPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  
  const [showPassword1, setShowPassword1] = useState(false);
  const [showPassword2, setShowPassword2] = useState(false);

  // Password validation
  const passwordErrors = [];
  if (password1 && password1.length < 8) passwordErrors.push("At least 8 characters");
  if (password1 && !/[A-Z]/.test(password1)) passwordErrors.push("One uppercase letter");
  if (password1 && !/[a-z]/.test(password1)) passwordErrors.push("One lowercase letter");
  if (password1 && !/[0-9]/.test(password1)) passwordErrors.push("One number");
  if (password1 && password2 && password1 !== password2) passwordErrors.push("Passwords don't match");

  const isPasswordValid = password1 && password2 && !passwordErrors.length;

  async function handleSubmit(e) {
    e.preventDefault();
    setError("");
    setStatus("");
    setIsLoading(true);

    try {
      // 1) Register the user
      setStatus("Creating account...");
      const res = await fetch("/api/auth/register/", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          password1,
          password2,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError(data.detail || "Registration failed");
        setStatus("");
        setIsLoading(false);
        return;
      }

      // 2) Auto-login after registration
      setStatus("Logging in...");
      await login(username, password1);

      // 3) Load current user info
      const userRes = await authFetch("/api/auth/me/");
      if (!userRes.ok) {
        setError("Account created, but could not log in automatically");
        setIsLoading(false);
        return;
      }
      const userData = await userRes.json();

      // 4) Save user in context
      setUser(userData);

      setStatus("Account created! Redirecting...");
      // 5) Redirect after a brief moment
      setTimeout(() => navigate("/orgarhythmus"), 500);
    } catch (err) {
      setError(err.message || "Registration failed");
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
            <div className="h-14 w-14 rounded-lg bg-emerald-100 flex items-center justify-center">
              <UserPlus size={28} className="text-emerald-600" />
            </div>
          </div>

          <h1 className="text-3xl font-semibold text-slate-900 text-center">
            Create Account
          </h1>
          <p className="text-slate-600 text-center mt-2 text-sm">
            Join OrgaRhythmus and start organizing your projects
          </p>
        </div>

        {/* Register Form Card */}
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
              <p className="text-sm text-green-700 font-medium">{status}</p>
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
                placeholder="Choose a unique username"
                disabled={isLoading}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                required
              />
            </div>

            {/* Email Field */}
            <div>
              <label htmlFor="email" className="block text-xs font-semibold text-slate-700 mb-2">
                Email <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="your@email.com"
                disabled={isLoading}
                className="w-full px-4 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              />
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password1" className="block text-xs font-semibold text-slate-700 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  id="password1"
                  type={showPassword1 ? "text" : "password"}
                  value={password1}
                  onChange={(e) => setPassword1(e.target.value)}
                  placeholder="Enter a strong password"
                  disabled={isLoading}
                  className={`w-full px-4 py-2.5 rounded-lg border text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed pr-10 ${
                    password1 && passwordErrors.length > 0
                      ? "border-red-300 focus:ring-red-500 bg-red-50"
                      : "border-slate-300 focus:ring-emerald-500 bg-white"
                  }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword1(!showPassword1)}
                  disabled={isLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 disabled:opacity-50"
                >
                  {showPassword1 ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password Requirements */}
              {password1 && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs font-semibold text-slate-600">Password must contain:</p>
                  <div className="space-y-1">
                    <div className={`flex items-center gap-2 text-xs ${
                      password1.length >= 8 ? "text-green-600" : "text-slate-500"
                    }`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${
                        password1.length >= 8 ? "bg-green-500" : "bg-slate-300"
                      }`} />
                      At least 8 characters
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${
                      /[A-Z]/.test(password1) ? "text-green-600" : "text-slate-500"
                    }`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${
                        /[A-Z]/.test(password1) ? "bg-green-500" : "bg-slate-300"
                      }`} />
                      One uppercase letter
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${
                      /[a-z]/.test(password1) ? "text-green-600" : "text-slate-500"
                    }`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${
                        /[a-z]/.test(password1) ? "bg-green-500" : "bg-slate-300"
                      }`} />
                      One lowercase letter
                    </div>
                    <div className={`flex items-center gap-2 text-xs ${
                      /[0-9]/.test(password1) ? "text-green-600" : "text-slate-500"
                    }`}>
                      <div className={`h-1.5 w-1.5 rounded-full ${
                        /[0-9]/.test(password1) ? "bg-green-500" : "bg-slate-300"
                      }`} />
                      One number
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Confirm Password Field */}
            <div>
              <label htmlFor="password2" className="block text-xs font-semibold text-slate-700 mb-2">
                Confirm Password
              </label>
              <div className="relative">
                <input
                  id="password2"
                  type={showPassword2 ? "text" : "password"}
                  value={password2}
                  onChange={(e) => setPassword2(e.target.value)}
                  placeholder="Repeat your password"
                  disabled={isLoading}
                  className={`w-full px-4 py-2.5 rounded-lg border text-slate-900 placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:border-transparent transition-all disabled:opacity-50 disabled:cursor-not-allowed pr-10 ${
                    password2 && password1 !== password2
                      ? "border-red-300 focus:ring-red-500 bg-red-50"
                      : "border-slate-300 focus:ring-emerald-500 bg-white"
                  }`}
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword2(!showPassword2)}
                  disabled={isLoading}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-700 disabled:opacity-50"
                >
                  {showPassword2 ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>

              {/* Password Match Indicator */}
              {password2 && (
                <div className={`mt-2 flex items-center gap-2 text-xs ${
                  password1 === password2 ? "text-green-600" : "text-red-600"
                }`}>
                  <div className={`h-1.5 w-1.5 rounded-full ${
                    password1 === password2 ? "bg-green-500" : "bg-red-500"
                  }`} />
                  {password1 === password2 ? "Passwords match" : "Passwords don't match"}
                </div>
              )}
            </div>

            {/* Register Button */}
            <Button
              type="submit"
              disabled={isLoading || !username.trim() || !isPasswordValid}
              fullWidth
              variant="contained"
              size="large"
              style={{
                textTransform: "none",
                borderRadius: "8px",
                marginTop: "1.5rem",
                padding: "10px",
                fontSize: "15px",
                backgroundColor: "#059669",
              }}
            >
              {isLoading ? (
                <span className="flex items-center justify-center gap-2">
                  <Loader2 size={18} className="animate-spin" />
                  Creating account...
                </span>
              ) : (
                <span className="flex items-center justify-center gap-2">
                  <UserPlus size={18} />
                  Create Account
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

          {/* Login Link */}
          <NavLink
            to="/login"
            className="block w-full px-4 py-2.5 rounded-lg border border-slate-300 text-center text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
          >
            Already have an account? Log in
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
