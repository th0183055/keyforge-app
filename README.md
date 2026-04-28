# Premier Locksmith AI

A fresh-start prototype for a professional AI locksmith platform.

The app is intentionally brand-neutral while the final name goes through clearance.

## Run the Prototype

```bash
npm start
```

Then open `http://127.0.0.1:4173/`.

## What Exists Now

- Clickable dashboard
- Job intake and job board backed by a local API
- AI Bench assistant route with safety refusals and audit logging
- Vehicle reference workspace
- VIN Bench with NHTSA decode, local vPIC catalog matching, and key intelligence recommendations
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
