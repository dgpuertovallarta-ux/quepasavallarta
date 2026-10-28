/**
 * Almacén de estado (cola de Facebook, tráfico, patrocinios…).
 * Antes era Netlify Blobs; con el sitio en WordPress (HostGator, 2026-10-27)
 * se guarda en la tabla qpv_kv del sitio vía /wp-json/qpv/v1/kv. Misma forma
 * de uso que @netlify/blobs para no cambiar el resto del código.
 */
import { getStore as netlifyStore } from "@netlify/blobs";
import { usaWordPress, wp } from "../wp/cliente";

type Opciones = { type?: "json" | "text" | "arrayBuffer" };
type StoreLike = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  get(key: string, o?: Opciones): Promise<any>;
  getMetadata(key: string): Promise<{ metadata: Record<string, unknown> } | null>;
  setJSON(key: string, value: unknown): Promise<void>;
  set(key: string, value: string | ArrayBuffer, o?: unknown): Promise<void>;
  delete(key: string): Promise<void>;
  list(o?: { prefix?: string }): Promise<{ blobs: { key: string }[] }>;
};

const ruta = (almacen: string, clave: string) => `/qpv/v1/kv/${almacen}/${clave.split("/").map(encodeURIComponent).join("/")}`;

function storeWordPress(almacen: string): StoreLike {
  return {
    async get(key, o) {
      const v = await wp<unknown>(ruta(almacen, key));
      if (v === null || v === undefined) return null;
      if (o?.type === "arrayBuffer") {
        if (typeof v === "object" && v && "b64" in v) {
          const b = Buffer.from(String((v as { b64: string }).b64), "base64");
          return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
        }
        return null;
      }
      if (o?.type === "json") return v;
      return typeof v === "string" ? v : JSON.stringify(v);
    },
    async getMetadata(key) {
      const v = await wp<unknown>(ruta(almacen, key));
      return v === null || v === undefined ? null : { metadata: {} };
    },
    async setJSON(key, value) {
      await wp(ruta(almacen, key), { method: "PUT", json: value ?? null });
    },
    async set(key, value) {
      const guardar = typeof value === "string" ? value : { b64: Buffer.from(value).toString("base64") };
      await wp(ruta(almacen, key), { method: "PUT", json: guardar });
    },
    async delete(key) {
      await wp(ruta(almacen, key), { method: "DELETE" });
    },
    async list(o) {
      const r = await wp<{ claves: string[] }>(`/qpv/v1/kv/${almacen}?prefijo=${encodeURIComponent(o?.prefix ?? "")}`);
      return { blobs: (r?.claves ?? []).map((key) => ({ key })) };
    },
  };
}

export function getStore(o: string | { name: string; consistency?: "strong" | "eventual" }): StoreLike {
  const name = typeof o === "string" ? o : o.name;
  if (usaWordPress()) return storeWordPress(name);
  return netlifyStore(o as never) as unknown as StoreLike;
}
