import Link from "next/link";
import AskBox from "@/components/AskBox";
import { getPublishedArticles, searchPublishedArticles } from "@/lib/db/articles";

export const metadata = { title: "Pregúntale a Vallarta — Qué Pasa Vallarta" };

export default async function PreguntaPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const { q } = await searchParams;
  const query = (q || "").trim().slice(0, 200);
  const results = query ? await searchPublishedArticles(query, 8) : [];
  const latest = query && results.length === 0 ? await getPublishedArticles(5) : [];

  return (
    <div className="container section article-page">
      <div className="breadcrumbs">
        <Link href="/">Inicio</Link> / Pregúntale a Vallarta
      </div>
      <AskBox query={query} results={results} latest={latest} />
    </div>
  );
}
