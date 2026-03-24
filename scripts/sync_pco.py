"""
sync_pco.py — Pull worship data from Planning Center Services API
and write public/data.csv and public/photos.csv for the dashboard.

Authenticates via Personal Access Token (HTTP Basic Auth).
Expects env vars: PCO_APP_ID, PCO_SECRET

PCO API docs: https://developer.planning.center/docs/#/apps/services
"""

import csv
import os
import sys
import time
import requests

# ─── Config ────────────────────────────────────────────────────────
PCO_APP_ID = os.environ.get("PCO_APP_ID")
PCO_SECRET = os.environ.get("PCO_SECRET")
BASE_URL = "https://api.planningcenteronline.com/services/v2"

# How many past plans to look back through (increase if you want more history)
MAX_PLANS = 200

# Output paths (relative to repo root)
DATA_CSV = "public/data.csv"
PHOTOS_CSV = "public/photos.csv"


# ─── Helpers ───────────────────────────────────────────────────────
def pco_get(url, params=None):
    """Make an authenticated GET request to the PCO API with rate-limit handling."""
    resp = requests.get(url, auth=(PCO_APP_ID, PCO_SECRET), params=params or {})

    # Handle rate limiting
    if resp.status_code == 429:
        retry_after = int(resp.headers.get("Retry-After", 5))
        print(f"  Rate limited. Waiting {retry_after}s...")
        time.sleep(retry_after)
        return pco_get(url, params)

    resp.raise_for_status()
    return resp.json()


def pco_get_all(url, params=None):
    """Paginate through all results from a PCO API endpoint."""
    all_data = []
    params = dict(params or {})
    params.setdefault("per_page", 100)

    while url:
        result = pco_get(url, params)
        all_data.extend(result.get("data", []))
        next_link = result.get("links", {}).get("next")
        # After first request, params are embedded in the next URL
        url = next_link
        params = {}

    return all_data


# ─── Main sync logic ──────────────────────────────────────────────
def sync():
    if not PCO_APP_ID or not PCO_SECRET:
        print("ERROR: PCO_APP_ID and PCO_SECRET environment variables are required.")
        print("Get a Personal Access Token at: https://api.planningcenteronline.com/oauth/applications")
        sys.exit(1)

    print("Fetching service types...")
    service_types = pco_get_all(f"{BASE_URL}/service_types")
    print(f"  Found {len(service_types)} service type(s)")

    song_rows = []       # For data.csv
    person_photos = {}   # For photos.csv — {person_id: {name, photo_url}}
    song_cache = {}      # Cache song details to avoid redundant API calls

    for st in service_types:
        st_id = st["id"]
        st_name = st["attributes"]["name"]
        print(f"\nProcessing service type: {st_name} (ID: {st_id})")

        # Get past plans (most recent first)
        plans = pco_get_all(
            f"{BASE_URL}/service_types/{st_id}/plans",
            params={"filter": "past", "order": "-sort_date", "per_page": 25}
        )

        # Limit how far back we go
        plans = plans[:MAX_PLANS]
        print(f"  Found {len(plans)} past plan(s)")

        for plan in plans:
            plan_id = plan["id"]
            plan_date = (plan["attributes"].get("sort_date") or "")[:10]  # YYYY-MM-DD

            # Get plan items (songs, headers, etc.)
            items = pco_get_all(
                f"{BASE_URL}/service_types/{st_id}/plans/{plan_id}/items",
                params={"include": "song,arrangement"}
            )

            # Get team members for this plan (worship leaders, etc.)
            team_members = pco_get_all(
                f"{BASE_URL}/service_types/{st_id}/plans/{plan_id}/team_members",
                params={"include": "person"}
            )

            # Build a lookup of team members by position
            leaders = []
            for tm in team_members:
                attrs = tm.get("attributes") or {}
                tm_name = attrs.get("name") or ""
                tm_status = attrs.get("status") or ""
                tm_position = attrs.get("team_position_name") or ""
                photo_url = attrs.get("photo_thumbnail") or ""

                # Collect person photos
                person_rel = tm.get("relationships") or {}
                person_data = (person_rel.get("person") or {}).get("data") or {}
                person_id = person_data.get("id")
                if person_id and tm_name:
                    person_photos[person_id] = {
                        "name": tm_name,
                        "photo_url": photo_url
                    }

                # Track worship leaders (adjust position names to match your setup)
                if tm_status == "C" and tm_position and any(
                    keyword in tm_position.lower()
                    for keyword in ["leader", "worship", "music director"]
                ):
                    leaders.append(tm_name)

            leader_str = "; ".join(leaders) if leaders else ""

            for item in items:
                attrs = item.get("attributes") or {}
                item_type = attrs.get("item_type") or ""

                # Only process song items
                if item_type != "song":
                    continue

                title = attrs.get("title") or ""
                key = attrs.get("key_name") or ""
                arrangement = attrs.get("arrangement_name") or attrs.get("description") or ""

                # Get song details if available
                item_rel = item.get("relationships") or {}
                song_rel = (item_rel.get("song") or {}).get("data")
                song_id = song_rel["id"] if song_rel else ""

                # Get CCLI and author from the song record (with caching)
                ccli = ""
                author = ""
                if song_id:
                    if song_id in song_cache:
                        ccli = song_cache[song_id]["ccli"]
                        author = song_cache[song_id]["author"]
                    else:
                        try:
                            song_detail = pco_get(f"{BASE_URL}/songs/{song_id}")
                            song_attrs = (song_detail.get("data") or {}).get("attributes") or {}
                            ccli = song_attrs.get("ccli_number") or ""
                            author = song_attrs.get("author") or ""
                            song_cache[song_id] = {"ccli": ccli, "author": author}
                        except Exception as e:
                            print(f"    Warning: Could not fetch song {song_id}: {e}")
                            song_cache[song_id] = {"ccli": "", "author": ""}

                song_rows.append({
                    "date": plan_date,
                    "service_type": st_name,
                    "title": title,
                    "author": author,
                    "key": key,
                    "arrangement": arrangement,
                    "ccli": str(ccli),
                    "song_id": song_id,
                    "worship_leader": leader_str,
                })

    # ─── Write data.csv ────────────────────────────────────────────
    print(f"\nWriting {DATA_CSV} ({len(song_rows)} rows)...")
    os.makedirs(os.path.dirname(DATA_CSV), exist_ok=True)

    with open(DATA_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=[
            "date", "service_type", "title", "author", "key",
            "arrangement", "ccli", "song_id", "worship_leader"
        ])
        writer.writeheader()
        writer.writerows(song_rows)

    # ─── Write photos.csv ──────────────────────────────────────────
    print(f"Writing {PHOTOS_CSV} ({len(person_photos)} people)...")
    with open(PHOTOS_CSV, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["person_id", "name", "photo_url"])
        writer.writeheader()
        for pid, info in person_photos.items():
            writer.writerow({
                "person_id": pid,
                "name": info["name"],
                "photo_url": info["photo_url"],
            })

    print(f"\nDone! Synced {len(song_rows)} songs, {len(person_photos)} people, {len(song_cache)} unique songs cached.")


if __name__ == "__main__":
    sync()
