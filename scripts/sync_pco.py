"""
sync_pco.py — Pull worship data from Planning Center Services API.
Only pulls from Sunday Morning Worship.
Leader detection: parses item description for leader names, falls back to
Joey Halderman (after 2026-02-01), Jeffrey Bower (2023-05-01 to 2026-01-31),
or Podge Cross (before 2023-05-01).
"""
import csv, os, sys, time, re, requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry

PCO_APP_ID = os.environ.get("PCO_APP_ID")
PCO_SECRET = os.environ.get("PCO_SECRET")
BASE = "https://api.planningcenteronline.com/services/v2"
MAX_PLANS = 200
SERVICE_TYPE_NAME = "Sunday Morning Worship"
FALLBACK_JOEY = "2026-02-01"   # After this: Joey Halderman
FALLBACK_JEFF = "2023-05-01"   # After this (before Joey): Jeffrey Bower
                                # Before Jeff: Podge Cross

# Known song leaders (first names -> full names)
LEADERS = {
    "jeff": "Jeffrey Bower", "jeffrey": "Jeffrey Bower",
    "podge": "Podge Cross",
    "kellie": "Kellie Wenzel", "kell": "Kellie Wenzel",
    "joey": "Joey Halderman",
    "eric": "Eric Yun",
    "ciara": "Ciara Andrews",
    "paul": "Paul Klassen",
    "kailey": "Kailey Borland",
    "becky": "Becky Burnside",
    "alex": "Alex Dugan",
    "madi": "Madi McCrain",
    "kim": "Kim Morales",
    "sarah": "Sarah Nicholson",
    "joanie": "Joanie Williams",
    "abigail": "Abigail Bower", "abby": "Abigail Bower",
    "ashlyn": "Ashlyn Duhon",
    "chelsea": "Chelsea Allred",
    "mia": "Mia Kosharek",
    "brett": "Brett Lipscomb",
    "will": "Will Vidito",
}

# Session with retry logic for connection drops
session = requests.Session()
retries = Retry(total=5, backoff_factor=2, status_forcelist=[429, 500, 502, 503, 504],
                allowed_methods=["GET"], raise_on_status=False)
session.mount("https://", HTTPAdapter(max_retries=retries))


def api(url, params=None):
    r = session.get(url, auth=(PCO_APP_ID, PCO_SECRET), params=params or {}, timeout=30)
    if r.status_code == 429:
        wait = int(r.headers.get("Retry-After", 5))
        print(f"  Rate limited, waiting {wait}s...")
        time.sleep(wait)
        return api(url, params)
    r.raise_for_status()
    return r.json()


def api_all(url, params=None):
    out, params = [], dict(params or {})
    params.setdefault("per_page", 100)
    while url:
        r = api(url, params)
        out.extend(r.get("data", []))
        url = r.get("links", {}).get("next")
        params = {}
    return out


def parse_leader_from_desc(desc, team_members_names):
    """Parse song leader from item description like 'Kellie to Lead', 'Paul Leads', 'Kellie/Jeff Duet'."""
    if not desc:
        return None, None

    desc_clean = desc.strip()
    leader1, leader2 = None, None

    # Check for "Name to Lead" or "Name Leads" pattern
    m = re.match(r'^(\w+)\s+(?:to\s+)?[Ll]eads?', desc_clean)
    if m:
        first = m.group(1).lower()
        if first in LEADERS:
            leader1 = LEADERS[first]

    # Check for "Name/Name Duet" pattern
    m2 = re.match(r'^(\w+)[/&](\w+)', desc_clean)
    if m2:
        f1, f2 = m2.group(1).lower(), m2.group(2).lower()
        if f1 in LEADERS:
            leader1 = LEADERS[f1]
        if f2 in LEADERS:
            leader2 = LEADERS[f2]

    # If no pattern matched, check if description starts with a known first name
    if not leader1:
        first_word = desc_clean.split()[0].lower().rstrip('.,;:') if desc_clean else ""
        if first_word in LEADERS:
            leader1 = LEADERS[first_word]

    # Also check if any known full name appears in the description
    if not leader1:
        for full_name in set(LEADERS.values()):
            if full_name.lower() in desc_clean.lower():
                leader1 = full_name
                break

    return leader1, leader2


