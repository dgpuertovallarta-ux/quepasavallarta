export type IngestedItem = {
  sourceId: string;
  sourceName: string;
  trustLevel: number;
  title: string;
  link: string;
  publishedAt: string | null;
  excerpt: string;
  categoryGuess: string;
  newsScore: number;
  status: "auto_publishable" | "needs_review" | "discard";
  statusReason: string;
  discoveredAt: string;
};
