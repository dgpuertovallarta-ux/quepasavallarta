import Link from "next/link";
import AskBox from "@/components/AskBox";

export const metadata = { title: "Pregúntale a Vallarta — Qué Pasa Vallarta" };

export default async function PreguntaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  return (
    <div className="container section">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / Pregúntale a Vallarta
      </div>
      <AskBox initialQuery={q} />
    </div>
  );
}
