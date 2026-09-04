import Link from "next/link";

export default function NotFound() {
  return (
    <div className="container section">
      <div className="empty-state">
        <h2>Página no encontrada</h2>
        <Link href="/">Volver al inicio</Link>
      </div>
    </div>
  );
}
