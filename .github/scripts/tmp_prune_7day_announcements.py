import json
import time
from pathlib import Path

DAY_MS = 24 * 60 * 60 * 1000
WINDOW_MS = 7 * DAY_MS
now_ms = int(time.time() * 1000)
cutoff_ms = max(0, now_ms - WINDOW_MS)


def keep_announcement(item: dict) -> bool:
    if bool(item.get("pinned", False)):
        return True
    if not bool(item.get("published", True)):
        return True
    published_at = int(item.get("published_at_millis", 0) or 0)
    if published_at <= 0 or published_at > now_ms:
        return True
    return published_at >= cutoff_ms


config_path = Path("app-config.json")
config = json.loads(config_path.read_text(encoding="utf-8"))
announcements = config.setdefault("announcements", {})
items = announcements.get("items", [])
kept = [item for item in items if keep_announcement(item)]
removed = len(items) - len(kept)
if removed:
    announcements["items"] = kept
    config["revision"] = int(config.get("revision", 0) or 0) + 1
    config_path.write_text(
        json.dumps(config, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )

feed_path = Path("notification-feed.json")
feed_removed = 0
if feed_path.exists():
    feed = json.loads(feed_path.read_text(encoding="utf-8"))
    events = feed.get("events", [])
    kept_events = []
    for event in events:
        created_at = int(event.get("created_at_millis", 0) or 0)
        if created_at > 0 and created_at < cutoff_ms:
            feed_removed += 1
            continue
        kept_events.append(event)
    if feed_removed:
        feed["events"] = kept_events
        feed["revision"] = int(feed.get("revision", 0) or 0) + 1
        feed["generated_at_millis"] = now_ms
        feed_path.write_text(
            json.dumps(feed, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8",
        )

print(
    f"removed_announcements={removed} "
    f"removed_feed_events={feed_removed} "
    f"cutoff_ms={cutoff_ms}"
)
