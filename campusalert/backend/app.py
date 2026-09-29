import os, re, time, urllib.parse
from functools import wraps
from flask import Flask, jsonify, request, g
import priority as P, gemini_service
from firebase_service import fs, verify_token, Increment

app = Flask(__name__, static_folder="../frontend", static_url_path="")
STAFF_EMAILS = {e.strip().lower() for e in os.getenv("STAFF_EMAILS", "").split(",") if e.strip()}
WARDENS = {}   # optional: {"Hostel C": "Dr. Name, Ext 123"}; otherwise "<hostel> warden desk" is shown
PHARMACY_EMAILS = {e.strip().lower() for e in os.getenv("PHARMACY_EMAILS", "").split(",") if e.strip()}
users, tickets_c = fs.collection("users"), fs.collection("tickets")

def need(*roles, profile=True):
    """Every API call carries a Firebase ID token; we verify it server-side and load the user's role."""
    def deco(f):
        @wraps(f)
        def w(*a, **k):
            h = request.headers.get("Authorization", "")
            if not h.startswith("Bearer "): return jsonify(error="Please log in."), 401
            try: tok = verify_token(h[7:])
            except Exception as e:
                print("TOKEN ERROR:", repr(e))
                return jsonify(error="Session expired. Please log in again."), 401
            g.uid, g.email = tok["uid"], (tok.get("email") or "").lower()
            if profile:
                s = users.document(g.uid).get()
                if not s.exists: return jsonify(error="Profile not found."), 404
                g.user = s.to_dict()
                if g.user.get("role") == "day_scholar": g.user["role"] = "hosteler"    # legacy accounts
                if roles and g.user["role"] not in roles: return jsonify(error="Not allowed for your role."), 403
            return f(*a, **k)
        return w
    return deco

def init():
    if not next(tickets_c.limit(1).stream(), None):
        now = time.time()
        seed = [("AC not cooling in room, too hot at night", "Hostel A - Room 214", 2, 30), ("AC making noise and no cooling", "Hostel A - Room 118", 2, 20),
                ("AC dripping water and not cooling", "Hostel A - Room 305", 3, 10), ("Pipe leaking near washroom, water on floor", "Hostel B - Floor 2", 4, 52),
                ("Wifi keeps disconnecting in reading hall", "Library", 12, 5), ("Bench broken", "Block C - Class 12", 1, 3),
                ("Sparking from switchboard in lab", "Block C - Lab 3", 6, 2)]
        for t, l, p, h in seed:
            tickets_c.add(dict(user_id="seed", text=t, summary=t, category=P.classify_rules(t), location=l, people=p,
                               me_too=0, status="open", created_at=now - h * 3600, resolved_at=None))

def views(rows):
    now = time.time(); rows = [dict(r.to_dict(), id=r.id) for r in rows]; out = []
    for t in rows:
        dup = sum(1 for o in rows if o["id"] != t["id"] and o["status"] != "resolved" and o["category"] == t["category"]
                  and P.block(o["location"]) == P.block(t["location"]))
        hrs = ((t["resolved_at"] or now) - t["created_at"]) / 3600
        p = P.score(t, now, dup); c = P.CAT[t["category"]]
        out.append(dict(t, why=P.explain(t, now, dup), priority=p, level=P.level(p), label=c[0], hours_open=round(hrs, 1), similar=dup,
                        cost_of_delay=P.delay_cost(t["category"], hrs), cost_if_ignored=c[3],
                        emergency=t["category"] == "medical" or bool(re.search(P.EMERGENCY, t["text"], re.I)),
                        map="https://www.google.com/maps/search/?api=1&query=" + urllib.parse.quote(t["location"] + " SRM University AP")))
    return sorted(out, key=lambda x: (x["status"] == "resolved", -x["priority"]))

def all_views(): return views(tickets_c.stream())

@app.get("/")
def home(): return app.send_static_file("index.html")

@app.post("/api/profile")
@need(profile=False)
def profile():
    d = request.get_json() or {}
    name, sid = (d.get("name") or "").strip(), (d.get("sid") or "").strip().upper()
    if not name or not sid: return jsonify(error="Name and ID are required."), 400
    if users.document(g.uid).get().exists: return jsonify(error="Profile already exists."), 409
    role = "staff" if g.email in STAFF_EMAILS else "pharmacy" if g.email in PHARMACY_EMAILS else "hosteler"   # staff/pharmacy can never be self-selected
    extra = {k: (d.get(k) or "").strip()[:60] for k in ("hostel", "room", "program")}
    users.document(g.uid).set(dict(name=name, sid=sid, email=g.email, role=role, points=0, **extra))
    return jsonify(role=role)

@app.get("/api/me")
@need()
def me(): return jsonify(dict(g.user, uid=g.uid, warden=WARDENS.get(g.user.get("hostel") or "", "")))

