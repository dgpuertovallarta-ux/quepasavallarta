import Link from "next/link";
import { LIVE_FEED } from "@/lib/data";

export default function LiveFeed() {
  return (
    <div className="live-feed">
      {LIVE_FEED.map((item, i) => (
        <div className="live-feed-item" key={item.time + item.text} style={{ animationDelay: `${i * 90}ms` }}>
          <span className="live-feed-time">{item.time}</span>
          <span className="live-feed-dot-col">
            <span className={i === 0 ? "live-dot" : "live-dot"} style={i === 0 ? undefined : { animation: "none", opacity: 0.35 }} />
            {i < LIVE_FEED.length - 1 && <span className="live-feed-line" />}
          </span>
          <span className="live-feed-body">
            {item.href ? <Link href={item.href}>{item.text}</Link> : <span>{item.text}</span>}
          </span>
        </div>
      ))}
    </div>
  );
}
