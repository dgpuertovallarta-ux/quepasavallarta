"use client";

export default function ImprimirBoton() {
  return (
    <button type="button" className="btn btn-outline" onClick={() => window.print()}>
      Imprimir / guardar PDF
    </button>
  );
}