@app.post("/api/me/details")
@need()
def my_details():
    d = request.get_json() or {}
    users.document(g.uid).update({k: (d.get(k) or "").strip()[:60] for k in ("hostel", "room", "program")}); return jsonify(ok=True)

@app.get("/api/dashboard")
@need()
def dashboard():
    vs = all_views(); open_ = [v for v in vs if v["status"] != "resolved"]; blocks = {}
    for v in open_:
        b = v["location"].split("-")[0].strip(); e = blocks.setdefault(b, dict(block=b, open=0, top=0))
        e["open"] += 1; e["top"] = max(e["top"], v["priority"])
    for e in blocks.values(): e["level"] = P.level(e["top"])
    studs = sorted((u.to_dict() for u in users.stream() if u.get("role") not in ("staff", "pharmacy")), key=lambda u: -u["points"])[:3]
    health = 100 - min(90, round(sum(v["priority"] for v in open_) / 10))
    return jsonify(health=health, mine=[v for v in vs if v["user_id"] == g.uid], urgent=open_[:5], open=len(open_),
                   critical=sum(v["level"] == "critical" for v in open_), resolved=len(vs) - len(open_),
                   blocks=sorted(blocks.values(), key=lambda e: -e["top"]),
                   leaderboard=[dict(name=u["name"], points=u["points"]) for u in studs])

@app.get("/api/tickets")
@need()
def tickets(): return jsonify(all_views())

@app.post("/api/tickets")
@need()
def create():
    d = request.get_json() or {}
    text, loc = (d.get("text") or "").strip(), (d.get("location") or "").strip()
    if not text or not loc: return jsonify(error="Please describe the problem and its location."), 400
    try: people = max(1, int(d.get("people") or 1))
    except ValueError: people = 1
    cl = gemini_service.classify(text, loc, people)
    ref = tickets_c.document()
    ref.set(dict(user_id=g.uid, text=text, summary=cl["summary"], category=cl["category"], location=loc, people=people,
                 me_too=0, status="open", created_at=time.time(), resolved_at=None,
                 ai_severity=cl["severity"], ai_reason=cl["reason"], ai_action=cl["action"], ai_source=cl["source"]))
    users.document(g.uid).update(points=Increment(10))
    t = next(v for v in all_views() if v["id"] == ref.id)
    return jsonify(dict(t, classified_by=cl["source"]))

@app.post("/api/tickets/<i>/metoo")
@need()
def metoo(i):
    ref = tickets_c.document(i); v = ref.collection("votes").document(g.uid)
    if ref.get().exists and not v.get().exists:
        v.set(dict(at=time.time())); ref.update(me_too=Increment(1)); users.document(g.uid).update(points=Increment(2))
    return jsonify(ok=True)

@app.post("/api/tickets/<i>/status")
@need("staff")
def status(i):
    s = (request.get_json() or {}).get("status")
    if s not in ("open", "in_progress", "resolved"): return jsonify(error="bad status"), 400
    tickets_c.document(i).update(status=s, resolved_at=time.time() if s == "resolved" else None)
    return jsonify(ok=True)

_brief = dict(at=0, data=None)
@app.get("/api/ai/brief")
@need("staff")
def ai_brief():
    if not request.args.get("refresh") and _brief["data"] and time.time() - _brief["at"] < 300: return jsonify(_brief["data"])
    _brief.update(at=time.time(), data=gemini_service.brief([v for v in all_views() if v["status"] != "resolved"]))
    return jsonify(_brief["data"])

@app.get("/api/insights")
@need()
def insights():
    vs = all_views(); week = time.time() - 7 * 86400; groups = {}
    for v in vs:
        if v["status"] != "resolved" and v["created_at"] > week:
            groups.setdefault((v["category"], P.block(v["location"])), []).append(v)
    warnings = [dict(title=f'{len(g_)} {P.CAT[c][0]} reports in {g_[0]["location"].split("-")[0].strip()}',
                     detail=f'This looks like a pattern, not a one-off. Likely cause: {P.PREDICT.get(c, "a shared fault")}. Inspect the whole block, not just one room.')
                for (c, b), g_ in groups.items() if len(g_) >= 3]
    open_ = [v for v in vs if v["status"] != "resolved"]
    saved = sum(P.CAT[v["category"]][3] - P.CAT[v["category"]][2] for v in vs
                if v["status"] == "resolved" and v["hours_open"] <= P.CAT[v["category"]][4])
    return jsonify(warnings=warnings, open=len(open_), critical=sum(v["level"] == "critical" for v in open_),
                   at_risk=sum(P.CAT[v["category"]][3] for v in open_ if v["category"] != "medical"), saved=saved)

import medicine; medicine.register(app, need)
init()
if __name__ == "__main__": app.run(host="0.0.0.0", port=int(os.getenv("PORT", 8080)), debug=True)
