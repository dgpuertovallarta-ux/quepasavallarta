"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

function visitorId(): string | null {
  try {
    let id = localStorage.getItem("qpv_vid");
    if (!id) {
      id = Math.random().toString(36).slice(2) + Date.now().toString(36);
      localStorage.setItem("qpv_vid", id);
    }
    return id;
  } catch {
    return null;
  }
}

/** Cuenta cada página vista (privado, ver /admin/estadisticas). No muestra nada. */
export default function PageTracker() {
  const pathname = usePathname();
  useEffect(() => {
    if (!pathname || pathname.startsWith("/admin")) return;
    const body = JSON.stringify({ path: pathname, vid: visitorId() });
    try {
      if (navigator.sendBeacon) navigator.sendBeacon("/api/track", new Blob([body], { type: "text/plain" }));
      else fetch("/api/track", { method: "POST", body, keepalive: true });
    } catch {}
  }, [pathname]);
  return null;
}
