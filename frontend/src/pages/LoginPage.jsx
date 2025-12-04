// frontend/src/pages/LoginPage.jsx
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { login, authFetch } from "../auth";
import { useAuth } from "../auth/AuthContext";

export default function LoginPage() {
  const { setUser } = useAuth();
  const navigate = useNavigate();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("Logging in...");

    try {
      // 1) Ask backend for tokens
      await login(username, password);

      // 2) Now that we have tokens, load current user
      const res = await authFetch("/api/auth/me/");
      if (!res.ok) {
        setStatus("Login OK, but could not load user info");
        return;
      }
      const data = await res.json();

      // 3) Save user in context
      setUser(data);

      setStatus("Logged in! Redirecting to profile...");
      // 4) Redirect
      navigate("/profile");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }

  return (
    <div className="h-screen w-screen flex justify-center items-center flex-col gap-3" style={{ maxWidth: 400, margin: "2rem auto", fontFamily: "sans-serif" }}>
      <h2>Login</h2>

      <form
        onSubmit={handleSubmit}
        style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}
      >
        <input
            className="bg-white p-2 rounded"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          placeholder="Username"
        />
        <input
            className="bg-white p-2 rounded"
          value={password}
          type="password"
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Password"
        />
        <button 
        className="bg-white hover:bg-black/20 active:bg-black/50 p-2 rounded"
        type="submit">Log in</button>
      </form>

      {status && <p  className="bg-red-200" style={{ marginTop: "1rem" }}>{status}</p>}
    </div>
  );
}
