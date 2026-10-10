/**
 * Pinta el cuerpo de una nota a partir de sus párrafos ya limpios (ver
 * sanitizeParagraphs): `## ` es un subtítulo, las líneas con `• ` seguidas
 * forman una lista y las numeradas ("1. …") una lista ordenada.
 */
export default function ArticleBody({ paragraphs }: { paragraphs: string[] }) {
  const blocks: React.ReactNode[] = [];
  let i = 0;
  while (i < paragraphs.length) {
    const p = paragraphs[i];
    if (p.startsWith("## ")) {
      blocks.push(<h3 key={i}>{p.slice(3)}</h3>);
      i++;
    } else if (p.startsWith("• ")) {
      const start = i;
      const items: string[] = [];
      while (i < paragraphs.length && paragraphs[i].startsWith("• ")) items.push(paragraphs[i++].slice(2));
      blocks.push(
        <ul key={start}>
          {items.map((item, k) => (
            <li key={k}>{item}</li>
          ))}
        </ul>
      );
    } else if (/^\d{1,2}[.)]\s/.test(p)) {
      const start = i;
      const items: string[] = [];
      while (i < paragraphs.length && /^\d{1,2}[.)]\s/.test(paragraphs[i])) items.push(paragraphs[i++].replace(/^\d{1,2}[.)]\s+/, ""));
      blocks.push(
        <ol key={start}>
          {items.map((item, k) => (
            <li key={k}>{item}</li>
          ))}
        </ol>
      );
    } else {
      blocks.push(<p key={i}>{p}</p>);
      i++;
    }
  }
  return <article className="prose">{blocks}</article>;
}
