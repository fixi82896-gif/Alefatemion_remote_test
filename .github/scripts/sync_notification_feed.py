#!/usr/bin/env python3
import json
import os
import subprocess
import time
from pathlib import Path

FEED = Path("notification-feed.json")
SOURCE_SHA = os.environ.get("SOURCE_SHA", "HEAD").strip() or "HEAD"
MAX_EVENTS = 120


def git_json(spec, path):
    try:
        raw = subprocess.check_output(["git", "show", f"{spec}:{path}"], text=True)
        return json.loads(raw)
    except Exception:
        return {}


def load_feed():
    try:
        return json.loads(FEED.read_text(encoding="utf-8"))
    except Exception:
        return {"schema_version": 1, "revision": 0, "generated_at_millis": 0, "events": []}


def public_track_ids(config):
    nava = config.get("nava") or {}
    if not nava.get("enabled", False):
        return set()
    mourning = nava.get("mourning_enabled", True)
    celebration = nava.get("celebration_enabled", True)
    result = set()
    for track in nava.get("tracks") or []:
        if not track.get("enabled", True) or not str(track.get("stream_url", "")).strip():
            continue
        category = track.get("category", "uncategorized")
        if category == "mourning" and mourning:
            result.add(str(track.get("id", "")))
        elif category == "celebration" and celebration:
            result.add(str(track.get("id", "")))
    return {x for x in result if x}


def published_manual(config):
    items = ((config.get("announcements") or {}).get("items") or [])
    return {
        str(item.get("id")): item
        for item in items
        if item.get("published", True)
        and item.get("origin", "manual") == "manual"
        and str(item.get("id", "")).strip()
    }


def media_sets(catalog):
    folders = {
        str(x.get("folder_hash")): x
        for x in (catalog.get("folders") or [])
        if str(x.get("folder_hash", "")).strip()
    }
    media = {
        str(x.get("stable_id")): x
        for x in (catalog.get("media") or [])
        if str(x.get("stable_id", "")).strip() and not x.get("hidden", False)
    }
    return folders, media


def label_for_folder(folder):
    return str(folder.get("display_name") or folder.get("real_name") or "آلبوم جدید").strip()


def append_event(events, existing_ids, event_id, kind, title, body, destination, destination_id=""):
    if event_id in existing_ids:
        return False
    events.append({
        "id": event_id,
        "type": kind,
        "title": title[:180],
        "body": body[:500],
        "created_at_millis": int(time.time() * 1000),
        "destination": destination,
        "destination_id": destination_id[:512],
    })
    existing_ids.add(event_id)
    return True


def main():
    old_config = git_json(f"{SOURCE_SHA}^", "app-config.json")
    new_config = git_json(SOURCE_SHA, "app-config.json")
    old_catalog = git_json(f"{SOURCE_SHA}^", "media-catalog.json")
    new_catalog = git_json(SOURCE_SHA, "media-catalog.json")

    feed = load_feed()
    events = list(feed.get("events") or [])
    existing_ids = {str(x.get("id", "")) for x in events}
    short = SOURCE_SHA[:12]
    changed = False

    old_folders, old_media = media_sets(old_catalog)
    new_folders, new_media = media_sets(new_catalog)

    added_folders = [new_folders[k] for k in new_folders.keys() - old_folders.keys()]
    if added_folders:
        names = [label_for_folder(x) for x in added_folders]
        body = names[0] if len(names) == 1 else f"{len(names)} آلبوم تازه به برنامه اضافه شد."
        changed |= append_event(events, existing_ids, f"album-{short}", "album", "آلبوم جدید", body, "albums")

    new_media_ids = new_media.keys() - old_media.keys()
    new_images = [new_media[k] for k in new_media_ids if new_media[k].get("media_type") == "image"]
    new_videos = [new_media[k] for k in new_media_ids if new_media[k].get("media_type") == "video"]
    if new_images:
        changed |= append_event(events, existing_ids, f"image-{short}", "image", "تصاویر جدید", f"{len(new_images)} تصویر تازه به آرشیو آل فاطمیون اضافه شد.", "images")
    if new_videos:
        changed |= append_event(events, existing_ids, f"video-{short}", "video", "فیلم‌های جدید", f"{len(new_videos)} فیلم تازه به آرشیو آل فاطمیون اضافه شد.", "videos")

    old_tracks = public_track_ids(old_config)
    new_tracks = public_track_ids(new_config)
    added_tracks = new_tracks - old_tracks
    if added_tracks:
        track_map = {str(x.get("id")): x for x in ((new_config.get("nava") or {}).get("tracks") or [])}
        first = track_map.get(next(iter(added_tracks)), {})
        body = str(first.get("title") or "نوای تازه") if len(added_tracks) == 1 else f"{len(added_tracks)} نوای تازه به رادیو اضافه شد."
        changed |= append_event(events, existing_ids, f"radio-{short}", "radio", "نوای تازه در رادیو آل فاطمیون", body, "radio")

    old_ann = published_manual(old_config)
    new_ann = published_manual(new_config)
    for ann_id in sorted(new_ann.keys() - old_ann.keys()):
        ann = new_ann[ann_id]
        changed |= append_event(
            events, existing_ids, f"announcement-{ann_id}", "announcement",
            str(ann.get("title") or "اطلاعیه جدید"),
            str(ann.get("summary") or ann.get("body") or "اطلاعیه جدید آل فاطمیون"),
            "announcements", ann_id,
        )

    old_ota = (old_config.get("ota") or {}).get("version_code", 0) or 0
    new_ota = (new_config.get("ota") or {}).get("version_code", 0) or 0
    if int(new_ota) > int(old_ota):
        ota = new_config.get("ota") or {}
        changed |= append_event(events, existing_ids, f"ota-{int(new_ota)}", "ota", "بروزرسانی جدید آل فاطمیون", str(ota.get("message") or f"نسخه جدید {ota.get('version_name', '')} آماده دریافت است."), "settings")

    old_urgent = old_config.get("urgent_message") or {}
    new_urgent = new_config.get("urgent_message") or {}
    old_rev = int(old_urgent.get("revision", 0) or 0)
    new_rev = int(new_urgent.get("revision", 0) or 0)
    if new_urgent.get("enabled", False) and new_rev > old_rev and str(new_urgent.get("message", "")).strip():
        changed |= append_event(events, existing_ids, f"urgent-{new_rev}", "urgent", str(new_urgent.get("title") or "پیام فوری"), str(new_urgent.get("message") or "پیام فوری جدید"), "urgent")

    if not changed:
        return

    feed = {
        "schema_version": 1,
        "revision": int(feed.get("revision", 0) or 0) + 1,
        "generated_at_millis": int(time.time() * 1000),
        "events": events[-MAX_EVENTS:],
    }
    FEED.write_text(json.dumps(feed, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")


if __name__ == "__main__":
    main()
