import { notFound } from "next/navigation";
import AdminShell from "@/components/admin/AdminShell";
import { Resumen, Cola, Fuentes, Roles, Comercial } from "@/components/admin/sections";

type SectionComponent = () => React.ReactNode | Promise<React.ReactNode>;

const SECTIONS: Record<string, SectionComponent> = {
  resumen: Resumen,
  cola: Cola,
  fuentes: Fuentes,
  roles: Roles,
  comercial: Comercial,
};

const SECTION_LABELS: Record<string, string> = {
  resumen: "Resumen",
  cola: "Cola editorial",
  fuentes: "Fuentes y automatización",
  roles: "Usuarios y roles",
  comercial: "Comercial / Leads",
};

// Estas páginas consultan fuentes reales en cada visita — no se pueden
// pre-generar en el build (dejarían ver datos viejos indefinidamente).
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  return { title: `${SECTION_LABELS[section] || section} — Panel editorial` };
}

export default async function AdminSectionPage({ params }: { params: Promise<{ section: string }> }) {
  const { section } = await params;
  const Body = SECTIONS[section];
  if (!Body) notFound();

  return (
    <AdminShell active={section}>
      <Body />
    </AdminShell>
  );
}
