// frontend/src/pages/ProfilePage.jsx
import { useAuth } from "../auth/AuthContext";
import { Navigate } from "react-router-dom";

export default function ProfilePage() {
  const { user, isAuthenticated, loadingUser } = useAuth();

  // Still loading auth state
  if (loadingUser) {
    return (
      <div className="flex justify-center items-center h-[70vh]">
        <div className="animate-pulse text-slate-400 text-lg">
          Loading your profile...
        </div>
      </div>
    );
  }

  // Not authenticated → redirect
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // Logged in → show profile
  return (
    <div className="h-screen w-screen flex flex-col justify-center items-center">
      {/* Page Title */}
      <h1 className="text-3xl font-bold text-cyan-300 mb-6">
        Your Profile
      </h1>

      {/* User Info Card */}
      <div className="rounded-xl bg-slate-800/80 border border-slate-700 p-6 shadow-lg backdrop-blur">
        <h2 className="text-xl font-semibold text-slate-200 mb-4">
          Welcome back, <span className="text-cyan-300">{user.username}</span>!
        </h2>

        <div className="space-y-2 text-slate-300">
          <p>
            <span className="font-medium text-slate-400">Username:</span>{" "}
            {user.username}
          </p>

          <p>
            <span className="font-medium text-slate-400">Email:</span>{" "}
            {user.email || <span className="italic opacity-70">No email set</span>}
          </p>
        </div>
      </div>

      {/* Raw JSON Debug Section */}
      <div className="mt-8">
        <h3 className="text-lg font-semibold text-slate-500 mb-3">
          Debug Information (User Object)
        </h3>

        <pre className="text-sm p-4 rounded-lg bg-slate-900/80 border border-slate-700 text-slate-300 overflow-auto">
{JSON.stringify(user, null, 2)}
        </pre>
      </div>
    </div>
  );
}
