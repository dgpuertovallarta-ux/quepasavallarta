"use client";

import { useEffect, useState } from "react";

let externalSetter: ((msg: string) => void) | null = null;

export function showToast(msg: string) {
  externalSetter?.(msg);
}

export default function Toast() {
  const [msg, setMsg] = useState<string | null>(null);

  useEffect(() => {
    externalSetter = (m: string) => setMsg(m);
    return () => {
      externalSetter = null;
    };
  }, []);

  useEffect(() => {
    if (!msg) return;
    const t = setTimeout(() => setMsg(null), 2600);
    return () => clearTimeout(t);
  }, [msg]);

  return (
    <div className={`toast${msg ? " show" : ""}`} role="status" aria-live="polite">
      {msg}
    </div>
  );
}
