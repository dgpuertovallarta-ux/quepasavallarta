import Link from "next/link";
import { type NewsItem } from "@/lib/data";

function hhmm(iso: string) {
  return new Date(iso).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
}

export default function LatestList({ items }: { items: NewsItem[] }) {
  return (
    <div>
      {items.map((n) => (
        <div className="latest-list-item" key={n.slug}>
          <span className="latest-list-time">{hhmm(n.updatedAt || n.publishedAt)}</span>
          <Link href={`/noticia/${n.slug}`}>{n.title}</Link>
        </div>
      ))}
    </div>
  );
}
