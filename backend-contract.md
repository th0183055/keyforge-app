# TimLock-App Backend Contract

This is the first backend shape for building side by side with the UI. The product name should remain pending until trademark clearance is done.

## Core Resources

### Shop

- `id`
- `legalName`
- `displayName`
- `licenseNumber`
- `insuranceStatus`
- `verificationStatus`
- `createdAt`

### User

- `id`
- `shopId`
- `name`
- `role`: `owner`, `technician`, `dispatcher`, `admin`
- `mfaEnabled`
- `lastActiveAt`

### Job

- `id`
- `shopId`
- `customerName`
- `serviceType`
- `targetType`: `vehicle`, `residential`, `commercial`, `safe`, `other`
- `targetDescription`
- `verificationStatus`
- `authorizationFiles`
- `status`
- `createdAt`
- `closedAt`

### AI Request

- `id`
- `jobId`
- `userId`
- `prompt`
- `response`
- `riskLevel`: `low`, `medium`, `high`, `blocked`
- `policyDecision`
- `createdAt`

## First API Routes

- `POST /api/auth/login`
- `GET /api/me`
- `GET /api/jobs`
- `POST /api/jobs`
- `GET /api/jobs/:id`
- `POST /api/jobs/:id/verification`
- `POST /api/ai`
- `GET /api/vehicles?q=`
- `GET /api/audit-log?jobId=`

## AI Policy Baseline

The assistant should help with lawful professional workflows:

- Job intake
- Customer communication
- Parts and tool preparation
- Quote notes
- Technician checklists
- Vehicle reference organization
- Documentation and audit summaries

The assistant should block or redirect requests for:

- Unauthorized entry
- Bypass instructions outside a verified job
- Theft, evasion, or concealment
- Destructive methods without lawful proof and professional context
- Requests that ask to hide work from the customer, property owner, or authorities

## MVP Build Order

1. Job intake and job board
2. AI request endpoint with policy logging
3. Local auth and shop setup
4. Verification records and file attachments
5. Vehicle reference workspace
6. Subscription and verified locksmith onboarding
