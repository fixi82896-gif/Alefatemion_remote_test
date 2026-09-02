#!/usr/bin/env python3

import copy
import io
import json
import tempfile
import unittest
import urllib.error
from pathlib import Path
from unittest import mock

from sync_announcements import (
    AUTOMATIC_RETENTION_MILLIS,
    FETCH_ATTEMPTS,
    TemporarySourceError,
    capped_items,
    fetch_json,
    main,
    prune_stale_automatic_items,
    synchronize,
)


def base_config():
    return {
        "schema_version": 1,
        "revision": 4,
        "source": {"root_hash": "root_hash_123"},
        "nava": {
            "tracks": [
                {
                    "id": "track-1",
                    "title": "نوای اول",
                    "performer": "خواننده",
                    "enabled": True,
                }
            ]
        },
        "announcements": {
            "enabled": True,
            "automation": {
                "enabled": True,
                "album_updates_enabled": True,
                "radio_updates_enabled": True,
            },
            "items": [],
        },
    }


class AnnouncementSyncTest(unittest.TestCase):
    def test_first_run_only_initializes_state(self):
        media = {
            "id:1": {
                "folder_hash": "album_hash_123",
                "folder_name": "آلبوم اول",
                "kind": "image",
            }
        }
        folders = {
            "album_hash_123": {
                "folder_hash": "album_hash_123",
                "folder_name": "آلبوم اول",
                "parent_hash": "root_hash_123",
            }
        }
        config, state, generated = synchronize(
            base_config(), {}, media, folders
        )

        self.assertEqual(0, generated)
        self.assertEqual([], config["announcements"]["items"])
        self.assertEqual(["track-1"], state["seen_radio_track_ids"])
        self.assertEqual(["id:1"], state["media_ids"])
        self.assertEqual(["album_hash_123"], state["folder_ids"])
        self.assertTrue(state["album_initialized"])

    def test_temporary_first_scan_failure_defers_album_baseline_safely(self):
        config, state, generated = synchronize(
            base_config(), {}, None, None
        )

        self.assertEqual(0, generated)
        self.assertEqual([], config["announcements"]["items"])
        self.assertTrue(state["initialized"])
        self.assertFalse(state["album_initialized"])
        self.assertEqual([], state["media_ids"])
        self.assertEqual([], state["folder_ids"])
        self.assertEqual(["track-1"], state["seen_radio_track_ids"])

        old_media = {
            "id:1": {
                "folder_hash": "old_album_hash",
                "folder_name": "آلبوم قدیمی",
                "kind": "image",
            }
        }
        old_folders = {
            "old_album_hash": {
                "folder_hash": "old_album_hash",
                "folder_name": "آلبوم قدیمی",
                "parent_hash": "root_hash_123",
            }
        }
        config, next_state, generated = synchronize(
            config, state, old_media, old_folders
        )

        self.assertEqual(0, generated)
        self.assertEqual([], config["announcements"]["items"])
        self.assertTrue(next_state["album_initialized"])
        self.assertEqual(["id:1"], next_state["media_ids"])
        self.assertEqual(["old_album_hash"], next_state["folder_ids"])

    def test_temporary_later_scan_failure_preserves_album_baseline(self):
        state = {
            "schema_version": 3,
            "initialized": True,
            "album_initialized": True,
            "root_hash": "root_hash_123",
            "media_ids": ["id:1"],
            "folder_ids": ["album_hash_123"],
            "seen_radio_track_ids": ["track-1"],
        }

        _, next_state, generated = synchronize(
            base_config(), state, None, None
        )

        self.assertEqual(0, generated)
        self.assertTrue(next_state["album_initialized"])
        self.assertEqual(["id:1"], next_state["media_ids"])
        self.assertEqual(["album_hash_123"], next_state["folder_ids"])

    def test_transient_http_error_is_retried_then_deferred(self):
        error = urllib.error.HTTPError(
            url="https://abrehamrahi.ir/api/v4/test",
            code=500,
            msg="Internal Server Error",
            hdrs={},
            fp=io.BytesIO(b""),
        )

        with mock.patch(
            "sync_announcements.urllib.request.urlopen",
            side_effect=error,
        ) as urlopen, mock.patch(
            "sync_announcements.time.sleep"
        ) as sleep:
            with self.assertRaises(TemporarySourceError):
                fetch_json("https://abrehamrahi.ir/api/v4/test")

        self.assertEqual(FETCH_ATTEMPTS, urlopen.call_count)
        self.assertEqual(FETCH_ATTEMPTS - 1, sleep.call_count)

    def test_transient_http_error_can_recover_on_retry(self):
        error = urllib.error.HTTPError(
            url="https://abrehamrahi.ir/api/v4/test",
            code=503,
            msg="Service Unavailable",
            hdrs={},
            fp=io.BytesIO(b""),
        )
        response = mock.MagicMock()
        response.__enter__.return_value.status = 200
        response.__enter__.return_value.read.return_value = json.dumps(
            {"results": [], "next": None}
        ).encode("utf-8")

        with mock.patch(
            "sync_announcements.urllib.request.urlopen",
            side_effect=[error, response],
        ) as urlopen, mock.patch(
            "sync_announcements.time.sleep"
        ) as sleep:
            payload = fetch_json(
                "https://abrehamrahi.ir/api/v4/test"
            )

        self.assertEqual([], payload["results"])
        self.assertEqual(2, urlopen.call_count)
        self.assertEqual(1, sleep.call_count)

    def test_main_persists_safe_deferred_state_during_provider_outage(self):
        with tempfile.TemporaryDirectory() as directory:
            config_path = Path(directory) / "app-config.json"
            state_path = Path(directory) / "announcement-state.json"
            config_path.write_text(
                json.dumps(base_config(), ensure_ascii=False),
                encoding="utf-8",
            )

            with mock.patch(
                "sync_announcements.CONFIG_PATH", config_path
            ), mock.patch(
                "sync_announcements.STATE_PATH", state_path
            ), mock.patch(
                "sync_announcements.scan_albums",
                side_effect=TemporarySourceError("HTTP 500"),
            ), mock.patch("builtins.print") as output:
                main()

            state = json.loads(state_path.read_text(encoding="utf-8"))
            self.assertTrue(state["initialized"])
            self.assertFalse(state["album_initialized"])
            self.assertEqual([], state["media_ids"])
            self.assertEqual([], state["folder_ids"])
            output.assert_any_call(
                "::warning title=Album scan deferred safely::"
                "TemporarySourceError: HTTP 500"
            )

    def test_new_album_media_is_grouped_and_new_track_is_announced_once(self):
        initial_media = {
            "id:1": {
                "folder_hash": "album_hash_123",
                "folder_name": "آلبوم اول",
                "kind": "image",
            }
        }
        state = {
            "initialized": True,
            "root_hash": "root_hash_123",
            "media_ids": ["id:1"],
            "folder_ids": ["album_hash_123"],
            "seen_radio_track_ids": ["track-1"],
        }
        config = base_config()
        config["nava"]["tracks"].append(
            {
                "id": "track-2",
                "title": "نوای دوم",
                "performer": "ذاکر",
                "enabled": True,
            }
        )
        media = copy.deepcopy(initial_media)
        media.update(
            {
                "id:2": {
                    "folder_hash": "album_hash_123",
                    "folder_name": "آلبوم اول",
                    "kind": "image",
                },
                "id:3": {
                    "folder_hash": "album_hash_123",
                    "folder_name": "آلبوم اول",
                    "kind": "video",
                },
            }
        )

        folders = {
            "album_hash_123": {
                "folder_hash": "album_hash_123",
                "folder_name": "آلبوم اول",
                "parent_hash": "root_hash_123",
            }
        }
        config, next_state, generated = synchronize(
            config, state, media, folders
        )

        self.assertEqual(2, generated)
        self.assertEqual(5, config["revision"])
        items = config["announcements"]["items"]
        self.assertEqual(
            {"album_update", "radio_update"},
            {item["category"] for item in items},
        )
        album_item = next(item for item in items if item["category"] == "album_update")
        self.assertIn("1 تصویر و 1 فیلم", album_item["summary"])
        self.assertEqual("album_hash_123", album_item["related_album_hash"])
        self.assertIn("track-2", next_state["seen_radio_track_ids"])

        config, _, generated_again = synchronize(
            config, next_state, media, folders
        )
        self.assertEqual(0, generated_again)

    def test_new_folder_with_media_creates_one_combined_announcement(self):
        state = {
            "initialized": True,
            "root_hash": "root_hash_123",
            "media_ids": [],
            "folder_ids": [],
            "seen_radio_track_ids": ["track-1"],
        }
        media = {
            "id:2": {
                "folder_hash": "new_album_hash",
                "folder_name": "آلبوم تازه",
                "kind": "image",
            },
            "id:3": {
                "folder_hash": "new_album_hash",
                "folder_name": "آلبوم تازه",
                "kind": "video",
            },
        }
        folders = {
            "new_album_hash": {
                "folder_hash": "new_album_hash",
                "folder_name": "آلبوم تازه",
                "parent_hash": "root_hash_123",
            }
        }

        config, next_state, generated = synchronize(
            base_config(), state, media, folders
        )

        self.assertEqual(1, generated)
        item = config["announcements"]["items"][0]
        self.assertIn("آلبوم تازه", item["title"])
        self.assertIn("1 تصویر و 1 فیلم", item["summary"])
        self.assertEqual("new_album_hash", item["related_album_hash"])
        self.assertEqual(["new_album_hash"], next_state["folder_ids"])

    def test_empty_new_folder_is_announced(self):
        state = {
            "initialized": True,
            "root_hash": "root_hash_123",
            "media_ids": [],
            "folder_ids": [],
            "seen_radio_track_ids": ["track-1"],
        }
        folders = {
            "empty_album_hash": {
                "folder_hash": "empty_album_hash",
                "folder_name": "آلبوم خالی",
                "parent_hash": "root_hash_123",
            }
        }

        config, _, generated = synchronize(
            base_config(), state, {}, folders
        )

        self.assertEqual(1, generated)
        item = config["announcements"]["items"][0]
        self.assertIn("ساخته شد", item["title"])
        self.assertEqual("empty_album_hash", item["related_album_hash"])

    def test_old_state_migration_baselines_folders_without_flood(self):
        state = {
            "initialized": True,
            "root_hash": "root_hash_123",
            "media_ids": ["id:1"],
            "seen_radio_track_ids": ["track-1"],
        }
        media = {
            "id:1": {
                "folder_hash": "old_album_hash",
                "folder_name": "آلبوم قدیمی",
                "kind": "image",
            }
        }
        folders = {
            "old_album_hash": {
                "folder_hash": "old_album_hash",
                "folder_name": "آلبوم قدیمی",
                "parent_hash": "root_hash_123",
            }
        }

        config, next_state, generated = synchronize(
            base_config(), state, media, folders
        )

        self.assertEqual(0, generated)
        self.assertEqual([], config["announcements"]["items"])
        self.assertEqual(["old_album_hash"], next_state["folder_ids"])

    def test_immediate_radio_announcement_prevents_workflow_duplicate(self):
        config = base_config()
        config["nava"]["tracks"].append(
            {
                "id": "track-2",
                "title": "نوای دوم",
                "performer": "ذاکر",
                "enabled": True,
            }
        )
        config["announcements"]["items"] = [
            {
                "id": "auto-radio-track-2-local",
                "origin": "auto_radio",
                "category": "radio_update",
                "title": "نوای تازه",
                "related_track_id": "track-2",
                "published_at_millis": 10,
            }
        ]
        state = {
            "initialized": True,
            "root_hash": "root_hash_123",
            "media_ids": [],
            "folder_ids": [],
            "seen_radio_track_ids": ["track-1"],
        }

        config, next_state, generated = synchronize(
            config, state, {}, {}
        )

        self.assertEqual(0, generated)
        self.assertEqual(0, len(config["announcements"]["items"]))
        self.assertIn("track-2", next_state["seen_radio_track_ids"])

    def test_capping_keeps_manual_and_pinned_items(self):
        automatic = [
            {
                "id": f"auto-{index}",
                "origin": "auto_album",
                "published_at_millis": index,
            }
            for index in range(110)
        ]
        manual = {
            "id": "manual-old",
            "origin": "manual",
            "published_at_millis": 0,
        }
        pinned = {
            "id": "pinned-old",
            "origin": "auto_radio",
            "pinned": True,
            "published_at_millis": 0,
        }

        result = capped_items(automatic + [manual, pinned])

        self.assertEqual(80, len(result))
        self.assertIn("manual-old", {item["id"] for item in result})
        self.assertIn("pinned-old", {item["id"] for item in result})

    def test_stale_automatic_items_are_removed_but_manual_and_pinned_remain(self):
        now_millis = 5_000_000_000
        old_timestamp = now_millis - AUTOMATIC_RETENTION_MILLIS - 1
        items = [
            {
                "id": "auto-old",
                "origin": "auto_album",
                "published_at_millis": old_timestamp,
            },
            {
                "id": "manual-old",
                "origin": "manual",
                "published_at_millis": old_timestamp,
            },
            {
                "id": "pinned-old",
                "origin": "auto_radio",
                "pinned": True,
                "published_at_millis": old_timestamp,
            },
            {
                "id": "auto-new",
                "origin": "auto_album",
                "published_at_millis": now_millis - 1,
            },
        ]

        result = prune_stale_automatic_items(items, now_millis)

        self.assertEqual(
            {"manual-old", "pinned-old", "auto-new"},
            {item["id"] for item in result},
        )


if __name__ == "__main__":
    unittest.main()
