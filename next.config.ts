import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "upload.wikimedia.org" },
      { protocol: "https", hostname: "thumb.wikimedia.org" },
    ],
  },
  // @netlify/blobs usa APIs de Node que el bundler de Next.js no debe
  // empaquetar (falla en runtime si se empaqueta) — hay que dejarlo como
  // dependencia externa real. Sin esto, CUALQUIER función que la importe
  // (generateImage.ts, y por lo tanto /api/ingest, /api/backfill-images,
  // /api/publish-article, /api/generate-article) se cae en producción con
  // "This function has crashed" al primer uso, aunque compile bien local.
  serverExternalPackages: ["@netlify/blobs"],
};

export default nextConfig;
