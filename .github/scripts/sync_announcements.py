#!/usr/bin/env python3
"""Build automatic album/radio announcements in the remote app config.

The first successful run records the current album and radio state without
publishing old content. Later runs announce only newly observed media or track
IDs. The script uses Python's standard library and is designed for GitHub
Actions in the public remote-config repository.
"""

from __future__ import annotations

import hashlib
import json
import os
import time
import urllib.error
import urllib.parse
import urllib.request
from collections import defaultdict, deque
from pathlib import Path
from typing import Any


CONFIG_PATH = Path(os.environ.get("APP_CONFIG_PATH", "app-config.json"))
STATE_PATH = Path(
    os.environ.get(
        "ANNOUNCEMENT_STATE_PATH",
        ".automation/announcement-state.json",
    )
)
ABRE_HOST = "abrehamrahi.ir"
ABRE_BASE = f"https://{ABRE_HOST}"
MAX_FOLDERS = 5000
MAX_PAGES_PER_FOLDER = 50
MAX_ANNOUNCEMENTS = 80
AUTOMATIC_RETENTION_MILLIS = 30 * 24 * 60 * 60 * 1000
FETCH_ATTEMPTS = 4
TRANSIENT_HTTP_CODES = {408, 425, 429, 500, 502, 503, 504}


class TemporarySourceError(RuntimeError):
    """The album source is temporarily unavailable and may be retried later."""


def load_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def write_json(path: Path, value: Any) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    temporary = path.with_suffix(path.suffix + ".tmp")
    with temporary.open("w", encoding="utf-8") as handle:
        json.dump(value, handle, ensure_ascii=False, indent=2)
        handle.write("\n")
    temporary.replace(path)


def fetch_json(url: str) -> dict[str, Any]:
    parsed = urllib.parse.urlparse(url)
    if parsed.scheme != "https" or parsed.hostname != ABRE_HOST:
        raise RuntimeError("Unsafe Abre Hamrahi pagination URL")

    request = urllib.request.Request(
        url,
        headers={
            "Accept": "application/json",
            "Accept-Language": "fa",
            "user-device": "web-mobile",
            "User-Agent": "Alefatemion-announcement-sync/1.0",
        },
    )
    last_reason = "unknown error"
    for attempt in range(FETCH_ATTEMPTS):
        retry_after_seconds = 0
        try:
            with urllib.request.urlopen(request, timeout=45) as response:
                if response.status < 200 or response.status >= 300:
                    raise RuntimeError(
                        f"Abre Hamrahi HTTP {response.status}"
                    )
                return json.loads(response.read().decode("utf-8"))
        except urllib.error.HTTPError as error:
            if error.code not in TRANSIENT_HTTP_CODES:
                raise
            last_reason = f"HTTP {error.code}"
            raw_retry_after = (error.headers or {}).get("Retry-After", "")
            try:
                retry_after_seconds = max(0, int(raw_retry_after))
            except (TypeError, ValueError):
                retry_after_seconds = 0
        except (
            urllib.error.URLError,
            TimeoutError,
            ConnectionError,
            json.JSONDecodeError,
            UnicodeDecodeError,
        ) as error:
            last_reason = type(error).__name__

        if attempt + 1 < FETCH_ATTEMPTS:
            exponential_delay = 2 ** attempt
            time.sleep(min(15, max(exponential_delay, retry_after_seconds)))

    raise TemporarySourceError(
        "Album source temporarily unavailable after "
        f"{FETCH_ATTEMPTS} attempts ({last_reason})"
    )