def sync():
    if not PCO_APP_ID or not PCO_SECRET:
        print("ERROR: Set PCO_APP_ID and PCO_SECRET env vars")
        sys.exit(1)

    print("Fetching service types...")
    service_types = api_all(f"{BASE}/service_types")

    # Find Sunday Morning Worship
    st = None
    for s in service_types:
        if s["attributes"]["name"] == SERVICE_TYPE_NAME:
            st = s
            break
    if not st:
        print(f"ERROR: Could not find service type '{SERVICE_TYPE_NAME}'")
        print(f"  Available: {[s['attributes']['name'] for s in service_types]}")
        sys.exit(1)

    st_id = st["id"]
    print(f"Using: {SERVICE_TYPE_NAME} (ID: {st_id})")

    # Fetch past plans
    past_plans = api_all(f"{BASE}/service_types/{st_id}/plans",
                    {"filter": "past", "order": "-sort_date", "per_page": 25})[:MAX_PLANS]
    # Fetch future/upcoming plans
    future_plans = api_all(f"{BASE}/service_types/{st_id}/plans",
                    {"filter": "future", "order": "sort_date", "per_page": 10})
    plans = future_plans + past_plans
    print(f"  {len(past_plans)} past + {len(future_plans)} upcoming = {len(plans)} plans")

    rows, people, song_cache = [], {}, {}
    all_band, all_prod = set(), set()

    for pi, plan in enumerate(plans):
        pid = plan["id"]
        pdate = (plan["attributes"].get("sort_date") or "")[:10]
        if pi % 20 == 0:
            print(f"  Processing plan {pi+1}/{len(plans)} ({pdate})...")

        items = api_all(f"{BASE}/service_types/{st_id}/plans/{pid}/items",
                        {"include": "song,arrangement"})
        members = api_all(f"{BASE}/service_types/{st_id}/plans/{pid}/team_members",
                          {"include": "person"})

        # Collect team member info
        band, prod = {}, {}
        member_names = set()

        for tm in members:
            a = tm.get("attributes") or {}
            name = a.get("name") or ""
            status = a.get("status") or ""
            pos = a.get("team_position_name") or ""
            team = a.get("team_name") or ""
            photo = a.get("photo_thumbnail") or ""

            pr = (tm.get("relationships") or {}).get("person") or {}
            pid2 = (pr.get("data") or {}).get("id")
            if pid2 and name:
                people[pid2] = {"Name": name, "Photo URL": photo}

            if status != "C":
                continue
            member_names.add(name)

            pl, tl = pos.lower(), team.lower()
            if "band" in tl or any(k in pl for k in ["acoustic", "electric", "bass", "drums", "keys", "guitar", "vocals", "piano", "support", "worship leader"]):
                if pos:
                    band[pos] = name
                    all_band.add(pos)
            elif "prod" in tl or any(k in pl for k in ["audio", "video", "livestream", "propresenter", "lights", "camera"]):
                if pos:
                    prod[pos] = name
                    all_prod.add(pos)

        # Default fallback leader for this date
        default_leader = "Joey Halderman" if pdate >= FALLBACK_JOEY else "Jeffrey Bower" if pdate >= FALLBACK_JEFF else "Podge Cross"

        for item in items:
            ia = item.get("attributes") or {}
            if (ia.get("item_type") or "") != "song":
                continue

            title = ia.get("title") or ""
            key = ia.get("key_name") or ""
            arr = ia.get("arrangement_name") or ia.get("description") or ""
            desc = ia.get("description") or ""

            # Parse leader from description
            l1, l2 = parse_leader_from_desc(desc, member_names)

            # Fallback: use default worship leader
            if not l1:
                l1 = default_leader

            sr = ((item.get("relationships") or {}).get("song") or {}).get("data")
            sid = sr["id"] if sr else ""
            ccli, author = "", ""
            if sid:
                if sid in song_cache:
                    ccli, author = song_cache[sid]["ccli"], song_cache[sid]["author"]
                else:
                    try:
                        sd = api(f"{BASE}/songs/{sid}")
                        sa = (sd.get("data") or {}).get("attributes") or {}
                        ccli = sa.get("ccli_number") or ""
                        author = sa.get("author") or ""
                    except:
                        pass
                    song_cache[sid] = {"ccli": ccli, "author": author}

            row = {
                "Date": pdate,
                "Song Title": title,
                "Key": key,
                "Arrangement": arr,
                "Song Leader 1": l1 or "",
                "Song Leader 2": l2 or "",
                "Author": author,
                "CCLI #": str(ccli),
                "Raw Description": desc,
            }
            for c, v in band.items():
                row[f"Band: {c}"] = v
            for c, v in prod.items():
                row[f"Prod: {c}"] = v
            rows.append(row)

    cols = ["Date", "Song Title", "Key", "Arrangement", "Song Leader 1", "Song Leader 2",
            "Author", "CCLI #", "Raw Description"]
    cols += sorted(f"Band: {c}" for c in all_band)
    cols += sorted(f"Prod: {c}" for c in all_prod)

    os.makedirs("public", exist_ok=True)
    print(f"\nWriting public/data.csv ({len(rows)} rows)...")
    with open("public/data.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader()
        w.writerows(rows)

    print(f"Writing public/photos.csv ({len(people)} people)...")
    with open("public/photos.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["Name", "Photo URL"])
        w.writeheader()
        for info in people.values():
            w.writerow(info)

    print(f"\nDone! {len(rows)} songs, {len(people)} people, {len(song_cache)} unique songs.")


if __name__ == "__main__":
    sync()
