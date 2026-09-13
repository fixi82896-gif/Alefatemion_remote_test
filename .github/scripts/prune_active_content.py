#!/usr/bin/env python3
"""Keep the Test remote small and aligned with the Android retention policy.

Product rule:
- published, unpinned announcements older than seven days are removed from
  app-config.json entirely;
- pinned announcements remain until the manager unpins/deletes them;
- notification-feed events older than seven days are removed, except a pinned
  announcement event that still points to a currently pinned announcement;
- drafts are not deleted automatically.

The script only rewrites files when their effective content changes.
"""

from __future__ import annotations

import json
import time
from pathlib import Path
from typing import Any

CONFIG_PATH = Path("app-config.json")
FEED_PATH = Path("notification-feed.json")
ACTIVE_WINDOW_MILLIS = 7 * 24 * 60 * 60 * 1000


def load_json(path: Path) -> dict[str, Any]:
    return json.loads(path.read_text(encoding="utf-8"))


def save_json(path: Path, value: dict[str, Any]) -> None:
    path.write_text(
        json.dumps(value, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )


def valid_timestamp(value: Any) -> int:
    try:
        parsed = int(value or 0)
    except (TypeError, ValueError):
        return 0
    return max(parsed, 0)


def prune_config(config: dict[str, Any], now_millis: int) -> tuple[bool, set[str]]:
    announcements = config.get("announcements")
    if not isinstance(announcements, dict):
        return False, set()

    items = announcements.get("items")
    if not isinstance(items, list):
        return False, set()

    cutoff = max(0, now_millis - ACTIVE_WINDOW_MILLIS)
    kept: list[dict[str, Any]] = []
    pinned_ids: set[str] = set()
    changed = False

    for raw in items:
        if not isinstance(raw, dict):
            changed = True
            continue

        item_id = str(raw.get("id") or "").strip()
        pinned = bool(raw.get("pinned", False))
        published = bool(raw.get("published", True))
        published_at = valid_timestamp(raw.get("published_at_millis"))

        if pinned and item_id:
            pinned_ids.add(item_id)

        expired = (
            published
            and not pinned
            and published_at > 0
            and published_at < cutoff
        )

        if expired:
            changed = True
            continue

        kept.append(raw)

    if changed:
        announcements["items"] = kept
        config["revision"] = max(int(config.get("revision", 0) or 0), 0) + 1

    return changed, pinned_ids


def is_pinned_announcement_event(event: dict[str, Any], pinned_ids: set[str]) -> bool:
    if str(event.get("type") or "").strip().lower() != "announcement":
        return False
    destination_id = str(event.get("destination_id") or "").strip()
    return destination_id in pinned_ids


def prune_feed(
    feed: dict[str, Any],
    pinned_ids: set[str],
    now_millis: int,
) -> bool:
    events = feed.get("events")
    if not isinstance(events, list):
        return False

    cutoff = max(0, now_millis - ACTIVE_WINDOW_MILLIS)
    kept: list[dict[str, Any]] = []
    changed = False

    for raw in events:
        if not isinstance(raw, dict):
            changed = True
            continue

        created_at = valid_timestamp(raw.get("created_at_millis"))
        keep_pinned = is_pinned_announcement_event(raw, pinned_ids)
        expired = created_at > 0 and created_at < cutoff and not keep_pinned

        if expired:
            changed = True
            continue

        kept.append(raw)

    if changed:
        feed["events"] = kept
        feed["revision"] = max(int(feed.get("revision", 0) or 0), 0) + 1
        feed["generated_at_millis"] = now_millis

    return changed


def main() -> None:
    now_millis = int(time.time() * 1000)
    config = load_json(CONFIG_PATH)
    feed = load_json(FEED_PATH)

    config_changed, pinned_ids = prune_config(config, now_millis)
    feed_changed = prune_feed(feed, pinned_ids, now_millis)

    if config_changed:
        save_json(CONFIG_PATH, config)
    if feed_changed:
        save_json(FEED_PATH, feed)

    print(
        "prune_active_content:",
        f"config_changed={config_changed}",
        f"feed_changed={feed_changed}",
        f"pinned={len(pinned_ids)}",
    )


if __name__ == "__main__":
    main()
