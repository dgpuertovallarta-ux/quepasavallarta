"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SearchBox({ initialQuery }: { initialQuery?: string }) {
  const [value, setValue] = useState(initialQuery || "");
  const router = useRouter();

  return (
    <form
      style={{ marginBottom: 22 }}
      onSubmit={(e) => {
        e.preventDefault();
        router.push(`/buscar?q=${encodeURIComponent(value)}`);
      }}
    >
      <input
        className="search-input-lg"
        placeholder="Buscar noticias, eventos, negocios…"
        value={value}
        onChange={(e) => setValue(e.target.value)}
      />
    </form>
  );
}
