"use client";

import { showToast } from "./Toast";

export default function NewsletterForm() {
  return (
    <form
      className="newsletter-form"
      onSubmit={(e) => {
        e.preventDefault();
        showToast("Demo: en producción esto te suscribiría al newsletter.");
        (e.target as HTMLFormElement).reset();
      }}
    >
      <input type="email" required placeholder="tu@correo.com" aria-label="Correo electrónico" />
      <button className="btn btn-primary" type="submit">
        Suscribirme
      </button>
    </form>
  );
}
