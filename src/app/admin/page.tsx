import AdminShell from "@/components/admin/AdminShell";
import { Resumen } from "@/components/admin/sections";

export const metadata = { title: "Panel editorial — Qué Pasa Vallarta" };
// El panel editorial consulta fuentes reales en cada visita — nunca debe
// quedarse estático con una foto vieja del build.
export const dynamic = "force-dynamic";

export default function AdminPage() {
  return (
    <AdminShell active="resumen">
      <Resumen />
    </AdminShell>
  );
}