def list_children(folder_hash: str) -> list[dict[str, Any]]:
    query = urllib.parse.urlencode(
        {
            "obj_hash": folder_hash,
            "recursive": "false",
            "limit": "1000",
        }
    )
    next_url: str | None = (
        f"{ABRE_BASE}/api/v4/sharing/list-shared-objects/?{query}"
    )
    result: list[dict[str, Any]] = []
    pages = 0

    while next_url:
        pages += 1
        if pages > MAX_PAGES_PER_FOLDER:
            raise RuntimeError("Too many pages in one album")
        payload = fetch_json(next_url)
        for wrapper in payload.get("results") or []:
            if not isinstance(wrapper, dict):
                continue
            obj = wrapper.get("obj")
            if not isinstance(obj, dict):
                continue
            result.append({"wrapper": wrapper, "obj": obj})
        raw_next = payload.get("next")
        next_url = raw_next if isinstance(raw_next, str) and raw_next else None

    return result


def stable_media_id(wrapper: dict[str, Any], obj: dict[str, Any]) -> str:
    raw_id = obj.get("id", wrapper.get("id"))
    if raw_id not in (None, "", 0, "0"):
        return f"id:{raw_id}"
    fallback = "|".join(
        str(obj.get(key) or "")
        for key in ("obj_hash", "download_url", "name", "created_at")
    )
    return "sha:" + hashlib.sha256(fallback.encode("utf-8")).hexdigest()[:24]


def scan_albums(
    root_hash: str,
) -> tuple[dict[str, dict[str, str]], dict[str, dict[str, str]]]:
    queue: deque[tuple[str, str, str]] = deque(
        [(root_hash, "آلبوم‌ها", "")]
    )
    visited: set[str] = set()
    media: dict[str, dict[str, str]] = {}
    folders: dict[str, dict[str, str]] = {}

    while queue:
        folder_hash, folder_name, parent_hash = queue.popleft()
        if folder_hash in visited:
            continue
        visited.add(folder_hash)
        if len(visited) > MAX_FOLDERS:
            raise RuntimeError("Too many album folders")

        for entry in list_children(folder_hash):
            wrapper = entry["wrapper"]
            obj = entry["obj"]
            content_type = str(obj.get("type") or "")

            if content_type == "folder":
                child_hash = str(obj.get("obj_hash") or "").strip()
                if child_hash:
                    child_name = str(obj.get("name") or "").strip()
                    child_name = child_name or "آلبوم بدون نام"
                    folders[child_hash] = {
                        "folder_hash": child_hash,
                        "folder_name": child_name,
                        "parent_hash": folder_hash,
                    }
                    queue.append((child_hash, child_name, folder_hash))
                continue

            if not (
                content_type.startswith("image/")
                or content_type.startswith("video/")
            ):
                continue

            media[stable_media_id(wrapper, obj)] = {
                "folder_hash": folder_hash,
                "folder_name": folder_name,
                "kind": "image" if content_type.startswith("image/") else "video",
            }

    return media, folders


def enabled_track_ids(config: dict[str, Any]) -> list[str]:
    tracks = (config.get("nava") or {}).get("tracks") or []
    result: list[str] = []
    for track in tracks:
        if not isinstance(track, dict) or not track.get("enabled", True):
            continue
        track_id = str(track.get("id") or "").strip()
        if track_id:
            result.append(track_id)
    return list(dict.fromkeys(result))


def track_by_id(config: dict[str, Any]) -> dict[str, dict[str, Any]]:
    tracks = (config.get("nava") or {}).get("tracks") or []
    return {
        str(track.get("id") or "").strip(): track
        for track in tracks
        if isinstance(track, dict) and str(track.get("id") or "").strip()
    }


def album_summary(image_count: int, video_count: int) -> str:
    parts: list[str] = []
    if image_count:
        parts.append(f"{image_count} تصویر")
    if video_count:
        parts.append(f"{video_count} فیلم")
    joined = " و ".join(parts) or "محتوای تازه"
    return f"{joined} به این آلبوم اضافه شد."


def automatic_expiry_at(now_millis: int) -> int:
    return max(0, now_millis) + AUTOMATIC_RETENTION_MILLIS


