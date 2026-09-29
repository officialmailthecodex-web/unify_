# UNIFY-CAMPUS(Firebase edition)
Firebase Authentication (email/password) + Firestore + Flask. Roles: **hosteler**, **staff** (queue + AI briefing), **pharmacy** (stock desk). Complaints get an AI urgency score (Gemini) blended with transparent rules.

## Firebase setup (once)
1. console.firebase.google.com > Create project.
2. Build > Authentication > Get started > enable **Email/Password**. (Authorized domains: add your deployed domain.)
3. Build > Firestore Database > Create (production mode) > Rules tab > paste `firestore.rules` > Publish.
4. Project settings > General > Your apps > Web (`</>`) > copy config into `frontend/firebase-config.js`. Set campus gate lat/lng there too.
5. Project settings > Service accounts > Generate new private key > save as `serviceAccountKey.json` in the project root (never commit it).
6. Copy `.env.example` to `.env`, put your staff emails in `STAFF_EMAILS`.

## Run
cd backend && pip install -r requirements.txt
export GOOGLE_APPLICATION_CREDENTIALS=../serviceAccountKey.json STAFF_EMAILS=you@srmap.edu.in
python app.py   # http://localhost:8080

## Deploy (Cloud Run)
gcloud run deploy campusalert --source . --set-env-vars STAFF_EMAILS=...,GEMINI_API_KEY=...
On Cloud Run the service account is picked up automatically; no key file needed.
