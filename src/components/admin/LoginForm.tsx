"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/admin-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        setError(data.error || "Usuario o contraseña incorrectos.");
        setLoading(false);
        return;
      }
      router.push("/admin");
      router.refresh();
    } catch {
      setError("No se pudo conectar. Intenta de nuevo.");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="panel" style={{ display: "flex", flexDirection: "column", gap: 14 }}>
      <label style={{ display: "block" }}>
        <span style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Usuario</span>
        <input
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          autoComplete="username"
          style={{ width: "100%", fontSize: 14, padding: 8 }}
          autoFocus
        />
      </label>
      <label style={{ display: "block" }}>
        <span style={{ display: "block", marginBottom: 6, fontSize: 13, fontWeight: 600 }}>Contraseña</span>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="current-password"
          style={{ width: "100%", fontSize: 14, padding: 8 }}
        />
      </label>
      {error && <p style={{ color: "var(--danger)", fontSize: 13, margin: 0 }}>{error}</p>}
      <button className="btn btn-primary" type="submit" disabled={loading || !username || !password}>
        {loading ? "Entrando…" : "Entrar"}
      </button>
    </form>
  );
}
