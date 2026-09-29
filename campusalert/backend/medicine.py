"""Pharmacy stock. Everyone logged in can read; only the `pharmacy` role can change stock or the log."""
import time
from flask import jsonify, request, g
from firebase_service import fs, DESC

meds, logs = fs.collection("medicines"), fs.collection("medicine_log")
def _day(n): return time.strftime("%Y-%m-%d", time.localtime(time.time() + n * 86400))
def _status(n): return "out" if n <= 0 else "low" if n <= 10 else "available"
def _date(v):
    v = (v or "").strip()
    if not v: return None
    time.strptime(v, "%Y-%m-%d"); return v                 # ValueError if malformed
def _int(v):
    v = str(v if v is not None else "").strip()
    return max(0, int(v)) if v else None                    # None = "not provided"

def seed():
    if next(meds.limit(1).stream(), None): return
    for n, c, u, s, un, r in [("Paracetamol 500 mg", "Fever & pain", "Fever, headache, body pain", 150, "tablets", None),
            ("Ibuprofen 400 mg", "Pain & inflammation", "Toothache, period pain, muscle pain", 80, "tablets", None),
            ("Cetirizine 10 mg", "Allergy", "Allergy, sneezing, itching", 45, "tablets", None),
            ("ORS sachets", "Dehydration", "Loose motion, vomiting, dehydration", 60, "sachets", None),
            ("Antacid (Digene)", "Acidity", "Acidity, gas, heartburn", 35, "tablets", None),
            ("Cough syrup", "Cough & cold", "Cough, cold", 6, "bottles", _day(4)),
            ("Azithromycin 500 mg", "Antibiotic", "Bacterial infection (doctor's prescription only)", 0, "tablets", _day(3)),
            ("Omeprazole 20 mg", "Acidity & reflux", "Severe acidity, acid reflux", 0, "capsules", None),
            ("Salbutamol inhaler", "Asthma", "Asthma, breathlessness", 4, "inhalers", _day(5)),
            ("Betadine ointment", "Wound care", "Cuts, scrapes, small wounds", 25, "tubes", None),
            ("Bandages & cotton", "First aid", "Dressing wounds", 90, "packs", None)]:
        meds.add(dict(name=n, category=c, used_for=u, stock=s, unit=un, restock_date=r, last_received_qty=None,
                      last_received_at=None, updated_at=time.time()))

def register(app, need):
    seed()
    def view(d):
        m = d.to_dict(); return dict(m, id=d.id, status=_status(m["stock"]), used_for=m.get("used_for") or m.get("category", ""),
                                     last_received_qty=m.get("last_received_qty"), last_received_at=m.get("last_received_at"))
    def log(med, typ, qty, after): logs.add(dict(med=med, type=typ, qty=qty, stock_after=after, by=g.user["name"], at=time.time()))

    @app.get("/api/medicines")
    @need()
    def med_list(): return jsonify(sorted((view(d) for d in meds.stream()), key=lambda m: m["name"].lower()))

    @app.get("/api/medicines/log")
    @need("pharmacy")
    def med_log(): return jsonify([l.to_dict() for l in logs.order_by("at", direction=DESC).limit(40).stream()])

    @app.post("/api/medicines")
    @need("pharmacy")
    def med_add():
        d = request.get_json() or {}; name = (d.get("name") or "").strip()
        try: stock, rd = _int(d.get("stock")) or 0, _date(d.get("restock_date"))
        except ValueError: return jsonify(error="Stock must be a number and the date must be YYYY-MM-DD."), 400
        if not name: return jsonify(error="Medicine name is required."), 400
        cat = (d.get("category") or "General").strip()
        meds.add(dict(name=name, category=cat, used_for=(d.get("used_for") or cat).strip(), stock=stock, unit=(d.get("unit") or "tablets").strip(),
                      restock_date=None if _status(stock) == "available" else rd, last_received_qty=stock or None,
                      last_received_at=time.time() if stock else None, updated_at=time.time()))
        log(name, "added", stock, stock); return jsonify(ok=True)

    @app.post("/api/medicines/<mid>")
    @need("pharmacy")
    def med_update(mid):
        d = request.get_json() or {}; ref = meds.document(mid); s = ref.get()
        if not s.exists: return jsonify(error="Medicine not found."), 404
        m = s.to_dict(); stock, up = m["stock"], {}
        try: rec, giv, exact, rd = _int(d.get("received")), _int(d.get("given")), _int(d.get("stock")), _date(d.get("restock_date"))
        except ValueError: return jsonify(error="Quantities must be numbers and the date must be YYYY-MM-DD."), 400
        if exact is not None: stock = exact; log(m["name"], "set", exact, stock)
        if rec: stock += rec; up.update(last_received_qty=rec, last_received_at=time.time()); log(m["name"], "received", rec, stock)
        if giv: stock = max(0, stock - giv); log(m["name"], "given", giv, stock)
        if "used_for" in d and (d["used_for"] or "").strip(): up["used_for"] = d["used_for"].strip()
        up.update(stock=stock, updated_at=time.time(), restock_date=None if _status(stock) == "available" else rd)
        ref.update(up); return jsonify(ok=True)
