"""
sync_pco.py — Pull worship data from Planning Center Services API.
Writes CSV headers matching the dashboard's expected format exactly.
"""
import csv, os, sys, time, requests

PCO_APP_ID = os.environ.get("PCO_APP_ID")
PCO_SECRET = os.environ.get("PCO_SECRET")
BASE = "https://api.planningcenteronline.com/services/v2"
MAX_PLANS = 200

def api(url, params=None):
    r = requests.get(url, auth=(PCO_APP_ID, PCO_SECRET), params=params or {})
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

def sync():
    if not PCO_APP_ID or not PCO_SECRET:
        print("ERROR: Set PCO_APP_ID and PCO_SECRET env vars"); sys.exit(1)

    print("Fetching service types...")
    service_types = api_all(f"{BASE}/service_types")
    print(f"  Found {len(service_types)}")

    rows, people, song_cache = [], {}, {}
    all_band, all_prod = set(), set()

    for st in service_types:
        st_id, st_name = st["id"], st["attributes"]["name"]
        print(f"\n{st_name} (ID: {st_id})")
        plans = api_all(f"{BASE}/service_types/{st_id}/plans",
                        {"filter": "past", "order": "-sort_date", "per_page": 25})[:MAX_PLANS]
        print(f"  {len(plans)} plans")

        for plan in plans:
            pid = plan["id"]
            pdate = (plan["attributes"].get("sort_date") or "")[:10]

            items = api_all(f"{BASE}/service_types/{st_id}/plans/{pid}/items",
                            {"include": "song,arrangement"})
            members = api_all(f"{BASE}/service_types/{st_id}/plans/{pid}/team_members",
                              {"include": "person"})

            leaders, band, prod = [], {}, {}
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
                if status != "C": continue

                pl, tl = pos.lower(), team.lower()
                if pos and any(k in pl for k in ["leader", "worship"]):
                    leaders.append(name)
                elif "band" in tl or any(k in pl for k in ["acoustic","electric","bass","drums","keys","guitar","vocals","piano","support"]):
                    band[pos or "Other"] = name; all_band.add(pos or "Other")
                elif "prod" in tl or any(k in pl for k in ["audio","video","livestream","propresenter","lights","camera"]):
                    prod[pos or "Other"] = name; all_prod.add(pos or "Other")

            l1 = leaders[0] if leaders else ""
            l2 = leaders[1] if len(leaders) > 1 else ""

            for item in items:
                ia = item.get("attributes") or {}
                if (ia.get("item_type") or "") != "song": continue

                title = ia.get("title") or ""
                key = ia.get("key_name") or ""
                arr = ia.get("arrangement_name") or ia.get("description") or ""
                desc = ia.get("description") or ""

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
                        except: pass
                        song_cache[sid] = {"ccli": ccli, "author": author}

                row = {"Date": pdate, "Song Title": title, "Key": key,
                       "Arrangement": arr, "Song Leader 1": l1, "Song Leader 2": l2,
                       "Author": author, "CCLI #": str(ccli), "Raw Description": desc}
                for c, v in band.items(): row[f"Band: {c}"] = v
                for c, v in prod.items(): row[f"Prod: {c}"] = v
                rows.append(row)

    cols = ["Date","Song Title","Key","Arrangement","Song Leader 1","Song Leader 2",
            "Author","CCLI #","Raw Description"]
    cols += sorted(f"Band: {c}" for c in all_band)
    cols += sorted(f"Prod: {c}" for c in all_prod)

    os.makedirs("public", exist_ok=True)
    print(f"\nWriting public/data.csv ({len(rows)} rows)...")
    with open("public/data.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=cols, extrasaction="ignore")
        w.writeheader(); w.writerows(rows)

    print(f"Writing public/photos.csv ({len(people)} people)...")
    with open("public/photos.csv", "w", newline="", encoding="utf-8") as f:
        w = csv.DictWriter(f, fieldnames=["Name", "Photo URL"])
        w.writeheader()
        for info in people.values(): w.writerow(info)

    print(f"\nDone! {len(rows)} songs, {len(people)} people.")

if __name__ == "__main__": sync()