def prune_stale_automatic_items(
    items: list[dict[str, Any]], now_millis: int
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for item in items:
        if not isinstance(item, dict):
            continue
        if item.get("pinned") or item.get("origin", "manual") == "manual":
            result.append(item)
            continue
        try:
            published_at = int(item.get("published_at_millis") or 0)
        except (TypeError, ValueError):
            published_at = 0
        try:
            expires_at = int(item.get("expires_at_millis") or 0)
        except (TypeError, ValueError):
            expires_at = 0

        expired = expires_at > 0 and expires_at <= now_millis
        too_old = (
            published_at > 0
            and published_at + AUTOMATIC_RETENTION_MILLIS <= now_millis
        )
        if not expired and not too_old:
            result.append(item)
    return result


def make_album_announcements(
    new_media: dict[str, dict[str, str]], now_millis: int
) -> list[dict[str, Any]]:
    grouped: dict[tuple[str, str], list[dict[str, str]]] = defaultdict(list)
    for item in new_media.values():
        grouped[(item["folder_hash"], item["folder_name"])].append(item)

    result: list[dict[str, Any]] = []
    for index, ((folder_hash, folder_name), items) in enumerate(sorted(grouped.items())):
        image_count = sum(item["kind"] == "image" for item in items)
        video_count = sum(item["kind"] == "video" for item in items)
        digest = hashlib.sha256(folder_hash.encode("utf-8")).hexdigest()[:12]
        summary = album_summary(image_count, video_count)
        result.append(
            {
                "id": f"auto-album-{now_millis}-{index}-{digest}"[:64],
                "category": "album_update",
                "origin": "auto_album",
                "title": f"محتوای تازه در آلبوم {folder_name}"[:180],
                "summary": summary,
                "body": summary + " برای مشاهده مستقیم، دکمه آلبوم را بزنید.",
                "image_url": "",
                "published": True,
                "pinned": False,
                "published_at_millis": now_millis,
                "expires_at_millis": automatic_expiry_at(now_millis),
                "related_album_hash": folder_hash,
                "related_album_name": folder_name[:160],
                "related_track_id": "",
            }
        )
    return result


def make_new_folder_announcements(
    new_folders: dict[str, dict[str, str]],
    current_media: dict[str, dict[str, str]],
    now_millis: int,
) -> list[dict[str, Any]]:
    media_by_folder: dict[str, list[dict[str, str]]] = defaultdict(list)
    for item in current_media.values():
        media_by_folder[item["folder_hash"]].append(item)

    result: list[dict[str, Any]] = []
    for index, (folder_hash, folder) in enumerate(sorted(new_folders.items())):
        folder_name = folder.get("folder_name") or "آلبوم بدون نام"
        contents = media_by_folder.get(folder_hash, [])
        image_count = sum(item["kind"] == "image" for item in contents)
        video_count = sum(item["kind"] == "video" for item in contents)
        digest = hashlib.sha256(folder_hash.encode("utf-8")).hexdigest()[:12]
        if contents:
            summary = album_summary(image_count, video_count)
            title = f"آلبوم تازه «{folder_name}» منتشر شد"
            body = summary + " برای مشاهده مستقیم، دکمه آلبوم را بزنید."
        else:
            summary = "این آلبوم تازه به مجموعه افزوده شد."
            title = f"آلبوم تازه «{folder_name}» ساخته شد"
            body = "محتوای این آلبوم پس از افزوده‌شدن در برنامه قابل مشاهده خواهد بود."
        result.append(
            {
                "id": f"auto-folder-{now_millis}-{index}-{digest}"[:64],
                "category": "album_update",
                "origin": "auto_album",
                "title": title[:180],
                "summary": summary[:500],
                "body": body[:4000],
                "image_url": "",
                "published": True,
                "pinned": False,
                "published_at_millis": now_millis + index,
                "expires_at_millis": automatic_expiry_at(now_millis),
                "related_album_hash": folder_hash,
                "related_album_name": folder_name[:160],
                "related_track_id": "",
            }
        )
    return result


def make_radio_announcements(
    new_track_ids: list[str], config: dict[str, Any], now_millis: int
) -> list[dict[str, Any]]:
    tracks = track_by_id(config)
    result: list[dict[str, Any]] = []
    for index, track_id in enumerate(new_track_ids):
        track = tracks.get(track_id) or {}
        title = str(track.get("title") or "نوای تازه").strip() or "نوای تازه"
        performer = str(track.get("performer") or "").strip()
        performer_text = performer or "اجراکننده نامشخص"
        digest = hashlib.sha256(track_id.encode("utf-8")).hexdigest()[:12]
        result.append(
            {
                "id": f"auto-radio-{now_millis}-{index}-{digest}"[:64],
                "category": "radio_update",
                "origin": "auto_radio",
                "title": f"نوای «{title}» به رادیو اضافه شد"[:180],
                "summary": f"نوای «{title}» با صدای {performer_text} اکنون در رادیو آل فاطمیون در دسترس است."[:500],
                "body": "برای انتخاب و پخش این نوا، دکمه رادیو آل فاطمیون را بزنید.",
                "image_url": "",
                "published": True,
                "pinned": False,
                "published_at_millis": now_millis + index,
                "expires_at_millis": automatic_expiry_at(now_millis),
                "related_album_hash": "",
                "related_album_name": "",
                "related_track_id": track_id,
            }
        )
    return result


def capped_items(items: list[dict[str, Any]]) -> list[dict[str, Any]]:
    def timestamp(item: dict[str, Any]) -> int:
        try:
            return int(item.get("published_at_millis") or 0)
        except (TypeError, ValueError):
            return 0

    newest = sorted(items, key=timestamp, reverse=True)
    protected = [
        item
        for item in newest
        if item.get("pinned") or item.get("origin", "manual") == "manual"
    ][:MAX_ANNOUNCEMENTS]
    protected_ids = {str(item.get("id") or "") for item in protected}
    remaining = [
        item
        for item in newest
        if str(item.get("id") or "") not in protected_ids
    ]
    return (protected + remaining)[:MAX_ANNOUNCEMENTS]


def synchronize(
    config: dict[str, Any],
    state: dict[str, Any],
    current_media: dict[str, dict[str, str]] | None,
    current_folders: dict[str, dict[str, str]] | None = None,
) -> tuple[dict[str, Any], dict[str, Any], int]:
    announcements = config.setdefault("announcements", {})
    announcements.setdefault("enabled", True)
    automation = announcements.setdefault("automation", {})
    automation_enabled = bool(automation.setdefault("enabled", True))
    album_enabled = bool(automation.setdefault("album_updates_enabled", True))
    radio_enabled = bool(automation.setdefault("radio_updates_enabled", True))
    items = announcements.setdefault("items", [])
    if not isinstance(items, list):
        items = []
        announcements["items"] = items

    now_millis = int(time.time() * 1000)
    cleaned_items = prune_stale_automatic_items(items, now_millis)

    root_hash = str(((config.get("source") or {}).get("root_hash")) or "").strip()
    current_tracks = enabled_track_ids(config)
    previous_root = str(state.get("root_hash") or "")
    legacy_media = state.get("media") if isinstance(state.get("media"), dict) else {}
    previous_media_ids = set(state.get("media_ids") or legacy_media.keys())
    seen_tracks = set(state.get("seen_radio_track_ids") or [])
    previous_folder_ids = set(state.get("folder_ids") or [])
    first_run = not bool(state.get("initialized"))
    root_changed = root_hash != previous_root
    folder_tracking_initialized = "folder_ids" in state
    if "album_initialized" in state:
        album_initialized = bool(state.get("album_initialized"))
    else:
        # Schema v2 did not have this flag. A stored folder baseline means
        # album tracking was already initialized successfully.
        album_initialized = bool(
            state.get("initialized") and folder_tracking_initialized
        )
    generated: list[dict[str, Any]] = []

    if (
        current_media is not None
        and not first_run
        and not root_changed
        and album_initialized
    ):
        new_ids = set(current_media) - previous_media_ids
        new_folder_ids: set[str] = set()
        if current_folders is not None and folder_tracking_initialized:
            new_folder_ids = set(current_folders) - previous_folder_ids

        if automation_enabled and album_enabled and new_folder_ids:
            generated.extend(
                make_new_folder_announcements(
                    {
                        folder_id: current_folders[folder_id]
                        for folder_id in new_folder_ids
                    },
                    current_media,
                    now_millis,
                )
            )

        regular_new_ids = {
            media_id
            for media_id in new_ids
            if current_media[media_id]["folder_hash"] not in new_folder_ids
        }
        if automation_enabled and album_enabled and regular_new_ids:
            generated.extend(
                make_album_announcements(
                    {
                        media_id: current_media[media_id]
                        for media_id in regular_new_ids
                    },
                    now_millis + len(generated),
                )
            )

    announced_track_ids = {
        str(item.get("related_track_id") or "").strip()
        for item in items
        if isinstance(item, dict) and item.get("origin") == "auto_radio"
    }
    seen_tracks.update(track_id for track_id in announced_track_ids if track_id)
    new_track_ids = [
        track_id for track_id in current_tracks if track_id not in seen_tracks
    ]
    if not first_run and automation_enabled and radio_enabled and new_track_ids:
        generated.extend(make_radio_announcements(new_track_ids, config, now_millis))

    seen_tracks.update(current_tracks)
    if current_media is None:
        next_media_ids = previous_media_ids
        next_folder_ids = previous_folder_ids
        next_album_initialized = album_initialized and not root_changed
    else:
        next_media_ids = set(current_media)
        next_folder_ids = set(current_folders or {})
        next_album_initialized = True

    next_state = {
        "schema_version": 3,
        "initialized": True,
        "album_initialized": next_album_initialized,
        "root_hash": root_hash,
        "media_ids": sorted(next_media_ids),
        "folder_ids": sorted(next_folder_ids),
        "seen_radio_track_ids": sorted(seen_tracks),
    }

    next_items = capped_items(generated + cleaned_items)
    if next_items != items:
        announcements["items"] = next_items
        try:
            revision = int(config.get("revision") or 0)
        except (TypeError, ValueError):
            revision = 0
        config["revision"] = max(0, revision) + 1

    return config, next_state, len(generated)


def main() -> None:
    config = load_json(CONFIG_PATH, None)
    if not isinstance(config, dict):
        raise RuntimeError(f"Invalid or missing {CONFIG_PATH}")
    state = load_json(STATE_PATH, {})
    if not isinstance(state, dict):
        state = {}

    root_hash = str(((config.get("source") or {}).get("root_hash")) or "").strip()
    deferred_reason: str | None = None
    if root_hash:
        try:
            current_media, current_folders = scan_albums(root_hash)
        except Exception as error:
            # Do not fail installation or a scheduled run for a temporary
            # or provider-side failure. Passing None preserves the previous
            # baseline; the next successful scheduled run resumes safely.
            current_media, current_folders = None, None
            deferred_reason = f"{type(error).__name__}: {error}"
    else:
        current_media, current_folders = {}, {}
    config, next_state, generated_count = synchronize(
        config,
        state,
        current_media,
        current_folders,
    )
    write_json(CONFIG_PATH, config)
    write_json(STATE_PATH, next_state)
    if deferred_reason:
        print(
            "::warning title=Album scan deferred safely::"
            + deferred_reason.replace("\n", " ")
        )
    print(f"Automatic announcements created: {generated_count}")


if __name__ == "__main__":
    main()
