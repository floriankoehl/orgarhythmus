// frontend/src/components/LoginDemo.jsx
import { useState } from "react";
import { login, authFetch, logout } from "../auth";

export default function LoginDemo() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState("");        // text messages
  const [userInfo, setUserInfo] = useState(null);  // data from /api/auth/me/

  async function handleLogin(e) {
    e.preventDefault();
    setStatus("Logging in...");
    setUserInfo(null);

    try {
      await login(username, password);
      setStatus("Login successful! Fetching your user data...");

      const res = await authFetch("/api/auth/me/");

      if (!res.ok) {
        setStatus(`Login OK, but /api/auth/me/ returned ${res.status}`);
        return;
      }

      const data = await res.json();
      setUserInfo(data);
      setStatus("Loaded user info 🙂");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
      setUserInfo(null);
    }
  }

  function handleLogout() {
    logout();
    setStatus("Logged out, tokens removed.");
    setUserInfo(null);
  }

  return (
    <div className="h-screen w-screen flex justify-center items-center flex-col gap-3" >
      <h2>JWT Login Demo</h2>

      <form onSubmit={handleLogin} style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
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

      <button 
      className="bg-white hover:bg-black/20 active:bg-black/50 p-2 rounded"
      onClick={handleLogout} style={{ marginTop: "1rem" }}>
        Logout (clear tokens)
      </button>

      {status && <p className="" style={{ marginTop: "1rem"}}>{status}</p>}

      {userInfo && (
        <pre
          style={{
            marginTop: "1rem",
            padding: "0.5rem",
            background: "#f5f5f5",
            fontSize: "0.9rem",
            overflowX: "auto",
          }}
        >
{JSON.stringify(userInfo, null, 2)}
        </pre>
      )}
    </div>
  );
}
