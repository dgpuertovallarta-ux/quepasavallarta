"use client";

import { useRouter } from "next/navigation";

export default function LogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/admin-logout", { method: "POST" });
    router.push("/admin/login");
    router.refresh();
  }

  return (
    <button className="btn btn-outline btn-sm" type="button" onClick={handleLogout}>
      Cerrar sesión
    </button>
  );
}
