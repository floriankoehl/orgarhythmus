// frontend/src/pages/RegisterPage.jsx
import { useState } from "react";
import { BASE_URL } from "../config/api";
import { useNavigate } from "react-router-dom";

export default function RegisterPage() {
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password1, setPassword1] = useState("");
  const [password2, setPassword2] = useState("");
  const [status, setStatus] = useState("");
  const navigate = useNavigate();

  async function handleSubmit(e) {
    e.preventDefault();
    setStatus("Registering...");

    try {
      const res = await fetch(`${BASE_URL}/api/auth/register/`, {
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
        setStatus(`Error: ${data.detail || "Registration failed"}`);
        return;
      }

      setStatus("Registration successful! You can now log in.");
      // Optionally, redirect to login
      navigate("/login");
    } catch (err) {
      setStatus(`Error: ${err.message}`);
    }
  }

  return (
    <div 
    className="h-screen w-screen flex justify-center items-center flex-col gap-3"
   >
      <h2>Register</h2>

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
          value={password1}
          type="password"
          onChange={(e) => setPassword1(e.target.value)}
          placeholder="Password"
        />
        <input
          className="bg-white p-2 rounded"
          value={password2}
          type="password"
          onChange={(e) => setPassword2(e.target.value)}
          placeholder="Repeat password"
        />
        <button 
        className="bg-white hover:bg-black/20 active:bg-black/50 p-2 rounded"
        type="submit">Create account</button>
      </form>

      {status && <p style={{ marginTop: "1rem" }}>{status}</p>}
    </div>
  );
}
