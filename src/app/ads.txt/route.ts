// ads.txt para Google AdSense. Se genera a partir de NEXT_PUBLIC_ADSENSE_CLIENT
// (ca-pub-XXXXXXXX). Sin esa variable responde vacío.
export const dynamic = "force-static";

export function GET() {
  const client = process.env.NEXT_PUBLIC_ADSENSE_CLIENT || "";
  const pub = /^ca-(pub-\d+)$/.exec(client)?.[1];
  const body = pub ? `google.com, ${pub}, DIRECT, f08c47fec0942fa0\n` : "";
  return new Response(body, { headers: { "content-type": "text/plain; charset=utf-8" } });
}
