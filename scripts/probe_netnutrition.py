"""Probe Cornell NetNutrition: walk units -> courses/menus -> items, fetch a few labels."""
import html, http.cookiejar, json, re, sys, time, urllib.parse, urllib.request

B = "https://netnutrition.dining.cornell.edu/NetNutrition/1"
OUT = sys.argv[1]
cj = http.cookiejar.CookieJar()
op = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(cj))
op.addheaders = [("User-Agent", "Mozilla/5.0 (research probe)")]


def get(path=""):
    return op.open(B + path, timeout=30).read().decode("utf-8", "replace")


def post(path, data):
    req = urllib.request.Request(B + path, data=urllib.parse.urlencode(data).encode(),
                                 headers={"X-Requested-With": "XMLHttpRequest"})
    time.sleep(0.3)  # be polite
    return op.open(req, timeout=30).read().decode("utf-8", "replace")


def panels(txt):
    try:
        return " ".join(p.get("html", "") for p in json.loads(txt).get("panels", []))
    except Exception:
        return txt


def text(s):
    t = html.unescape(re.sub(r"<[^>]+>", " | ", s))
    return re.sub(r"(\|\s*)+", "| ", re.sub(r"\s+", " ", t))


ITEM_RE = re.compile(r"getItemNutritionLabelOnClick\(event,\s*(\d+)[^)]*\)[^>]*>\s*([^<]+)<")

home = get()
units = sorted({(int(a), b.strip()) for a, b in re.findall(r"unitsSelectUnit\((\d+)\)[^>]*>\s*([^<]+)<", home)})
result = {}
for uoid, uname in units:
    get()  # reset to top
    s = panels(post("/Unit/SelectUnitFromUnitsList", {"unitOid": uoid}))
    items = {}
    menus = sorted(set(re.findall(r"menuListSelectMenu\((\d+)\)", s)))
    courses = sorted(set(re.findall(r"selectCourse\((\d+)\)", s)))
    for oid, name in ITEM_RE.findall(s):
        items[oid] = name.strip()
    for m in menus[:3]:
        ms = panels(post("/Menu/SelectMenu", {"menuOid": m}))
        for oid, name in ITEM_RE.findall(ms):
            items[oid] = name.strip()
        courses += re.findall(r"selectCourse\((\d+)\)", ms)
    for c in sorted(set(courses)):
        cs = panels(post("/Menu/SelectCourse", {"oid": c}))
        for oid, name in ITEM_RE.findall(cs):
            items[oid] = name.strip()
    result[uname] = {"unitOid": uoid, "menus": menus, "courses": sorted(set(courses)), "items": items}
    print(f"{uoid:3d} {uname:40s} menus={len(menus)} courses={len(set(courses))} items={len(items)}", flush=True)

json.dump(result, open(OUT + "/nn_items.json", "w"), indent=1)

# fetch one label in full to see the allergen/ingredient format
for uname, u in result.items():
    if u["items"]:
        oid, name = next(iter(u["items"].items()))
        get()
        post("/Unit/SelectUnitFromUnitsList", {"unitOid": u["unitOid"]})
        if u["courses"]:
            post("/Menu/SelectCourse", {"oid": u["courses"][0]})
        lab = post("/NutritionDetail/ShowItemNutritionLabel", {"detailOid": oid})
        open(OUT + "/label_sample.html", "w").write(lab)
        print("\nLABEL for", uname, "/", name, "\n", text(lab)[:2500])
        break
