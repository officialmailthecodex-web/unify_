import os, json, firebase_admin
from firebase_admin import credentials, auth, firestore

HERE = os.path.dirname(os.path.abspath(__file__))

def _cred():
    raw = os.getenv("FIREBASE_CREDENTIALS_JSON")
    if raw: return credentials.Certificate(json.loads(raw))
    for p in (os.getenv("GOOGLE_APPLICATION_CREDENTIALS"),
              os.path.join(HERE, "serviceAccountKey.json"),
              os.path.join(HERE, "..", "serviceAccountKey.json")):
        if p and os.path.exists(p): return credentials.Certificate(p)
    if os.getenv("K_SERVICE"): return credentials.ApplicationDefault()   # Cloud Run
    raise SystemExit("serviceAccountKey.json nahi mili. Firebase Console > Project settings > "
                     "Service accounts > Generate new private key, aur file campusalert folder mein rakhein "
                     "(naam bilkul serviceAccountKey.json).")

if not firebase_admin._apps:
    firebase_admin.initialize_app(_cred())

fs = firestore.client()
verify_token = auth.verify_id_token
Increment, DESC = firestore.Increment, firestore.Query.DESCENDING
