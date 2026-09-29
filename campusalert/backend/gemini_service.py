import os, json, requests
from priority import CAT, ACTION, classify_rules

MODEL = os.getenv("GEMINI_MODEL", "gemini-2.5-flash")
URL = f"https://generativelanguage.googleapis.com/v1beta/models/{MODEL}:generateContent"

def _ask(prompt):
    key = os.getenv("GEMINI_API_KEY")
    if not key: return None
    try:
        r = requests.post(URL, params={"key": key}, timeout=20, json={"contents": [{"parts": [{"text": prompt}]}],
                          "generationConfig": {"responseMimeType": "application/json"}})
        r.raise_for_status()
        return json.loads(r.json()["candidates"][0]["content"]["parts"][0]["text"])
    except Exception as e:
        print("GEMINI ERROR:", repr(e)); return None

def classify(text, location="", people=1):
    """AI triage: category, short summary, severity 0-100, why, and the first action for staff. Falls back to rules."""
    cat = classify_rules(text)
    fb = dict(category=cat, summary=text[:80], severity=CAT[cat][1], reason=f"Rule-based: {CAT[cat][0]}", action=ACTION[cat], source="rules")
    prompt = ("You are the triage AI for a college campus in India. Read this complaint (English, Hindi or Hinglish) and judge how urgent it is.\n"
              f"Categories: {list(CAT)}.\nSeverity 0-100: 90-100 risk to life (fire, electric shock, medical emergency); 70-89 safety hazard or affects many people; "
              "50-69 serious disruption to daily life or health; 30-49 inconvenience; under 30 minor. "
              "Consider danger to people, how many are affected, sensitive places (hostel, lab, mess, hospital) and how fast it gets worse.\n"
              'Return JSON only: {"category":"...","summary":"max 12 words in English","severity":0,"reason":"max 15 words: why this urgency","action":"max 15 words: what staff should do first"}\n'
              f"Location: {location}\nPeople affected: {people}\nComplaint: {text}")
    d = _ask(prompt)
    if not d or d.get("category") not in CAT: return fb
    try: sev = max(0, min(100, int(d.get("severity"))))
    except (TypeError, ValueError): sev = CAT[d["category"]][1]
    return dict(category=d["category"], summary=str(d.get("summary") or text[:80])[:120], severity=sev,
                reason=str(d.get("reason") or fb["reason"])[:160], action=str(d.get("action") or ACTION[d["category"]])[:160], source="gemini")

def brief(open_tickets):
    """AI dispatcher: which open problems to handle first and why. Falls back to the score order."""
    top = open_tickets[:5]
    fb = dict(summary=(f"{len(open_tickets)} open problem(s), {sum(t['level'] == 'critical' for t in open_tickets)} critical. Handle them in this order."
                       if open_tickets else "Nothing open right now."),
              items=[dict(id=t["id"], title=t["summary"], location=t["location"], level=t["level"], priority=t["priority"],
                          why=" · ".join(t["why"]), action=t.get("ai_action") or ACTION[t["category"]]) for t in top], source="rules")
    if len(open_tickets) < 2: return fb
    rows = [dict(id=t["id"], problem=t["summary"], place=t["location"], category=t["label"], score=t["priority"], hours_open=t["hours_open"],
                 people=t["people"] + t["me_too"], similar_reports=t["similar"]) for t in open_tickets[:8]]
    d = _ask("You are the dispatcher for campus maintenance. These open complaints are already scored. Pick the top 5 to handle first, safety before comfort, "
             'then people affected, then time open. Return JSON only: {"summary":"one plain sentence","order":[{"id":"...","why":"max 15 words"}]}\n' + json.dumps(rows))
    if not d: return fb
    byid = {t["id"]: t for t in open_tickets}; items = []
    for o in (d.get("order") or [])[:5]:
        t = byid.get(o.get("id"))
        if t: items.append(dict(id=t["id"], title=t["summary"], location=t["location"], level=t["level"], priority=t["priority"],
                                why=str(o.get("why") or "")[:160], action=t.get("ai_action") or ACTION[t["category"]]))
    return dict(summary=str(d.get("summary") or fb["summary"])[:200], items=items or fb["items"], source="gemini") if items else fb
