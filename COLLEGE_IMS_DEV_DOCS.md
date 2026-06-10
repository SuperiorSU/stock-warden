# College Inventory Management System — Developer Documentation

**Version:** 1.0.0  
**Stack:** Next.js 14 (App Router) · PostgreSQL · Prisma ORM · Redis · NextAuth.js  
**Last Updated:** 2026-05-18

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Architecture Decisions](#2-architecture-decisions)
3. [User Flow Diagrams](#3-user-flow-diagrams)
4. [Data Models (Prisma Schema)](#4-data-models-prisma-schema)
5. [API Endpoints](#5-api-endpoints)
6. [RBAC — Role-Based Access Control](#6-rbac--role-based-access-control)
7. [End-to-End Security Hardening](#7-end-to-end-security-hardening)
8. [Caching Policies](#8-caching-policies)
9. [Rate Limiting & Brute-Force Prevention](#9-rate-limiting--brute-force-prevention)
10. [Response Compression & Optimization](#10-response-compression--optimization)
11. [API Pagination & Cursor Design](#11-api-pagination--cursor-design)
12. [PDF Invoice Generation](#12-pdf-invoice-generation)
13. [Notification System (Platform + Email)](#13-notification-system-platform--email)
14. [Edge Case Handling — Backend](#14-edge-case-handling--backend)
15. [Edge Case Handling — Frontend](#15-edge-case-handling--frontend)
16. [Frontend UI/UX Design System](#16-frontend-uiux-design-system)
17. [Environment Variables](#17-environment-variables)
18. [Deployment Checklist](#18-deployment-checklist)

---

## 1. System Overview

The College Inventory Management System (CIMS) is a multi-tenant, role-partitioned platform that manages physical college inventory — stationery, lab equipment, department consumables, etc. — across academic session years.

### Roles

| Role | Scope |
|------|-------|
| `USER` | Department or individual employee — browses stock, raises requests, tracks status, downloads invoices |
| `ADMIN` | Manages inventory, approves/rejects requests, views per-item analytics |
| `SUPER_ADMIN` | Platform-wide analytics across all sessions, items, users, and admins |

### Key Constraints

- Requests are **session-year scoped** (e.g., 2025–2026).
- A rejected request **never creates a new request on re-submission**; it re-uses the same `requestId` and transitions back to `REQUESTED`.
- Stock quantities are **decremented on approval** and **restored on cancellation or rejection**.
- PDFs are generated **server-side** at the time of approval and stored; they are never regenerated on-demand from user action.
- `SUPER_ADMIN` cannot approve/reject requests — read-only analytics only.

---

## 2. Architecture Decisions

```
┌─────────────────────────────────────────────┐
│              Next.js 14 App Router           │
│                                              │
│  ┌──────────────┐    ┌─────────────────────┐ │
│  │  Frontend    │    │   API Routes (/api)  │ │
│  │  (RSC + CC)  │◄──►│   Route Handlers    │ │
│  └──────────────┘    └─────────┬───────────┘ │
└────────────────────────────────┼────────────┘
                                 │
              ┌──────────────────┼──────────────────┐
              │                  │                  │
     ┌────────▼──────┐  ┌────────▼──────┐  ┌───────▼──────┐
     │  PostgreSQL   │  │    Redis       │  │    S3/R2     │
     │  (Prisma ORM) │  │  (Cache +      │  │  (Images +   │
     │               │  │   Rate Limit)  │  │   PDFs)      │
     └───────────────┘  └───────────────┘  └──────────────┘
              │
     ┌────────▼──────┐  ┌───────────────┐
     │  Resend/SMTP  │  │  Web Push /   │
     │  (Email)      │  │  Notifications│
     └───────────────┘  └───────────────┘
```

### Why Next.js API Routes (not a separate Express/Fastify server)?

- Unified deployment — one Vercel/container unit.
- RSC streaming for data-heavy dashboards.
- Middleware at the edge for auth guards before routes even run.
- Server Actions for forms reduce round-trips.

### Why Prisma + PostgreSQL?

- Strong type safety via generated client.
- PostgreSQL's JSONB for metadata, full-text search for item lookup.
- Row-level security (RLS) as a second enforcement layer.

### Why Redis?

- Token blacklisting for logout.
- Rate-limit counters per IP/user.
- Short-lived caches for dashboard aggregations.
- Pub/Sub for real-time notification broadcasting.

---

## 3. User Flow Diagrams

### 3.1 USER — Stock Request Lifecycle

```
[User visits /inventory]
        │
        ▼
[Browse items → sees quantity or "Out of Stock"]
        │
        ├─── Item IN stock ──────────────────────────────────────────┐
        │                                                            │
        ├─── Item OUT OF STOCK                                       │
        │         │                                                  │
        │         ▼                                                  │
        │   [User clicks "Notify Admin"]                             │
        │         │                                                  │
        │         ▼                                                  │
        │   [StockAlert created → platform + email to admin]         │
        │                                                            │
        ◄────────────────────────────────────────────────────────────┘
        │
        ▼
[User selects item(s) + quantity → "Submit Request"]
        │
        ▼
[POST /api/user/requests → status: REQUESTED]
        │
        ▼
[Admin notified (platform + email)]
        │
        ▼
[Admin reviews → PATCH /api/admin/requests/:id]
        │
        ├─── APPROVE ────────────────────────────────────────────────┐
        │                                                            │
        ├─── REJECT ─────────────────────────────────────────────────┤
        │         │                                                  │
        │         ▼                                                  │
        │   [User notified → can "Re-request"]                       │
        │         │                                                  │
        │         ▼                                                  │
        │   [PATCH /api/user/requests/:id/re-request]               │
        │   [Same requestId, status → REQUESTED again]              │
        │                                                            │
        ├─── PENDING (held for review) ──────────────────────────────┤
        │                                                            │
        ◄────────────────────────────────────────────────────────────┘
        │
        ▼ (on APPROVE)
[Stock decremented → PDF Invoice generated → stored in S3]
        │
        ▼
[User notified → invoice available on /requests/:id]
        │
        ▼
[User can download PDF invoice]

[User can CANCEL request if status is REQUESTED or PENDING]
        │
        ▼
[PATCH /api/user/requests/:id/cancel → stock restored if was PENDING]
```

### 3.2 ADMIN — Inventory Management Flow

```
[Admin → /admin/inventory]
        │
        ├─── Add Item → POST /api/admin/inventory
        │         • Tied to current sessionYear
        │
        ├─── Edit Item → PUT /api/admin/inventory/:id
        │         • Updates name, image, quantity, description
        │
        ├─── Mark Stale → PATCH /api/admin/inventory/:id/stale
        │         • Item visible to admin but hidden from USER catalog
        │         • Stock carry-over logic recorded in StockHistory
        │
        └─── View Requests with Filters → GET /api/admin/requests
                  • date range (calendar picker)
                  • status
                  • department
                  • item
```

### 3.3 SUPER_ADMIN — Analytics Flow

```
[Super Admin → /super-admin/analytics]
        │
        ├─── Platform Overview (yearly/quarterly/monthly)
        │         GET /api/super-admin/stats/overview
        │
        ├─── Per-Item Deep Dive
        │         GET /api/super-admin/stats/items/:id
        │         • total requested, approved, rejected
        │         • usage over time (chart-ready series)
        │
        └─── User↔Admin request chain stats
                  GET /api/super-admin/stats/requests
                  • grouped by admin, by department, by item
```

---

## 4. Data Models (Prisma Schema)

```prisma
// prisma/schema.prisma

generator client {
  provider = "prisma-client-js"
}

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}

// ─────────────────────────────────────────────
// ENUMS
// ─────────────────────────────────────────────

enum Role {
  USER
  ADMIN
  SUPER_ADMIN
}

enum RequestStatus {
  REQUESTED
  PENDING
  APPROVED
  REJECTED
  CANCELLED
}

enum StockChangeType {
  ADDED
  FULFILLED       // on request approval
  RESTORED        // on cancellation / rejection of approved
  ADJUSTED        // manual correction
  STALE_MARKED
  STALE_REMOVED
}

enum NotificationType {
  REQUEST_CREATED
  REQUEST_APPROVED
  REQUEST_REJECTED
  REQUEST_CANCELLED
  REQUEST_PENDING
  STOCK_ALERT
  STOCK_REPLENISHED
  SYSTEM
}

// ─────────────────────────────────────────────
// USER
// ─────────────────────────────────────────────

model User {
  id              String         @id @default(uuid())
  email           String         @unique
  name            String
  employeeId      String?        @unique
  department      String?
  designation     String?
  phoneNumber     String?
  avatarUrl       String?
  role            Role           @default(USER)
  isActive        Boolean        @default(true)
  passwordHash    String
  lastLoginAt     DateTime?
  createdAt       DateTime       @default(now())
  updatedAt       DateTime       @updatedAt

  requests        Request[]
  notifications   Notification[]
  sessions        UserSession[]
  loginAttempts   LoginAttempt[]
  stockAlerts     StockAlert[]
  auditLogs       AuditLog[]

  @@index([email])
  @@index([role])
  @@index([department])
}

// ─────────────────────────────────────────────
// SESSION (JWT refresh token store)
// ─────────────────────────────────────────────

model UserSession {
  id           String   @id @default(uuid())
  userId       String
  user         User     @relation(fields: [userId], references: [id], onDelete: Cascade)
  refreshToken String   @unique
  ipAddress    String?
  userAgent    String?
  expiresAt    DateTime
  createdAt    DateTime @default(now())

  @@index([userId])
  @@index([refreshToken])
}

// ─────────────────────────────────────────────
// INVENTORY ITEM
// ─────────────────────────────────────────────

model InventoryItem {
  id               String          @id @default(uuid())
  name             String
  slug             String          @unique  // URL-safe identifier, auto-derived
  description      String?
  imageUrl         String?
  category         String?
  unit             String          // "pieces" | "kg" | "reams" | "boxes" etc.
  totalQuantity    Int             @default(0)
  availableQty     Int             @default(0)
  sessionYear      Int             // e.g. 2026
  isActive         Boolean         @default(true)
  isStale          Boolean         @default(false)
  staleMarkedAt    DateTime?
  staleMarkedBy    String?         // admin userId
  createdBy        String          // admin userId
  createdAt        DateTime        @default(now())
  updatedAt        DateTime        @updatedAt

  requestItems     RequestItem[]
  stockAlerts      StockAlert[]
  stockHistory     StockHistory[]

  @@index([sessionYear])
  @@index([category])
  @@index([isActive, isStale])
  @@index([name])         // for full-text search via pg_trgm
}

// ─────────────────────────────────────────────
// REQUEST (parent)
// ─────────────────────────────────────────────

model Request {
  id              String        @id @default(uuid())
  userId          String
  user            User          @relation(fields: [userId], references: [id])
  status          RequestStatus @default(REQUESTED)
  notes           String?       // user's note
  adminId         String?       // last admin who acted
  adminNotes      String?       // admin's remark on approval/rejection
  invoiceUrl      String?       // S3 PDF key
  invoiceNumber   String?       @unique  // e.g. "CIMS-2026-000142"
  sessionYear     Int
  createdAt       DateTime      @default(now())
  updatedAt       DateTime      @updatedAt
  processedAt     DateTime?     // when approved/rejected
  cancelledAt     DateTime?

  items           RequestItem[]
  statusHistory   RequestStatusHistory[]
  notifications   Notification[]

  @@index([userId])
  @@index([status])
  @@index([sessionYear])
  @@index([adminId])
  @@index([createdAt])
}

// ─────────────────────────────────────────────
// REQUEST ITEM (line items)
// ─────────────────────────────────────────────

model RequestItem {
  id           String        @id @default(uuid())
  requestId    String
  request      Request       @relation(fields: [requestId], references: [id], onDelete: Cascade)
  itemId       String
  item         InventoryItem @relation(fields: [itemId], references: [id])
  quantityReq  Int           // requested
  quantityFul  Int?          // fulfilled (may differ if partial — future feature)
  createdAt    DateTime      @default(now())

  @@index([requestId])
  @@index([itemId])
}

// ─────────────────────────────────────────────
// REQUEST STATUS HISTORY (audit trail)
// ─────────────────────────────────────────────

model RequestStatusHistory {
  id          String        @id @default(uuid())
  requestId   String
  request     Request       @relation(fields: [requestId], references: [id], onDelete: Cascade)
  fromStatus  RequestStatus?
  toStatus    RequestStatus
  changedBy   String        // userId
  notes       String?
  createdAt   DateTime      @default(now())

  @@index([requestId])
}

// ─────────────────────────────────────────────
// STOCK ALERT (out-of-stock notifications)
// ─────────────────────────────────────────────

model StockAlert {
  id         String        @id @default(uuid())
  itemId     String
  item       InventoryItem @relation(fields: [itemId], references: [id])
  userId     String
  user       User          @relation(fields: [userId], references: [id])
  message    String?
  isRead     Boolean       @default(false)
  resolvedAt DateTime?     // set when stock replenished
  createdAt  DateTime      @default(now())

  @@index([itemId])
  @@index([userId])
  @@index([isRead])
}

// ─────────────────────────────────────────────
// STOCK HISTORY (audit trail for quantity changes)
// ─────────────────────────────────────────────

model StockHistory {
  id           String          @id @default(uuid())
  itemId       String
  item         InventoryItem   @relation(fields: [itemId], references: [id])
  changeType   StockChangeType
  quantityDelta Int            // positive = added, negative = removed
  quantityAfter Int            // snapshot of availableQty after change
  changedBy    String          // userId
  requestId    String?         // linked if change was from request
  notes        String?
  createdAt    DateTime        @default(now())

  @@index([itemId])
  @@index([createdAt])
}

// ─────────────────────────────────────────────
// NOTIFICATION
// ─────────────────────────────────────────────

model Notification {
  id          String           @id @default(uuid())
  userId      String
  user        User             @relation(fields: [userId], references: [id])
  requestId   String?
  request     Request?         @relation(fields: [requestId], references: [id])
  type        NotificationType
  title       String
  message     String
  isRead      Boolean          @default(false)
  emailSent   Boolean          @default(false)
  emailSentAt DateTime?
  createdAt   DateTime         @default(now())

  @@index([userId, isRead])
  @@index([createdAt])
}

// ─────────────────────────────────────────────
// LOGIN ATTEMPT (brute-force tracking)
// ─────────────────────────────────────────────

model LoginAttempt {
  id         String   @id @default(uuid())
  userId     String?
  user       User?    @relation(fields: [userId], references: [id])
  email      String
  ipAddress  String
  success    Boolean
  createdAt  DateTime @default(now())

  @@index([email, createdAt])
  @@index([ipAddress, createdAt])
}

// ─────────────────────────────────────────────
// AUDIT LOG
// ─────────────────────────────────────────────

model AuditLog {
  id         String   @id @default(uuid())
  userId     String
  user       User     @relation(fields: [userId], references: [id])
  action     String   // "ITEM_CREATED" | "REQUEST_APPROVED" | etc.
  entity     String   // "InventoryItem" | "Request" | etc.
  entityId   String?
  metadata   Json?    // snapshot of changed fields
  ipAddress  String?
  userAgent  String?
  createdAt  DateTime @default(now())

  @@index([userId])
  @@index([entity, entityId])
  @@index([createdAt])
}
```

### Database Indexes & Performance Notes

- `pg_trgm` extension enabled for fuzzy name search on `InventoryItem.name`.
- Composite index `(email, createdAt)` on `LoginAttempt` for O(log n) window queries.
- `(userId, isRead)` on `Notification` for unread badge counts.
- All foreign keys use `onDelete: Cascade` where child rows are owned by parent (e.g., `RequestItem → Request`).

---

## 5. API Endpoints

### Conventions

- Base path: `/api`
- Auth: `Bearer <accessToken>` in `Authorization` header.
- All responses: `Content-Type: application/json` with `Content-Encoding: gzip`.
- Error shape:
  ```json
  {
    "success": false,
    "error": {
      "code": "RESOURCE_NOT_FOUND",
      "message": "The requested item does not exist.",
      "details": {}
    }
  }
  ```
- Success shape:
  ```json
  {
    "success": true,
    "data": { ... },
    "meta": { "page": 1, "limit": 20, "total": 143, "nextCursor": "..." }
  }
  ```

---

### 5.1 Authentication

#### `POST /api/auth/login`
Authenticate user, issue access + refresh tokens.

**Rate limit:** 5 attempts / 10 min / IP+email combo (hard lock at 10).

**Body:**
```json
{
  "email": "user@college.edu",
  "password": "••••••••"
}
```

**Success 200:**
```json
{
  "success": true,
  "data": {
    "accessToken": "<JWT, 15min>",
    "user": { "id": "...", "name": "...", "role": "USER", "department": "CSE" }
  }
}
```
Refresh token is set as `HttpOnly; Secure; SameSite=Strict` cookie.

**Errors:**
- `401 INVALID_CREDENTIALS` — wrong password.
- `403 ACCOUNT_LOCKED` — too many failed attempts.
- `403 ACCOUNT_INACTIVE` — deactivated by admin.

---

#### `POST /api/auth/refresh`
Exchange valid refresh-token cookie for new access token.

**Success 200:** Returns new `accessToken`.

**Errors:**
- `401 INVALID_REFRESH_TOKEN`
- `401 SESSION_EXPIRED`

---

#### `POST /api/auth/logout`
Invalidates refresh token (deletes `UserSession` row + blacklists in Redis for remaining TTL).

---

#### `GET /api/auth/me`
Returns authenticated user profile.

---

### 5.2 User — Inventory Browsing

#### `GET /api/inventory/items`
Browse active, non-stale inventory items.

**Query params:**

| Param | Type | Description |
|-------|------|-------------|
| `q` | string | Fuzzy name search |
| `category` | string | Filter by category |
| `sessionYear` | int | Default: current year |
| `availability` | `in_stock\|out_of_stock` | Filter |
| `cursor` | string | Cursor pagination |
| `limit` | int | 1–50, default 20 |

**Response:** paginated list of `InventoryItem` (no `createdBy`, `staleMarkedBy` exposed to USER role).

---

#### `GET /api/inventory/items/:id`
Single item detail with current `availableQty`.

---

#### `POST /api/inventory/items/:id/alert`
User notifies admin that item is out of stock.

**Guards:** `availableQty === 0` must be true. Duplicate alert within 24h per user+item is rejected with `429 ALERT_ALREADY_SENT`.

**Body:**
```json
{ "message": "We need A4 paper for the exam." }
```

**Side effects:**
- Creates `StockAlert` row.
- Sends `STOCK_ALERT` notification to all ADMINs (platform + email).

---

### 5.3 User — Requests

#### `GET /api/user/requests`
User's own request history.

**Query params:** `status`, `sessionYear`, `cursor`, `limit`, `dateFrom`, `dateTo`.

---

#### `GET /api/user/requests/:id`
Single request with items, status history, and invoice URL (if approved).

---

#### `POST /api/user/requests`
Create new stock request.

**Body:**
```json
{
  "items": [
    { "itemId": "uuid", "quantity": 10 },
    { "itemId": "uuid", "quantity": 5 }
  ],
  "notes": "Required for semester lab."
}
```

**Validations:**
- Each `itemId` must be active, non-stale, and `availableQty >= requested quantity`.
- Max 10 line items per request.
- `quantity` must be ≥ 1 and ≤ 500.
- Duplicate open request for the same item set (same user, same session, `REQUESTED` or `PENDING` status) → `409 DUPLICATE_OPEN_REQUEST`.

**Side effects:**
- Creates `Request` + `RequestItem` rows.
- Creates `RequestStatusHistory` entry.
- Notifies all ADMINs.

---

#### `PATCH /api/user/requests/:id/cancel`
Cancel a request in `REQUESTED` or `PENDING` state.

**Guards:**
- Only the request owner can cancel.
- Cannot cancel `APPROVED`, `REJECTED`, or already `CANCELLED`.

**Side effects:**
- Status → `CANCELLED`.
- If was `PENDING` and stock was tentatively reserved, restore `availableQty`.
- Notification to user confirming cancellation.

---

#### `PATCH /api/user/requests/:id/re-request`
Re-submit a `REJECTED` request (no new record created).

**Guards:** Status must be `REJECTED`.

**Side effects:**
- Status → `REQUESTED`.
- `RequestStatusHistory` entry added.
- Notifies ADMINs.
- Stock availability re-validated at re-request time.

---

#### `GET /api/user/profile`
Returns user profile + stats:
```json
{
  "user": { ... },
  "stats": {
    "totalRequests": 42,
    "approvedRequests": 30,
    "pendingRequests": 3,
    "rejectedRequests": 9,
    "mostRequestedItem": { "name": "A4 Paper", "totalQty": 200 }
  }
}
```

---

#### `PUT /api/user/profile`
Update `name`, `phoneNumber`, `avatarUrl` only. Role and department not self-editable.

---

### 5.4 User — Notifications

#### `GET /api/user/notifications`
Paginated list, most recent first.

**Query:** `isRead` (bool), `cursor`, `limit`.

---

#### `PATCH /api/user/notifications/:id/read`
Mark single notification read.

---

#### `PATCH /api/user/notifications/read-all`
Mark all user notifications as read.

---

### 5.5 Admin — Request Management

#### `GET /api/admin/requests`
All requests across users.

**Query params:**

| Param | Type | Notes |
|-------|------|-------|
| `status` | enum | Filter by status |
| `userId` | uuid | Filter by user |
| `department` | string | Filter by department |
| `itemId` | uuid | Filter by requested item |
| `dateFrom` | ISO date | Calendar range start |
| `dateTo` | ISO date | Calendar range end |
| `sessionYear` | int | Default: current |
| `cursor` | string | Pagination |
| `limit` | int | Max 50 |

---

#### `GET /api/admin/requests/:id`
Full request detail including user profile, items, status history.

---

#### `PATCH /api/admin/requests/:id/approve`
Approve a `REQUESTED` or `PENDING` request.

**Body:**
```json
{ "adminNotes": "Approved for Q2 lab session." }
```

**Server-side transaction (all-or-nothing):**
1. Re-check stock availability for each item.
2. Decrement `availableQty` for each `RequestItem`.
3. Create `StockHistory` entries (type `FULFILLED`).
4. Update `Request.status = APPROVED`, `processedAt`, `adminId`.
5. Generate PDF invoice (async job queued) → store in S3 → update `invoiceUrl`.
6. Create `RequestStatusHistory` entry.
7. Notify user: platform + email with invoice link.

**Errors:**
- `409 INSUFFICIENT_STOCK` — race condition: another request consumed stock between user submission and admin approval. Returns which items are insufficient.
- `403 ALREADY_PROCESSED`

---

#### `PATCH /api/admin/requests/:id/reject`
Reject a `REQUESTED` or `PENDING` request.

**Body:**
```json
{ "adminNotes": "Exceeds quarterly budget allocation." }
```

**Side effects:** Status → `REJECTED`. User notified with reason.

---

### 5.6 Admin — Inventory Management

#### `GET /api/admin/inventory`
Full item list including stale items. Supports all USER filters plus `isStale`, `isActive`.

---

#### `POST /api/admin/inventory`
Add new inventory item (tied to current `sessionYear`).

**Body:**
```json
{
  "name": "A4 Paper Ream",
  "description": "80gsm 500 sheets",
  "category": "Stationery",
  "unit": "reams",
  "totalQuantity": 200,
  "sessionYear": 2026,
  "imageUrl": "https://cdn.../a4paper.webp"
}
```

**Validations:**
- `name` max 120 chars, no HTML.
- `totalQuantity` ≥ 1, ≤ 10000.
- `sessionYear` must be current or future year.
- Duplicate `name + sessionYear + category` → `409 DUPLICATE_ITEM`.

**Side effects:** `availableQty` set equal to `totalQuantity`. `StockHistory` entry (type `ADDED`). `AuditLog` created.

---

#### `PUT /api/admin/inventory/:id`
Update item fields. If `totalQuantity` changes, delta is computed and `StockHistory` entry created (type `ADJUSTED`).

**Body (all optional):**
```json
{
  "name": "...",
  "description": "...",
  "imageUrl": "...",
  "category": "...",
  "unit": "...",
  "totalQuantity": 250
}
```

**Guard:** Cannot reduce `totalQuantity` below `totalQuantity - availableQty` (i.e., cannot reduce below already-fulfilled quantity).

---

#### `PATCH /api/admin/inventory/:id/stale`
Mark item as stale (archived).

**Body:**
```json
{ "action": "mark" | "unmark" }
```

**Guard:** Cannot mark stale if there are open (`REQUESTED` or `PENDING`) requests for this item. Returns `409 OPEN_REQUESTS_EXIST`.

---

### 5.7 Admin — Analytics

#### `GET /api/admin/stats/items`
Per-item statistics.

**Query:** `sessionYear`, `itemId` (optional, for single item deep-dive).

**Response:**
```json
{
  "items": [
    {
      "itemId": "...",
      "name": "A4 Paper",
      "totalRequested": 800,
      "totalFulfilled": 600,
      "totalRejected": 50,
      "remainingStock": 150,
      "usageSeries": {
        "monthly": [ { "month": "2026-01", "qty": 80 }, ... ],
        "quarterly": [ { "quarter": "Q1-2026", "qty": 210 }, ... ]
      }
    }
  ],
  "summary": {
    "mostUsed": { "name": "...", "qty": 800 },
    "leastUsed": { "name": "...", "qty": 12 }
  }
}
```

**Caching:** Redis, TTL 5 minutes per `(sessionYear, itemId)` key.

---

#### `GET /api/admin/stats/requests`
Request-level stats for the admin's review.

**Query:** `dateFrom`, `dateTo`, `sessionYear`, `granularity` (`daily|weekly|monthly`).

---

#### `GET /api/admin/stock-alerts`
All unread stock alerts from users. Supports `isRead`, `itemId`, `dateFrom/dateTo` filters.

---

#### `PATCH /api/admin/stock-alerts/:id/resolve`
Mark stock alert resolved (when item is restocked).

**Side effect:** Notifications sent to all users who submitted an alert for this item.

---

### 5.8 Super Admin — Analytics

#### `GET /api/super-admin/stats/overview`
Platform-wide summary.

**Query:** `sessionYear`, `granularity` (`monthly|quarterly|yearly`).

**Response:**
```json
{
  "totalRequests": 1420,
  "approvalRate": 0.78,
  "avgProcessingTimeHours": 6.4,
  "series": { "monthly": [...], "quarterly": [...] },
  "topItems": [...],
  "topDepartments": [...]
}
```

---

#### `GET /api/super-admin/stats/items/:id`
Deep analytics for a single item across all session years.

---

#### `GET /api/super-admin/stats/requests`
Cross-admin request analytics.

**Response includes:**
- Requests grouped by admin (who approved most).
- Requests grouped by department.
- Approval/rejection ratio per admin.

---

#### `GET /api/super-admin/users`
Paginated user list with request counts.

---

#### `GET /api/super-admin/admins`
Admin list with activity stats (requests processed, avg processing time).

---

## 6. RBAC — Role-Based Access Control

### 6.1 Middleware Layer

```typescript
// middleware.ts (Next.js Edge Middleware)

import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { verifyAccessToken } from '@/lib/auth/jwt'

const ROUTE_GUARDS: Record<string, string[]> = {
  '/api/user':        ['USER', 'ADMIN', 'SUPER_ADMIN'],
  '/api/admin':       ['ADMIN', 'SUPER_ADMIN'],
  '/api/super-admin': ['SUPER_ADMIN'],
  '/api/inventory':   ['USER', 'ADMIN', 'SUPER_ADMIN'],
  '/api/auth':        [],   // public
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  const requiredRoles = Object.entries(ROUTE_GUARDS).find(([prefix]) =>
    pathname.startsWith(prefix)
  )?.[1]

  if (requiredRoles === undefined) return NextResponse.next()
  if (requiredRoles.length === 0) return NextResponse.next()  // public

  const authHeader = request.headers.get('Authorization')
  const token = authHeader?.replace('Bearer ', '')

  if (!token) {
    return NextResponse.json({ success: false, error: { code: 'UNAUTHORIZED' } }, { status: 401 })
  }

  try {
    const payload = await verifyAccessToken(token)

    // Check Redis blacklist
    const isBlacklisted = await redis.get(`blacklist:${token}`)
    if (isBlacklisted) throw new Error('Token blacklisted')

    if (!requiredRoles.includes(payload.role)) {
      return NextResponse.json({ success: false, error: { code: 'FORBIDDEN' } }, { status: 403 })
    }

    // Inject decoded user into request headers for route handlers
    const requestHeaders = new Headers(request.headers)
    requestHeaders.set('x-user-id', payload.sub)
    requestHeaders.set('x-user-role', payload.role)
    requestHeaders.set('x-user-email', payload.email)

    return NextResponse.next({ request: { headers: requestHeaders } })
  } catch {
    return NextResponse.json({ success: false, error: { code: 'INVALID_TOKEN' } }, { status: 401 })
  }
}

export const config = {
  matcher: ['/api/:path*'],
}
```

### 6.2 Route-Level Permission Matrix

| Endpoint | USER | ADMIN | SUPER_ADMIN |
|----------|------|-------|-------------|
| `GET /api/inventory/items` | ✅ (active, non-stale only) | ✅ (all) | ✅ (all) |
| `POST /api/inventory/items/:id/alert` | ✅ | ✅ | ❌ |
| `POST /api/user/requests` | ✅ | ❌ | ❌ |
| `PATCH /api/user/requests/:id/cancel` | ✅ (own only) | ❌ | ❌ |
| `PATCH /api/user/requests/:id/re-request` | ✅ (own, rejected only) | ❌ | ❌ |
| `PATCH /api/admin/requests/:id/approve` | ❌ | ✅ | ❌ |
| `PATCH /api/admin/requests/:id/reject` | ❌ | ✅ | ❌ |
| `POST /api/admin/inventory` | ❌ | ✅ | ❌ |
| `PUT /api/admin/inventory/:id` | ❌ | ✅ | ❌ |
| `GET /api/admin/stats/*` | ❌ | ✅ | ✅ |
| `GET /api/super-admin/*` | ❌ | ❌ | ✅ |

### 6.3 Data-Row Ownership Checks

Beyond role middleware, individual route handlers enforce ownership:

```typescript
// lib/auth/guards.ts

export function assertOwnership(resourceUserId: string, requestUserId: string) {
  if (resourceUserId !== requestUserId) {
    throw new ForbiddenError('You do not own this resource.')
  }
}

// Usage in route:
const request = await prisma.request.findUnique({ where: { id } })
assertOwnership(request.userId, ctx.userId)
```

---

## 7. End-to-End Security Hardening

### 7.1 Authentication

```typescript
// lib/auth/jwt.ts

import { SignJWT, jwtVerify } from 'jose'

const ACCESS_SECRET = new TextEncoder().encode(process.env.JWT_ACCESS_SECRET)
const REFRESH_SECRET = new TextEncoder().encode(process.env.JWT_REFRESH_SECRET)

export async function signAccessToken(payload: JwtPayload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('15m')
    .setIssuer('cims.college.edu')
    .setAudience('cims-client')
    .sign(ACCESS_SECRET)
}

export async function signRefreshToken(sessionId: string, userId: string) {
  return new SignJWT({ sessionId, userId })
    .setProtectedHeader({ alg: 'HS256' })
    .setExpirationTime('7d')
    .sign(REFRESH_SECRET)
}

export async function verifyAccessToken(token: string) {
  const { payload } = await jwtVerify(token, ACCESS_SECRET, {
    issuer: 'cims.college.edu',
    audience: 'cims-client',
  })
  return payload as JwtPayload
}
```

**Token Architecture:**
- Access token: 15-minute JWT in `Authorization` header. Never stored in `localStorage`.
- Refresh token: 7-day JWT in `HttpOnly; Secure; SameSite=Strict` cookie. Rotated on every use.
- On logout: refresh token deleted from DB + access token blacklisted in Redis for remaining TTL.

### 7.2 Password Hashing

```typescript
import argon2 from 'argon2'

export const hashPassword = (plain: string) =>
  argon2.hash(plain, { type: argon2.argon2id, memoryCost: 65536, timeCost: 3, parallelism: 2 })

export const verifyPassword = (hash: string, plain: string) =>
  argon2.verify(hash, plain)
```

**Never use bcrypt for new systems.** Argon2id is the current OWASP recommendation.

### 7.3 Input Validation (Zod)

Every API route handler uses Zod schemas at the entry point, before any DB access:

```typescript
// schemas/requests.ts
import { z } from 'zod'

export const CreateRequestSchema = z.object({
  items: z.array(
    z.object({
      itemId: z.string().uuid(),
      quantity: z.number().int().min(1).max(500),
    })
  ).min(1).max(10),
  notes: z.string().max(500).optional(),
})

// Route handler pattern:
export async function POST(req: Request) {
  const body = await req.json()
  const parsed = CreateRequestSchema.safeParse(body)
  if (!parsed.success) {
    return apiError('VALIDATION_ERROR', 400, parsed.error.flatten())
  }
  // proceed with parsed.data
}
```

### 7.4 SQL Injection Prevention

Prisma parameterizes all queries by default. For raw queries (analytics aggregations):

```typescript
// NEVER: prisma.$queryRawUnsafe(`SELECT * WHERE id = '${id}'`)

// ALWAYS: tag literal
const items = await prisma.$queryRaw`
  SELECT id, name, SUM(ri.quantity_req) as total
  FROM inventory_items i
  JOIN request_items ri ON i.id = ri.item_id
  WHERE i.session_year = ${sessionYear}
  GROUP BY i.id
`
```

### 7.5 HTTP Security Headers

```typescript
// next.config.ts — Security Headers
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=63072000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'SAMEORIGIN' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'Referrer-Policy', value: 'origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  {
    key: 'Content-Security-Policy',
    value: [
      "default-src 'self'",
      "script-src 'self' 'nonce-{NONCE}'",
      "style-src 'self' 'unsafe-inline'",  // tighten with nonces in production
      "img-src 'self' https://cdn.college.edu data:",
      "font-src 'self'",
      "connect-src 'self' https://api.resend.com",
      "frame-ancestors 'none'",
    ].join('; '),
  },
]
```

### 7.6 CORS

```typescript
// API routes only accept same-origin or whitelisted origins.
// next.config.ts
async headers() {
  return [
    {
      source: '/api/:path*',
      headers: [
        { key: 'Access-Control-Allow-Origin', value: process.env.ALLOWED_ORIGIN },
        { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PUT,PATCH,DELETE,OPTIONS' },
        { key: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type' },
        { key: 'Access-Control-Allow-Credentials', value: 'true' },
      ],
    },
  ]
}
```

### 7.7 File Upload Security

Image uploads (item images, user avatars):

```typescript
const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp']
const MAX_SIZE_BYTES = 5 * 1024 * 1024 // 5MB

export async function validateUpload(file: File) {
  if (!ALLOWED_MIME.includes(file.type)) throw new ValidationError('Invalid file type.')
  if (file.size > MAX_SIZE_BYTES) throw new ValidationError('File exceeds 5MB limit.')

  // Read magic bytes — never trust MIME type alone
  const buffer = await file.arrayBuffer()
  const magic = new Uint8Array(buffer.slice(0, 4))
  const isJpeg = magic[0] === 0xFF && magic[1] === 0xD8
  const isPng  = magic[0] === 0x89 && magic[1] === 0x50
  const isWebp = magic[8] === 0x57 && magic[9] === 0x45  // RIFF....WEBP
  if (!isJpeg && !isPng && !isWebp) throw new ValidationError('File content does not match declared type.')
}
```

Files are stored in S3 with pre-signed URLs (15-min expiry for GET). Never served directly from the app server.

### 7.8 IDOR Prevention

Every resource fetch checks ownership or role before returning data:

```typescript
// lib/api/assertions.ts
export async function assertRequestAccess(requestId: string, userId: string, role: Role) {
  const request = await prisma.request.findUnique({ where: { id: requestId } })
  if (!request) throw new NotFoundError('Request not found.')

  if (role === 'USER' && request.userId !== userId) {
    throw new ForbiddenError('Access denied.')
  }
  return request
}
```

---

## 8. Caching Policies

### 8.1 Redis Cache Strategy

```typescript
// lib/cache/redis.ts
import { Redis } from 'ioredis'
export const redis = new Redis(process.env.REDIS_URL)

// Generic cache-aside pattern
export async function cached<T>(
  key: string,
  ttlSeconds: number,
  fn: () => Promise<T>
): Promise<T> {
  const cached = await redis.get(key)
  if (cached) return JSON.parse(cached) as T

  const result = await fn()
  await redis.setex(key, ttlSeconds, JSON.stringify(result))
  return result
}

// Cache invalidation
export async function invalidatePattern(pattern: string) {
  const keys = await redis.keys(pattern)
  if (keys.length > 0) await redis.del(...keys)
}
```

### 8.2 Cache TTLs per Resource

| Resource | TTL | Invalidation Trigger |
|----------|-----|---------------------|
| `inventory:items:list:{sessionYear}:{page}` | 2 min | Item added/edited/stale-marked |
| `inventory:item:{id}` | 5 min | Item updated |
| `admin:stats:items:{sessionYear}` | 5 min | Request approved/rejected |
| `admin:stats:requests:{sessionYear}:{granularity}` | 5 min | Request status changed |
| `super-admin:overview:{sessionYear}` | 10 min | Any request status change |
| `user:profile:stats:{userId}` | 2 min | User request status change |
| `user:notifications:unread:{userId}` | 30 sec | New notification created |

### 8.3 HTTP Cache-Control Headers

```typescript
// Static assets (Next.js handles automatically)
Cache-Control: public, max-age=31536000, immutable

// API responses: no caching by default (sensitive data)
Cache-Control: no-store, no-cache, must-revalidate

// Exception: public catalog (unauthenticated items list)
Cache-Control: public, s-maxage=60, stale-while-revalidate=300
```

### 8.4 Next.js ISR for Public Pages

The public inventory catalog (if exposed unauthenticated) uses ISR:

```typescript
// app/(public)/catalog/page.tsx
export const revalidate = 60  // regenerate every 60s

export async function generateStaticParams() {
  return []  // on-demand only
}
```

---

## 9. Rate Limiting & Brute-Force Prevention

### 9.1 Rate Limiter Implementation

```typescript
// lib/rate-limit/limiter.ts
interface RateLimitConfig {
  windowSeconds: number
  maxRequests: number
  keyPrefix: string
}

export async function rateLimit(
  identifier: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number; resetAt: number }> {
  const key = `${config.keyPrefix}:${identifier}`
  const now = Date.now()
  const windowStart = now - config.windowSeconds * 1000

  const pipe = redis.pipeline()
  pipe.zremrangebyscore(key, 0, windowStart)
  pipe.zadd(key, now, `${now}-${Math.random()}`)
  pipe.zcard(key)
  pipe.expire(key, config.windowSeconds)
  const results = await pipe.exec()

  const count = results?.[2]?.[1] as number
  const allowed = count <= config.maxRequests
  const resetAt = Math.floor(now / 1000) + config.windowSeconds

  return {
    allowed,
    remaining: Math.max(0, config.maxRequests - count),
    resetAt,
  }
}
```

### 9.2 Rate Limit Tiers

```typescript
// Rate limit configurations
export const RATE_LIMITS = {
  // Authentication
  LOGIN:           { windowSeconds: 600, maxRequests: 5,   keyPrefix: 'rl:login' },
  LOGIN_HARD_LOCK: { windowSeconds: 600, maxRequests: 10,  keyPrefix: 'rl:login:hard' },
  REFRESH:         { windowSeconds: 60,  maxRequests: 10,  keyPrefix: 'rl:refresh' },

  // General API per user
  API_USER:        { windowSeconds: 60,  maxRequests: 60,  keyPrefix: 'rl:api:user' },
  API_ADMIN:       { windowSeconds: 60,  maxRequests: 120, keyPrefix: 'rl:api:admin' },

  // Write operations
  CREATE_REQUEST:  { windowSeconds: 300, maxRequests: 5,   keyPrefix: 'rl:create-request' },
  STOCK_ALERT:     { windowSeconds: 86400, maxRequests: 3, keyPrefix: 'rl:stock-alert' },

  // File uploads
  UPLOAD:          { windowSeconds: 3600, maxRequests: 20, keyPrefix: 'rl:upload' },
}
```

### 9.3 Rate Limit Response Headers

```typescript
// Always attach these to responses
response.headers.set('X-RateLimit-Limit', String(config.maxRequests))
response.headers.set('X-RateLimit-Remaining', String(result.remaining))
response.headers.set('X-RateLimit-Reset', String(result.resetAt))

if (!result.allowed) {
  response.headers.set('Retry-After', String(config.windowSeconds))
  return apiError('RATE_LIMIT_EXCEEDED', 429)
}
```

### 9.4 Brute-Force Login Protection

```typescript
// On every login attempt:
async function handleLogin(email: string, password: string, ip: string) {
  // IP-level hard limit
  const ipLimit = await rateLimit(ip, RATE_LIMITS.LOGIN_HARD_LOCK)
  if (!ipLimit.allowed) throw new RateLimitError('Too many attempts from this IP.')

  // Email-level soft limit
  const emailLimit = await rateLimit(email, RATE_LIMITS.LOGIN)
  if (!emailLimit.allowed) throw new RateLimitError('Account temporarily locked. Try in 10 minutes.')

  const user = await prisma.user.findUnique({ where: { email } })
  const success = user ? await verifyPassword(user.passwordHash, password) : false

  // Always record attempt (even for non-existent users to prevent timing attacks)
  await prisma.loginAttempt.create({
    data: { userId: user?.id, email, ipAddress: ip, success }
  })

  if (!success) throw new AuthError('Invalid credentials.')
  if (!user!.isActive) throw new AuthError('Account inactive.')

  return user!
}
```

**Additional protections:**
- Constant-time comparison via `timingSafeEqual` in crypto module.
- Generic error message for both "wrong password" and "user not found" (prevents user enumeration).
- CAPTCHA integration hook after 3 failed attempts (reCAPTCHA v3 score threshold 0.7).

---

## 10. Response Compression & Optimization

### 10.1 Gzip / Brotli Compression

Next.js enables gzip automatically. Enable Brotli for higher compression ratios:

```typescript
// next.config.ts
module.exports = {
  compress: true,   // enables gzip
  // For Brotli: use a reverse proxy (Nginx/Vercel) in front of Next.js
}
```

**Nginx config (if self-hosted):**
```nginx
gzip on;
gzip_vary on;
gzip_min_length 1024;
gzip_types application/json text/plain text/css application/javascript;

brotli on;
brotli_comp_level 4;
brotli_types application/json text/plain application/javascript;
```

### 10.2 API Response Optimization

- **Field selection:** Accept `?fields=id,name,availableQty` to trim large payloads.
- **Sparse responses:** Admin list endpoints return summary objects; detail fetched on demand.
- **Streaming:** Large analytics exports use `ReadableStream` via Next.js Route Handler streaming.

```typescript
// Streaming analytics export
export async function GET(req: Request) {
  const stream = new ReadableStream({
    async start(controller) {
      const encoder = new TextEncoder()
      controller.enqueue(encoder.encode('['))

      let first = true
      for await (const batch of getRequestsBatched({ batchSize: 500 })) {
        if (!first) controller.enqueue(encoder.encode(','))
        controller.enqueue(encoder.encode(JSON.stringify(batch)))
        first = false
      }

      controller.enqueue(encoder.encode(']'))
      controller.close()
    }
  })

  return new Response(stream, {
    headers: { 'Content-Type': 'application/json' }
  })
}
```

### 10.3 Database Query Optimization

- **N+1 prevention:** Use Prisma `include` strategically, not nested loops.
- **Aggregations:** Run `COUNT`, `SUM`, `GROUP BY` at DB level — never in JavaScript.
- **Pagination:** Cursor-based (not OFFSET-based) for large tables. See §11.
- **Index-only scans:** Analytic queries only touch indexed columns where possible.

```typescript
// Bad: N+1
const requests = await prisma.request.findMany()
for (const r of requests) {
  r.items = await prisma.requestItem.findMany({ where: { requestId: r.id } }) // N queries!
}

// Good: Single join
const requests = await prisma.request.findMany({
  include: {
    items: { include: { item: { select: { name: true, unit: true } } } },
    user: { select: { name: true, department: true } }
  }
})
```

---

## 11. API Pagination & Cursor Design

### 11.1 Cursor-Based Pagination

**Never use OFFSET pagination** for production datasets. It degrades to O(n) scans.

```typescript
// lib/pagination/cursor.ts

export interface CursorPage<T> {
  items: T[]
  nextCursor: string | null
  hasMore: boolean
  total: number  // from COUNT(*) query, cached separately
}

export async function paginateWithCursor<T extends { id: string; createdAt: Date }>(
  query: (args: { take: number; cursor?: { id: string } }) => Promise<T[]>,
  countQuery: () => Promise<number>,
  { cursor, limit = 20 }: { cursor?: string; limit?: number }
): Promise<CursorPage<T>> {
  const take = Math.min(limit, 50) + 1  // fetch 1 extra to check hasMore

  const items = await query({
    take,
    cursor: cursor ? { id: cursor } : undefined,
  })

  const hasMore = items.length > take - 1
  const page = hasMore ? items.slice(0, -1) : items
  const nextCursor = hasMore ? page[page.length - 1].id : null
  const total = await countQuery()

  return { items: page, nextCursor, hasMore, total }
}
```

**Response envelope:**
```json
{
  "success": true,
  "data": [ ... ],
  "meta": {
    "limit": 20,
    "total": 342,
    "hasMore": true,
    "nextCursor": "clqz9x00j000008l7hcml3u2p"
  }
}
```

### 11.2 Preventing Cursor Tampering

Cursors are base64-encoded and signed:

```typescript
export function encodeCursor(id: string, createdAt: Date): string {
  const payload = `${id}:${createdAt.toISOString()}`
  const sig = createHmac('sha256', process.env.CURSOR_SECRET).update(payload).digest('hex').slice(0, 16)
  return Buffer.from(`${payload}:${sig}`).toString('base64url')
}

export function decodeCursor(cursor: string): { id: string; createdAt: Date } {
  const decoded = Buffer.from(cursor, 'base64url').toString()
  const parts = decoded.split(':')
  const [id, createdAtStr, sig] = [parts[0], parts.slice(1, -1).join(':'), parts[parts.length - 1]]
  const payload = `${id}:${createdAtStr}`
  const expected = createHmac('sha256', process.env.CURSOR_SECRET).update(payload).digest('hex').slice(0, 16)
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new ValidationError('Invalid cursor.')
  return { id, createdAt: new Date(createdAtStr) }
}
```

---

## 12. PDF Invoice Generation

### 12.1 Generation Pipeline

```
[Request APPROVED]
       │
       ▼
[Queue: PDF job enqueued (async)]
       │
       ▼
[Server: @react-pdf/renderer → PDF Buffer]
       │
       ▼
[Upload to S3: invoices/{year}/{invoiceNumber}.pdf]
       │
       ▼
[Update Request.invoiceUrl, Request.invoiceNumber]
       │
       ▼
[Notify user with signed download URL]
```

### 12.2 Invoice Template Specification

```tsx
// components/pdf/InvoiceDocument.tsx
import { Document, Page, Text, View, Image, StyleSheet, Font } from '@react-pdf/renderer'

Font.register({ family: 'Crimson', src: '/fonts/CrimsonText-Regular.ttf' })

const styles = StyleSheet.create({
  page: { fontFamily: 'Crimson', padding: 48, position: 'relative' },
  watermark: {
    position: 'absolute', top: '35%', left: '25%',
    opacity: 0.07, transform: 'rotate(-30deg)', fontSize: 72
  },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 32 },
  invoiceNumber: { fontSize: 11, color: '#555', marginBottom: 4 },
  title: { fontSize: 24, fontWeight: 'bold', color: '#1a1a1a' },
  table: { marginTop: 16 },
  tableRow: { flexDirection: 'row', borderBottom: '0.5pt solid #e0e0e0', paddingVertical: 8 },
  colName: { flex: 3 },
  colQty: { flex: 1, textAlign: 'right' },
  colUnit: { flex: 1, textAlign: 'right' },
  signature: { marginTop: 48, alignItems: 'flex-end' },
})

export function InvoiceDocument({ request, admin, items, college }) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Watermark */}
        <View style={styles.watermark}>
          <Text>{college.sealText}</Text>
        </View>

        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={{ fontSize: 18, fontWeight: 'bold' }}>{college.name}</Text>
            <Text style={{ fontSize: 10, color: '#666' }}>{college.address}</Text>
          </View>
          <Image src={college.logoUrl} style={{ width: 64, height: 64 }} />
        </View>

        {/* Invoice meta */}
        <Text style={styles.invoiceNumber}>Invoice No: {request.invoiceNumber}</Text>
        <Text style={styles.invoiceNumber}>Date: {formatDate(request.processedAt)}</Text>
        <Text style={styles.invoiceNumber}>Session Year: {request.sessionYear}</Text>

        {/* Requester */}
        <View style={{ marginTop: 24, padding: 12, backgroundColor: '#f8f8f8' }}>
          <Text style={{ fontSize: 11, fontWeight: 'bold', marginBottom: 4 }}>Issued To</Text>
          <Text style={{ fontSize: 11 }}>{request.user.name}</Text>
          <Text style={{ fontSize: 10, color: '#555' }}>{request.user.department} · {request.user.employeeId}</Text>
        </View>

        {/* Items Table */}
        <View style={styles.table}>
          <View style={[styles.tableRow, { backgroundColor: '#f0f0f0' }]}>
            <Text style={[styles.colName, { fontSize: 10, fontWeight: 'bold' }]}>Item</Text>
            <Text style={[styles.colQty, { fontSize: 10, fontWeight: 'bold' }]}>Qty</Text>
            <Text style={[styles.colUnit, { fontSize: 10, fontWeight: 'bold' }]}>Unit</Text>
          </View>
          {items.map((item) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={[styles.colName, { fontSize: 11 }]}>{item.name}</Text>
              <Text style={[styles.colQty, { fontSize: 11 }]}>{item.quantityFul ?? item.quantityReq}</Text>
              <Text style={[styles.colUnit, { fontSize: 11 }]}>{item.unit}</Text>
            </View>
          ))}
        </View>

        {/* Admin Notes */}
        {request.adminNotes && (
          <View style={{ marginTop: 24 }}>
            <Text style={{ fontSize: 10, color: '#555' }}>Remarks: {request.adminNotes}</Text>
          </View>
        )}

        {/* Signature */}
        <View style={styles.signature}>
          {admin.signatureUrl && (
            <Image src={admin.signatureUrl} style={{ width: 120, height: 40, marginBottom: 4 }} />
          )}
          <Text style={{ fontSize: 10, borderTop: '0.5pt solid #333', paddingTop: 4 }}>
            Authorized by: {admin.name}
          </Text>
          <Text style={{ fontSize: 9, color: '#888' }}>{admin.designation}</Text>
        </View>

        {/* Footer */}
        <Text style={{ position: 'absolute', bottom: 24, left: 48, fontSize: 9, color: '#aaa' }}>
          This is a system-generated document. Verify at {college.verifyUrl}
        </Text>
      </Page>
    </Document>
  )
}
```

### 12.3 Signed URL for Invoice Download

```typescript
// Never expose raw S3 keys to clients
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'
import { GetObjectCommand } from '@aws-sdk/client-s3'

export async function getInvoiceDownloadUrl(s3Key: string): Promise<string> {
  const command = new GetObjectCommand({
    Bucket: process.env.S3_BUCKET,
    Key: s3Key,
    ResponseContentDisposition: 'attachment; filename="invoice.pdf"',
  })
  return getSignedUrl(s3Client, command, { expiresIn: 900 }) // 15 minutes
}
```

---

## 13. Notification System (Platform + Email)

### 13.1 Notification Dispatcher

```typescript
// lib/notifications/dispatcher.ts

interface NotificationPayload {
  userId: string
  type: NotificationType
  title: string
  message: string
  requestId?: string
  sendEmail?: boolean
}

export async function dispatch(payload: NotificationPayload) {
  // 1. Persist to DB
  await prisma.notification.create({ data: payload })

  // 2. Real-time push via Redis pub/sub (SSE channel)
  await redis.publish(`notifications:${payload.userId}`, JSON.stringify({
    type: payload.type,
    title: payload.title,
    message: payload.message,
  }))

  // 3. Email (async, non-blocking)
  if (payload.sendEmail !== false) {
    notificationEmailQueue.add('send-email', payload)
  }
}

// Notify all admins
export async function dispatchToAdmins(payload: Omit<NotificationPayload, 'userId'>) {
  const admins = await prisma.user.findMany({
    where: { role: 'ADMIN', isActive: true },
    select: { id: true }
  })
  await Promise.all(admins.map(a => dispatch({ ...payload, userId: a.id })))
}
```

### 13.2 Server-Sent Events for Real-Time Notifications

```typescript
// app/api/user/notifications/stream/route.ts
export async function GET(req: Request) {
  const userId = req.headers.get('x-user-id')!
  const encoder = new TextEncoder()

  const stream = new ReadableStream({
    async start(controller) {
      const subscriber = redis.duplicate()
      await subscriber.subscribe(`notifications:${userId}`)

      subscriber.on('message', (_, message) => {
        controller.enqueue(encoder.encode(`data: ${message}\n\n`))
      })

      req.signal.addEventListener('abort', () => {
        subscriber.unsubscribe()
        subscriber.quit()
        controller.close()
      })
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    }
  })
}
```

### 13.3 Email Templates (Resend)

```typescript
// lib/notifications/emails.ts
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function sendRequestApprovedEmail(to: string, data: ApprovedEmailData) {
  await resend.emails.send({
    from: 'inventory@college.edu',
    to,
    subject: `Request Approved — Invoice #${data.invoiceNumber}`,
    html: renderApprovedEmailTemplate(data),  // React Email template
  })
}
```

---

## 14. Edge Case Handling — Backend

### 14.1 Race Conditions on Stock Decrement

When two admins approve competing requests for the same item simultaneously:

```typescript
// Use PostgreSQL advisory locks + transaction
await prisma.$transaction(async (tx) => {
  // Lock the item row for update
  const item = await tx.$queryRaw<InventoryItem[]>`
    SELECT * FROM inventory_items WHERE id = ${itemId} FOR UPDATE
  `
  if (item[0].available_qty < requestedQty) {
    throw new ConflictError(`Insufficient stock for "${item[0].name}". Available: ${item[0].available_qty}`)
  }
  await tx.inventoryItem.update({
    where: { id: itemId },
    data: { availableQty: { decrement: requestedQty } }
  })
})
```

### 14.2 Re-Request Stock Validation

When a user re-requests a rejected item, stock may have changed since original request:

```typescript
async function reRequest(requestId: string, userId: string) {
  const request = await prisma.request.findUnique({
    where: { id: requestId },
    include: { items: { include: { item: true } } }
  })
  if (request.status !== 'REJECTED') throw new ConflictError('Only rejected requests can be re-submitted.')

  // Re-validate every item
  const insufficientItems = request.items.filter(
    ri => ri.item.availableQty < ri.quantityReq
  )
  if (insufficientItems.length > 0) {
    throw new ConflictError('Some items no longer have sufficient stock.', {
      items: insufficientItems.map(i => ({ name: i.item.name, available: i.item.availableQty }))
    })
  }
  // proceed with status update
}
```

### 14.3 Cancellation of PENDING Requests

If stock was mentally "reserved" when an admin set a request to PENDING (optional pre-approval hold):

```typescript
async function cancelRequest(requestId: string, userId: string) {
  const request = await prisma.request.findUnique({ ... })

  await prisma.$transaction(async (tx) => {
    await tx.request.update({ where: { id: requestId }, data: { status: 'CANCELLED', cancelledAt: new Date() } })

    // Only restore stock if it was actually decremented (i.e., APPROVED state)
    // For PENDING/REQUESTED — stock was never decremented, nothing to restore
    if (request.status === 'APPROVED') {
      for (const item of request.items) {
        await tx.inventoryItem.update({
          where: { id: item.itemId },
          data: { availableQty: { increment: item.quantityFul ?? item.quantityReq } }
        })
        await tx.stockHistory.create({
          data: {
            itemId: item.itemId, changeType: 'RESTORED',
            quantityDelta: item.quantityFul ?? item.quantityReq,
            changedBy: userId, requestId
          }
        })
      }
    }
  })
}
```

### 14.4 Session Year Boundary

On January 1 of a new academic year:

- New items default to new `sessionYear`.
- Previous-year items with `availableQty > 0` are surfaced to admins via a "Carry-Over Review" dashboard.
- Admins explicitly mark them `STALE` or create new items carrying forward the quantity.
- **Never auto-archive** items — always require human decision.

### 14.5 PDF Generation Failure

```typescript
async function generateInvoiceSafe(requestId: string) {
  try {
    const pdfBuffer = await renderInvoicePdf(requestId)
    const key = await uploadToS3(pdfBuffer, `invoices/${year}/${invoiceNumber}.pdf`)
    await prisma.request.update({ where: { id: requestId }, data: { invoiceUrl: key } })
  } catch (err) {
    // Log but don't fail the approval — invoice can be regenerated by admin
    logger.error('PDF generation failed', { requestId, err })
    await prisma.request.update({
      where: { id: requestId },
      data: { invoiceUrl: null }  // null signals "pending PDF"
    })
    // Queue a retry job
    pdfRetryQueue.add('retry-pdf', { requestId }, { attempts: 3, backoff: { type: 'exponential', delay: 2000 } })
  }
}
```

### 14.6 Input Validation Edge Cases

| Scenario | Handling |
|----------|----------|
| `quantity: 0` | Zod `.min(1)` rejects before DB |
| `quantity: 10.5` | Zod `.int()` rejects |
| `itemId` from different session year | Cross-check in handler |
| Request with 0 items `[]` | Zod `.min(1)` on array |
| Image URL pointing to external CDN | Validate against allowlist regex |
| `dateFrom > dateTo` in filters | Swap or return `400 INVALID_DATE_RANGE` |
| `sessionYear: 1990` | Validate: `current_year - 1 <= year <= current_year + 1` |
| Very long `notes` (> 500 chars) | Truncated at DB column level + Zod `.max(500)` |
| Concurrent duplicate request creation | Unique index on `(userId, sessionYear, status IN ['REQUESTED','PENDING'])` for same item sets — handled via `409` |
| Admin approves already-approved request | Check `status === 'REQUESTED' || status === 'PENDING'` guard |
| User re-requests a non-rejected request | Status check throws `400` |

### 14.7 Audit Trail Integrity

Every state-changing operation writes to `AuditLog` before the transaction commits:

```typescript
await prisma.$transaction([
  prisma.request.update({ ... }),
  prisma.auditLog.create({
    data: {
      userId: actorId,
      action: 'REQUEST_APPROVED',
      entity: 'Request',
      entityId: requestId,
      metadata: { previousStatus: 'REQUESTED', adminNotes },
      ipAddress
    }
  })
])
```

---

## 15. Edge Case Handling — Frontend

### 15.1 Optimistic Updates with Rollback

```typescript
// hooks/useRequestCancel.ts
export function useRequestCancel(requestId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: () => api.patch(`/user/requests/${requestId}/cancel`),
    onMutate: async () => {
      await queryClient.cancelQueries({ queryKey: ['requests'] })
      const previous = queryClient.getQueryData(['request', requestId])
      // Optimistically update
      queryClient.setQueryData(['request', requestId], (old: Request) => ({
        ...old, status: 'CANCELLED'
      }))
      return { previous }
    },
    onError: (_, __, context) => {
      // Rollback
      queryClient.setQueryData(['request', requestId], context?.previous)
      toast.error('Failed to cancel request. Please try again.')
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['requests'] })
      toast.success('Request cancelled successfully.')
    }
  })
}
```

### 15.2 Network Error Recovery

```typescript
// lib/api/client.ts — axios with interceptors
api.interceptors.response.use(
  res => res,
  async (error) => {
    const originalRequest = error.config

    // Auto-refresh token on 401
    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true
      try {
        const { data } = await axios.post('/api/auth/refresh', {}, { withCredentials: true })
        setAccessToken(data.accessToken)
        originalRequest.headers['Authorization'] = `Bearer ${data.accessToken}`
        return api(originalRequest)
      } catch {
        // Refresh failed → redirect to login
        redirectToLogin()
      }
    }

    // Network offline
    if (!navigator.onLine) {
      toast.error('You are offline. Your action will retry when reconnected.', { duration: Infinity })
      return Promise.reject(error)
    }

    return Promise.reject(error)
  }
)
```

### 15.3 Form State Edge Cases

```typescript
// Multi-item request form
- Max 10 items enforced in UI (add button disabled after 10)
- Quantity input: type="number" min=1 max=availableQty (dynamic max per item)
- Items with availableQty === 0: shown with "Out of Stock" badge, unselectable
- Duplicate item selection: detected client-side, merged into single row
- On submission: disable submit button, show loading spinner, re-enable on error
- Server 409 DUPLICATE_OPEN_REQUEST: toast with link to existing open request
- Server 409 INSUFFICIENT_STOCK: highlight affected items in red, show available qty
```

### 15.4 Empty States

Every list view has a meaningful empty state:

| View | Empty State Message | CTA |
|------|--------------------|----|
| Inventory (no items) | "No items available this session." | — |
| My Requests | "You haven't made any requests yet." | "Browse inventory" |
| Notifications | "You're all caught up." | — |
| Admin: requests | "No requests in this date range." | "Clear filters" |
| Analytics charts | "No data for selected period." | "Change date range" |

### 15.5 Loading States

```typescript
// Skeleton components match exact layout of loaded content
// Prevents Cumulative Layout Shift (CLS)

// InventoryCard Skeleton
export function InventoryCardSkeleton() {
  return (
    <div className="animate-pulse">
      <div className="aspect-square bg-neutral-100 rounded-lg mb-3" />
      <div className="h-4 bg-neutral-100 rounded w-3/4 mb-2" />
      <div className="h-3 bg-neutral-100 rounded w-1/3" />
    </div>
  )
}

// Use Suspense boundaries at route level:
// <Suspense fallback={<InventoryGridSkeleton count={12} />}>
//   <InventoryGrid />
// </Suspense>
```

### 15.6 Long Text Truncation

- Item names: CSS `line-clamp-2`, full name on hover tooltip.
- Admin notes: max 3 lines in card, "Show more" expansion.
- Invoice numbers: `font-mono` with copy-to-clipboard button.
- User names: `truncate` with ellipsis, full name in `title` attribute.

### 15.7 Concurrent Tab Handling

```typescript
// BroadcastChannel for cross-tab auth sync
const channel = new BroadcastChannel('cims-auth')

// On logout:
channel.postMessage({ type: 'LOGOUT' })

// In every tab:
channel.onmessage = (e) => {
  if (e.data.type === 'LOGOUT') {
    clearAuthState()
    router.push('/login')
  }
}
```

### 15.8 Accessibility Edge Cases

- All status badges have `role="status"` and `aria-label`.
- PDF download button: `aria-label="Download invoice PDF for request #XYZ"`.
- Loading spinners: `role="progressbar"` with `aria-label="Loading..."`.
- Notification bell with unread count: `aria-label="Notifications, 3 unread"`.
- Modal dialogs: `role="dialog"`, `aria-modal="true"`, focus trapped, `Escape` closes.
- Charts: hidden `<table>` equivalent for screen readers.

---

## 16. Frontend UI/UX Design System

### 16.1 Aesthetic Direction: "Institutional Precision"

**Tone:** Trustworthy, structured, authoritative — but not cold. Think government archive meets modern productivity tool. The system handles real institutional resources; the design must communicate reliability and clarity.

**Font pairing:**
- Display/Headings: `DM Serif Display` — editorial authority, humanist warmth
- Body/UI: `Geist` — technical precision, excellent at small sizes
- Mono (invoice numbers, IDs): `Geist Mono`

**Color system:**
```css
:root {
  /* Base — warm off-white, not pure white */
  --bg-canvas:      #F7F5F2;
  --bg-surface:     #FFFFFF;
  --bg-subtle:      #F0EDE8;
  --bg-muted:       #E8E4DE;

  /* Ink — warm dark, not pure black */
  --ink-primary:    #1C1917;
  --ink-secondary:  #44403C;
  --ink-tertiary:   #78716C;
  --ink-disabled:   #A8A29E;

  /* Accent — deep forest green (institutional, not tech-startup) */
  --accent-primary:    #166534;
  --accent-primary-bg: #DCFCE7;
  --accent-hover:      #14532D;

  /* Status semantic colors */
  --status-requested:  #B45309;  /* amber */
  --status-approved:   #166534;  /* green */
  --status-rejected:   #B91C1C;  /* red */
  --status-pending:    #1D4ED8;  /* blue */
  --status-cancelled:  #71717A;  /* gray */

  /* Borders */
  --border-default:  #E7E5E4;
  --border-strong:   #A8A29E;

  /* Typography scale */
  --text-xs:    0.75rem;  /* 12px */
  --text-sm:    0.875rem; /* 14px */
  --text-base:  1rem;     /* 16px */
  --text-lg:    1.125rem; /* 18px */
  --text-xl:    1.25rem;  /* 20px */
  --text-2xl:   1.5rem;   /* 24px */
  --text-3xl:   1.875rem; /* 30px */
  --text-4xl:   2.25rem;  /* 36px */

  /* Spacing scale (4px base) */
  --space-1:  0.25rem;   /* 4px */
  --space-2:  0.5rem;    /* 8px */
  --space-3:  0.75rem;   /* 12px */
  --space-4:  1rem;      /* 16px */
  --space-6:  1.5rem;    /* 24px */
  --space-8:  2rem;      /* 32px */
  --space-12: 3rem;      /* 48px */
  --space-16: 4rem;      /* 64px */

  /* Radius — restrained, not bubbly */
  --radius-sm:   2px;
  --radius-base: 4px;
  --radius-md:   6px;
  --radius-lg:   8px;

  /* Shadows — subtle depth */
  --shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
  --shadow-md: 0 2px 8px rgba(0,0,0,0.07);
  --shadow-lg: 0 8px 24px rgba(0,0,0,0.09);
}
```

### 16.2 Component Library

#### Status Badge
```tsx
const STATUS_CONFIG = {
  REQUESTED: { label: 'Requested',  color: 'text-amber-700  bg-amber-50  border-amber-200' },
  PENDING:   { label: 'Pending',    color: 'text-blue-700   bg-blue-50   border-blue-200' },
  APPROVED:  { label: 'Approved',   color: 'text-green-700  bg-green-50  border-green-200' },
  REJECTED:  { label: 'Rejected',   color: 'text-red-700    bg-red-50    border-red-200' },
  CANCELLED: { label: 'Cancelled',  color: 'text-zinc-500   bg-zinc-50   border-zinc-200' },
}

export function StatusBadge({ status }: { status: RequestStatus }) {
  const { label, color } = STATUS_CONFIG[status]
  return (
    <span
      role="status"
      aria-label={`Status: ${label}`}
      className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded text-xs font-medium border ${color}`}
    >
      <span className="size-1.5 rounded-full bg-current" aria-hidden />
      {label}
    </span>
  )
}
```

#### Inventory Item Card
```tsx
export function InventoryCard({ item }: { item: InventoryItem }) {
  const isOutOfStock = item.availableQty === 0
  return (
    <div className="group relative bg-white border border-[--border-default] rounded-lg overflow-hidden
                    transition-shadow duration-200 hover:shadow-md">
      {/* Image */}
      <div className="aspect-[4/3] overflow-hidden bg-[--bg-subtle]">
        {item.imageUrl
          ? <img src={item.imageUrl} alt={item.name} className="w-full h-full object-cover
              transition-transform duration-300 group-hover:scale-105" />
          : <div className="w-full h-full flex items-center justify-center text-[--ink-disabled]">
              <PackageIcon size={32} />
            </div>
        }
        {isOutOfStock && (
          <div className="absolute inset-0 bg-white/80 flex items-center justify-center">
            <span className="text-xs font-semibold text-red-600 tracking-wider uppercase">Out of Stock</span>
          </div>
        )}
      </div>
      {/* Content */}
      <div className="p-4">
        <h3 className="text-sm font-semibold text-[--ink-primary] line-clamp-2 mb-1"
            title={item.name}>{item.name}</h3>
        <p className="text-xs text-[--ink-tertiary] mb-3">{item.category}</p>
        <div className="flex items-center justify-between">
          <span className="text-xs text-[--ink-secondary]">
            {isOutOfStock
              ? <span className="text-red-600 font-medium">Unavailable</span>
              : <><span className="font-medium text-[--ink-primary]">{item.availableQty}</span> {item.unit}</>
            }
          </span>
          {isOutOfStock
            ? <button className="text-xs text-black hover:underline font-medium"
                      onClick={() => openAlertModal(item)}>
                Notify me
              </button>
            : <button className="text-xs bg-black text-white px-3 py-1.5
                                 rounded hover:bg-[--accent-hover] transition-colors font-medium">
                Add to Request
              </button>
          }
        </div>
      </div>
    </div>
  )
}
```

### 16.3 Page Layouts

#### USER — Dashboard Layout
```
┌─────────────────────────────────────────────────────────┐
│  HEADER: Logo · "Stock Warden" · Nav links · Bell · Avatar│
├─────────────────────────────────────────────────────────┤
│                                                         │
│  STATS ROW (4 columns, large numbers, sparse)           │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐  │
│  │ 42 Total │ │30 Apprvd │ │3 Pending │ │9 Rejected│  │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘  │
│                                                         │
│  RECENT REQUESTS (timeline style, left border accent)   │
│  ┌───────────────────────────────────────────────────┐  │
│  │ ● A4 Paper (10 reams) — Approved  — 3 days ago   │  │
│  │ ● Lab Gloves (50 pcs) — Pending   — 1 week ago   │  │
│  └───────────────────────────────────────────────────┘  │
│                                                         │
│  QUICK ACTION: "New Request" prominent CTA              │
└─────────────────────────────────────────────────────────┘
```

#### ADMIN — Dashboard Layout
```
┌─────────────────────────────────────────────────────────┐
│  SIDEBAR (fixed, 240px) │ MAIN CONTENT                  │
│  ─────────────────────  │ ─────────────────────────     │
│  Requests                │ HEADER: Page title + actions  │
│  Inventory               │                               │
│  Analytics               │ CONTENT AREA (fluid)          │
│  Stock Alerts            │                               │
│  Settings                │ Calendar filter bar at top    │
│                          │ Data table below              │
└─────────────────────────────────────────────────────────┘
```

#### Admin Request Table
```tsx
// Columns: #, Requester, Department, Items, Date, Status, Actions
// - Calendar range picker at top right
// - Status filter chips: All | Requested | Pending | Approved | Rejected
// - Clicking a row opens a slide-over drawer (not a new page)
// - Approve/Reject actions in the drawer with confirmation + notes field
// - Bulk selection for future bulk-reject (scaffold now, implement later)
```

### 16.4 Analytics Dashboard (Admin)

```tsx
// Use Recharts. Chart types:
//
// 1. Usage Over Time (line chart)
//    - X: months, Y: quantity fulfilled
//    - Compare: multiple items as separate lines
//    - Toggle: monthly / quarterly
//
// 2. Most/Least Used Items (horizontal bar chart)
//    - Top 5 and bottom 5 items
//    - Single accent color (#166534), decreasing opacity
//
// 3. Request Status Distribution (donut chart)
//    - Approved / Rejected / Cancelled
//    - Center: total requests number
//
// Per-item stock bar: visual "thermometer" showing
//    [==========██████████] 60% remaining
//    totalQty bar with availableQty overlay

export function StockThermometer({ total, available, unit }) {
  const pct = total === 0 ? 0 : (available / total) * 100
  const color = pct > 50 ? '#166534' : pct > 20 ? '#B45309' : '#B91C1C'
  return (
    <div>
      <div className="flex justify-between text-xs text-[--ink-tertiary] mb-1.5">
        <span>{available} {unit} available</span>
        <span>{total} {unit} total</span>
      </div>
      <div className="h-2 bg-[--bg-muted] rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  )
}
```

### 16.5 SUPER ADMIN — Analytics

```tsx
// Overview page:
// - Hero stat: platform-wide approval rate (large number, animated count-up)
// - Time-series chart: requests per month (all sessions overlaid, faded for past years)
// - Admin performance table: sortable by processed, avg time, approval rate
// - Item deep-dive: searchable dropdown → loads per-item cross-year analytics
```

### 16.6 Navigation & Routing

```
/                      → redirect to /dashboard or /login
/login                 → public
/dashboard             → USER: stats + recent requests
/inventory             → USER: browse items
/requests              → USER: request history
/requests/[id]         → USER: single request + invoice
/profile               → USER: profile + stats
/admin                 → ADMIN: redirect to /admin/requests
/admin/requests        → ADMIN: request management
/admin/requests/[id]   → ADMIN: request detail (slide-over on list page)
/admin/inventory       → ADMIN: inventory management
/admin/analytics       → ADMIN: charts + per-item stats
/admin/stock-alerts    → ADMIN: out-of-stock alerts from users
/super-admin           → SUPER_ADMIN: redirect to /super-admin/overview
/super-admin/overview  → SUPER_ADMIN: platform analytics
/super-admin/items/[id]→ SUPER_ADMIN: per-item deep analytics
```

### 16.7 Invoice Status Flow UI

```
REQUESTED ──────► PENDING ──────► APPROVED ──────► [PDF Invoice]
    │                                  │
    │                                  └── User can: Download PDF
    │
    ├── User can: CANCEL (only if REQUESTED or PENDING)
    │
    └── REJECTED ──────► User can: RE-REQUEST
                              │
                              └── loops back to REQUESTED (same request)
```

Visual representation: horizontal stepper on the request detail page with connecting lines and filled/empty circles.

---

## 17. Environment Variables

```bash
# Database
DATABASE_URL="postgresql://user:pass@host:5432/cims_db?schema=public"

# Redis
REDIS_URL="redis://localhost:6379"

# Auth
JWT_ACCESS_SECRET="<min 256-bit random>"
JWT_REFRESH_SECRET="<min 256-bit random>"
CURSOR_SECRET="<min 128-bit random>"
NEXTAUTH_SECRET="<min 256-bit random>"
NEXTAUTH_URL="https://ims.college.edu"

# Storage (AWS S3 or Cloudflare R2)
S3_BUCKET="cims-assets"
S3_REGION="ap-south-1"
AWS_ACCESS_KEY_ID="..."
AWS_SECRET_ACCESS_KEY="..."
CDN_BASE_URL="https://cdn.college.edu"

# Email
RESEND_API_KEY="re_..."
EMAIL_FROM="inventory@college.edu"

# App
NEXT_PUBLIC_APP_URL="https://ims.college.edu"
ALLOWED_ORIGIN="https://ims.college.edu"
SESSION_YEAR_CURRENT="2026"

# PDF generation
COLLEGE_NAME="SVIET College"
COLLEGE_ADDRESS="Banur, Punjab, India"
COLLEGE_LOGO_URL="https://cdn.college.edu/logo.png"
COLLEGE_SEAL_TEXT="SVIET"
COLLEGE_VERIFY_URL="https://ims.college.edu/verify"

# Feature flags
ENABLE_CAPTCHA="true"
RECAPTCHA_SECRET="..."
NEXT_PUBLIC_RECAPTCHA_SITE_KEY="..."
```

---

## 18. Deployment Checklist

### Pre-Deployment
- [ ] `prisma migrate deploy` run against production DB
- [ ] All environment variables set and validated
- [ ] Redis connection pool configured (`maxRetriesPerRequest: 3`)
- [ ] S3 bucket CORS policy allows only app domain
- [ ] S3 bucket has server-side encryption (AES-256) enabled
- [ ] SMTP/Resend domain DNS records (SPF, DKIM, DMARC) verified
- [ ] Security headers tested via [securityheaders.com](https://securityheaders.com)
- [ ] Rate limit thresholds load-tested
- [ ] PDF generation tested for long item names, long admin names
- [ ] All Zod schemas validated with edge-case inputs
- [ ] `pg_trgm` extension enabled in PostgreSQL

### Post-Deployment Smoke Tests
- [ ] Login → JWT issued, refresh cookie set
- [ ] Browse inventory → items load with pagination
- [ ] Submit request → admin notified
- [ ] Admin approve → PDF generated → user notified
- [ ] User cancel → stock correctly restored
- [ ] Re-request rejected item → same requestId reused
- [ ] Super admin analytics → charts load
- [ ] Logout → token blacklisted, refresh cookie cleared
- [ ] Rate limiter: 6th login attempt within 10min → 429 returned

### Monitoring
- [ ] Error tracking: Sentry with source maps
- [ ] Uptime monitoring: /api/health endpoint returning `{ status: "ok", db: "ok", redis: "ok" }`
- [ ] DB slow query logging (threshold: 100ms)
- [ ] Redis memory alarm at 80% usage
- [ ] Failed PDF generation alerts to admin email

---

*End of CIMS Developer Documentation v1.0.0*
*Built with Next.js 14 · PostgreSQL · Prisma · Redis · TypeScript*

**Recent Changes (2026-05-20)**

- **Flex gap → Spacing utilities:** Replaced fragile `gap-*` usage inside flex containers with `space-x-*` / `space-y-*` for broader browser compatibility. Key files updated: [app/admin/inventory/page.tsx](app/admin/inventory/page.tsx), [app/admin/requests/page.tsx](app/admin/requests/page.tsx), [app/admin/stock-alerts/page.tsx](app/admin/stock-alerts/page.tsx), [app/admin/analytics/page.tsx](app/admin/analytics/page.tsx), [app/dashboard/page.tsx](app/dashboard/page.tsx), [app/inventory/page.tsx](app/inventory/page.tsx), [app/requests/[id]/page.tsx](app/requests/[id]/page.tsx), [app/profile/page.tsx](app/profile/page.tsx), [app/super-admin/overview/page.tsx](app/super-admin/overview/page.tsx), [app/super-admin/items/[id]/page.tsx](app/super-admin/items/[id]/page.tsx)
- **Debounced search hook:** Added `lib/hooks/use-debounced-value.ts` and applied it to search-driven pages to reduce API churn. Example usage: [lib/hooks/use-debounced-value.ts](lib/hooks/use-debounced-value.ts), applied in [app/admin/inventory/page.tsx](app/admin/inventory/page.tsx) and [app/inventory/page.tsx](app/inventory/page.tsx).
- **Notifications polling tuned:** Reduced notification query frequency from 30s to 45s and disabled refetch on window focus/reconnect to avoid duplicate immediate fetches. See [components/layout/user-layout.tsx](components/layout/user-layout.tsx) for the React Query options changes (`refetchInterval: 45000`, `staleTime: 45000`, `refetchOnWindowFocus: false`, `refetchOnReconnect: false`).
- **Autoprefixer added:** `autoprefixer` was added to `package.json` to satisfy PostCSS/Tailwind requirements. If the dev server (Turbopack) still reports `Cannot find module 'autoprefixer'` after `npm install`, try the following steps:
  - Run `npm install` then remove Next cache: delete the `.next` folder and restart the dev server.
  - If Turbopack still can't resolve it, move `autoprefixer` from `devDependencies` to `dependencies` in [package.json](package.json) and reinstall (Turbopack sometimes resolves modules only from `dependencies`).
  - Verify `postcss.config.mjs` references and ensure the process has been restarted (kill lingering Node/Turbopack processes).
- **Files changed (high-level):** See the short list above for pages; other small updates include `components/layout/user-layout.tsx`, `lib/hooks/use-debounced-value.ts`, and `package.json`.

**Notes & Next Steps**

- If you want, I can: 1) move `autoprefixer` into `dependencies` and reinstall, 2) restart the dev server and verify Turbopack resolution, and 3) apply debouncing to remaining search inputs across the repo.
- Recommended follow-ups: gate notification polling to the bell/dropdown open state to further reduce background calls, and add a simple unit test for `use-debounced-value` (lightweight Jest test).
