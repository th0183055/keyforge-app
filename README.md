# TimLock-App

A field-first locksmith reference app for VIN/YMM lookup, key choices, Lishi/keyway guidance, programmer coverage, and shop-proven job memory.

## Run the Prototype

```bash
npm start
```

Then open `http://127.0.0.1:4173/`.

## Deploy on Render

This app must be deployed as a Render **Web Service**, not a Static Site.

Use these settings:

- Runtime: `Node`
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/`

The included `render.yaml` is a Render Blueprint for the same setup. If the deployed app shows `404` for `/api/vin/...`, the service was created as a Static Site or is pointing at the wrong Render service URL.

## What Exists Now

- Clickable dashboard
- Job intake and job board backed by a local API
- AI Bench assistant route with safety refusals and audit logging
- Vehicle reference workspace
- VIN lookup with NHTSA decode, local vPIC catalog matching, key reference guidance, and worked-job learning
- Trust Center
- Initial backend resource and route contract

## Build Local Vehicle Catalogs

Build VIN references from known jobs/calendar VINs:

```bash
npm run build:vin-reference
```

Build a local vPIC year/make/model application catalog:

```bash
npm run sync:vpic
```

Focused sync example:

```bash
$env:MAKES='Ford,Toyota,Honda'; $env:START_YEAR='2020'; $env:END_YEAR='2026'; npm run sync:vpic
```

The vPIC catalog identifies vehicle applications. Locksmith-specific data such as FCC, keyway, blade, programmer coverage, and supplier part numbers still needs verified locksmith sourcing.

## Next Build Step

Upgrade the local backend into a production-ready service:

- SQLite/Postgres data model
- Auth and shop verification
- OpenAI-backed AI endpoint with audit logging
