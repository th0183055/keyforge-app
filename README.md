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

## Job Store and Persistent Data

Real job data should not live in Git. The app now keeps only `data/store.example.json` in the repository and creates the live store at `TIMLOCK_DATA_DIR/store.json`. Local development falls back to `data/store.json`, which is ignored.

For Render production, `TIMLOCK_DATA_DIR` should point at the mounted persistent-data directory. The included `render.yaml` uses `/var/data/timlock` and attaches a `timlock-data` disk. Render persistent disks require a paid web service; Free web services have an ephemeral filesystem, so saved jobs can disappear on restart or redeploy if no external storage is attached.

Before moving an existing live app to the persistent store, export a backup from the app. After the new service/disk is live, import that backup so the disk-backed `store.json` becomes the source of truth.

Owners can check this inside **Settings -> Backup & Sync**. That panel shows the live job store mode, Proof Vault attachment mode, AI memory counts, and warnings when the app is still using repo-local or server-local storage. Use **Export Server Backup** before changing hosting storage, then **Import Server Backup** after the new storage is live.

## What Exists Now

- Clickable dashboard
- Job intake and job board backed by a local API
- AI Bench assistant route with safety refusals and audit logging
- Vehicle reference workspace
- VIN lookup with NHTSA decode, local vPIC catalog matching, key reference guidance, and worked-job learning
- Part History, Proof Vault, and programmer coverage proof from saved jobs
- Proof Vault attachments with Cloudflare R2 support and browser/local fallback
- Code Desk starter depth-space cards, automotive year/make/model baseline, and authorized CSV/JSON code import
- Trust Center
- Initial backend resource and route contract

## Proof Vault Attachments

Attachments work locally without extra setup. For Render production, set Cloudflare R2 variables so photos and documents survive deploys and follow users across devices:

- `R2_ACCOUNT_ID`
- `R2_BUCKET`
- `R2_ACCESS_KEY_ID`
- `R2_SECRET_ACCESS_KEY`
- Optional: `R2_PUBLIC_BASE_URL`
- Optional: `TIMLOCK_ATTACHMENT_MAX_BYTES`
- Optional: `TIMLOCK_PRIVATE_PROOF_FILES=true` to force proof previews through the app server instead of a public R2 URL
- Optional: `R2_PUBLIC_PREVIEW=false` to keep R2 private while still using R2 object storage

Server backups include Proof Vault attachment metadata, but they do not embed raw photo/PDF bytes. Use Cloudflare R2 for durable cross-device proof files, or keep a Render persistent disk attached for server-local files.

Use **Proof Vault -> Migrate Local Proof** or **Settings -> Backup & Sync -> Migrate Browser Proof** after switching to server/R2 storage. That moves browser-local photos/docs into the configured backend. Use **Run Storage Test** to verify a write/read/delete round-trip against the active storage path.

## Code Desk Imports

Code Desk includes starter residential cards and automotive templates for common families such as Chrysler Y164, Ford H92/H94, GM HU100, Toyota/Lexus, Honda/Acura, Nissan/Infiniti, Hyundai/Kia, Mazda, Subaru, VW/Audi, and European high-security inserts. Import only authorized code records and exact depth-space cards you are allowed to use.

The automotive baseline view is generated from the local programming reference plus the local vPIC identity catalog. It shows year/make/model coverage, likely key-system family, programming/security clues, import readiness, and saved-job proof coverage. It does not bundle proprietary code-series data; authorized code records and depth-space cards can be imported when you have the right to use them.

Code CSV/TSV/JSON imports can include columns such as `system`, `keyway`, `code`, `bitting`, `vehicle`, `partNumber`, `source`, and `notes`.

Depth-space card imports can include `type=system`, `name`, `category`, `family`, `blanks`, `spaces`, `depths`, `cuts`, `stop`, `macs`, `source`, and `notes`. Depths can be JSON or pairs like `1=.329,2=.306,3=.283`.

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
