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
      <input type="email" required placeholder="Ingresa tu correo" aria-label="Correo electrónico" />
      <button className="newsletter-submit" type="submit" aria-label="Suscribirme">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="m9 5 7 7-7 7" />
        </svg>
      </button>
    </form>
  );
}
