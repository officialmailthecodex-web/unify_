"""Rules that decide how urgent a complaint is, and how much delay will cost."""
import re

# category: (base score, cost_now Rs, cost_if_ignored Rs, hours until it starts getting worse)
CAT = {
 "medical":     ("Medical emergency", 100, 0, 0, 0.5),
 "electrical":  ("Electrical / fire risk", 88, 800, 60000, 6),
 "water_leak":  ("Pipe / water leak", 72, 500, 25000, 48),
 "ac":          ("AC / cooling", 62, 1500, 18000, 72),
 "internet":    ("Wi-Fi / network", 40, 300, 5000, 72),
 "lighting":    ("Lighting", 32, 150, 2000, 120),
 "cleanliness": ("Cleanliness", 24, 200, 3000, 96),
 "furniture":   ("Furniture / doors", 18, 300, 1500, 168),
 "other":       ("Other", 25, 200, 1000, 120)}
PATTERNS = [("medical", r"medical|doctor|ambulance|faint|unconscious|bleed|chest pain|fever|injur|seizure|asthma|allergic"),
 ("electrical", r"spark|short.?circuit|shock|wire|burning smell|fire|smoke|socket"),
 ("ac", r"\bac\b|a\.c|air.?condition|cooling"),
 ("water_leak", r"leak|pipe|drip|flood|seepage|tap|overflow|water ?logging"),
 ("internet", r"wi-?fi|internet|network|router"),
 ("lighting", r"light|bulb|tube|dark"),
 ("cleanliness", r"dirty|garbage|clean|smell|washroom|toilet|mosquito"),
 ("furniture", r"bench|chair|desk|door|window|table|bed")]
PREDICT = {"ac": "gas leak or compressor fault", "water_leak": "hidden pipe damage in the wall",
           "electrical": "faulty wiring on that circuit", "internet": "router or switch failure",
           "lighting": "faulty wiring or power supply", "cleanliness": "a drainage or pest problem"}
SENSITIVE = r"hostel|lab|hospital|mess|kitchen"
ACTION = {"medical": "Send first-aid help and call the ambulance now", "electrical": "Cut power to that circuit and send an electrician immediately",
          "water_leak": "Close the water valve and send a plumber", "ac": "Send an AC technician to check gas and compressor",
          "internet": "Check the router or switch for that area", "lighting": "Replace the bulb or check the wiring",
          "cleanliness": "Send housekeeping to clean the area", "furniture": "Send a carpenter to repair it", "other": "Inspect and assign to the right team"}
EMERGENCY = r"fire|smoke|gas leak|spark|unconscious|bleed|chest pain|not breathing|seizure|faint"

def classify_rules(text):
    for cat, rx in PATTERNS:
        if re.search(rx, text, re.I): return cat
    return "other"

def block(loc): return loc.split("-")[0].strip().lower()

def level(p): return "critical" if p >= 85 else "high" if p >= 60 else "medium" if p >= 35 else "low"

def score(t, now, dup):
    label, base, _, _, window = CAT[t["category"]]
    core, ai = base, t.get("ai_severity")
    if ai is not None:                                             # AI judgement leads, rules anchor it
        core = round(0.4 * base + 0.6 * ai)
        if base >= 88: core = max(core, base)                      # guardrail: AI can never downgrade fire, shock or medical
    s = core + min(15, (t["people"] + t["me_too"]) // 4)          # how many people are affected
    s += 8 if re.search(SENSITIVE, t["location"], re.I) else 0
    hrs = (now - t["created_at"]) / 3600
    if t["status"] != "resolved":
        s += min(20, hrs / window * 5)                                # small problems grow with time
        s += min(24, 8 * dup)                                         # repeated reports = bigger issue
    return min(100, round(s))

def delay_cost(cat, hrs):
    _, _, now_c, later_c, window = CAT[cat]
    return round(now_c + (later_c - now_c) * min(1, hrs / (window * 4)))

def explain(t, now, dup):
    """Plain-language reasons behind a score, shown to students and staff."""
    label, _, _, _, window = CAT[t["category"]]; out = [label]
    if t.get("ai_severity") is not None: out.append(f'AI severity {t["ai_severity"]}/100')
    n = t["people"] + t["me_too"]
    if n > 1: out.append(f"{n} people affected")
    if re.search(SENSITIVE, t["location"], re.I): out.append("sensitive place")
    hrs = ((t.get("resolved_at") or now) - t["created_at"]) / 3600
    if t["status"] != "resolved" and hrs >= window / 2: out.append(f"open {round(hrs)}h")
    if dup and t["status"] != "resolved": out.append(f"{dup} similar reports")
    return out
