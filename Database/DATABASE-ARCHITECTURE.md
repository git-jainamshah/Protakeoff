# ProTakeOff — Database Architecture
> **Source of truth** for all entities, fields, and relationships.
> Technology-agnostic — this document stays valid whether the DB is PostgreSQL, MySQL, or NoSQL.
> The code implementation lives in `backend/prisma/schema.prisma`.

---

## Current Implementation

| Property | Value |
|----------|-------|
| **Technology** | PostgreSQL (Vercel Postgres / Neon) |
| **ORM** | Prisma v6 |
| **Schema file** | `backend/prisma/schema.prisma` |
| **Migration tool** | `prisma db push` (dev) / `prisma migrate deploy` (prod) |
| **View data** | `npx prisma studio` (set DATABASE_URL first) |

---

## Entities

### 1. User
The person who logs in and uses the platform.

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | Primary key |
| `email` | String | Unique — used for login |
| `name` | String | Display name |
| `password` | String | Bcrypt-hashed, never plain text |
| `role` | String | Platform role: `SUPER_ADMIN` \| `ADMIN` \| `MEMBER` |
| `avatar` | String? | Optional URL to avatar image |
| `companyId` | String? | FK → Company (optional, can be null for unassigned users) |
| `createdAt` | DateTime | Auto-set on creation |
| `updatedAt` | DateTime | Auto-updated on every write |

**Relationships:**
- Belongs to one `Company` (optional)
- Has many `ProjectMember` entries (projects they belong to)
- Has many `Project` entries (projects they created)
- Has many `Shape` entries (shapes they drew)

---

### 2. Company
An organisation on the platform. Users and projects belong to a company.

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | Primary key |
| `name` | String | Company display name |
| `logo` | String? | URL to logo image |
| `website` | String? | Website URL |
| `plan` | String | Subscription: `starter` \| `pro` \| `enterprise` |
| `address` | String? | Physical address |
| `phone` | String? | Contact phone |
| `createdAt` | DateTime | Auto-set |
| `updatedAt` | DateTime | Auto-updated |

**Relationships:**
- Has many `User` entries
- Has many `Project` entries

---

### 3. Project
A construction project (e.g. "Downtown Office Renovation").

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | Primary key |
| `name` | String | Project name |
| `description` | String? | Optional long description |
| `status` | String | `ACTIVE` \| `ARCHIVED` \| `COMPLETED` |
| `address` | String? | Site address |
| `clientName` | String? | Client name |
| `thumbnail` | String? | URL to project thumbnail |
| `companyId` | String | FK → Company (required) |
| `createdById` | String | FK → User who created it |
| `createdAt` | DateTime | Auto-set |
| `updatedAt` | DateTime | Auto-updated |

**Relationships:**
- Belongs to one `Company`
- Belongs to one `User` (creator)
- Has many `ProjectMember` entries (access control)
- Has many `Document` entries (the PDF plans)

---

### 4. ProjectMember
Join table — who has access to which project and at what permission level.

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | Primary key |
| `projectId` | String | FK → Project |
| `userId` | String | FK → User |
| `role` | String | Project-level role: `ADMIN` \| `EDIT` \| `VIEW` |
| `createdAt` | DateTime | Auto-set |

**Constraints:**
- `(projectId, userId)` is unique — a user can only have one role per project

**Relationships:**
- Belongs to one `Project`
- Belongs to one `User`

---

### 5. Document
A PDF (or image) plan uploaded to a project. This is what users draw measurements on.

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | Primary key |
| `name` | String | Display name for the plan |
| `fileUrl` | String | URL to the file (Vercel Blob or external storage) |
| `fileType` | String | `pdf` \| `image` |
| `fileSize` | Int? | File size in bytes |
| `pageCount` | Int | Number of pages (default 1) |
| `thumbnail` | String? | URL to thumbnail preview |
| `scale` | Float | Calibration scale factor (default 1.0) |
| `unit` | String | Measurement unit: `ft` \| `m` \| `in` etc. |
| `projectId` | String | FK → Project |
| `createdAt` | DateTime | Auto-set |
| `updatedAt` | DateTime | Auto-updated |

**Relationships:**
- Belongs to one `Project`
- Has many `Layer` entries

---

### 6. Layer
A drawing layer on a document (like Photoshop layers). Each layer holds a group of shapes.

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | Primary key |
| `name` | String | Layer name (e.g. "Walls", "Flooring") |
| `color` | String | Hex color for all shapes in this layer |
| `type` | String | `AREA` \| `LINEAR` \| `COUNT` — determines metric calculation |
| `visible` | Boolean | Show/hide layer on canvas (default true) |
| `order` | Int | Rendering order (lower = drawn first) |
| `documentId` | String | FK → Document |
| `createdAt` | DateTime | Auto-set |
| `updatedAt` | DateTime | Auto-updated |

**Relationships:**
- Belongs to one `Document`
- Has many `Shape` entries

---

### 7. Shape
A single drawing element on a layer (rectangle, polygon, line, circle, text, etc.)

| Field | Type | Notes |
|-------|------|-------|
| `id` | String (cuid) | Primary key |
| `type` | String | `RECT` \| `POLYGON` \| `LINE` \| `CIRCLE` \| `TEXT` |
| `data` | String | **JSON string** — geometry specific to the type (see below) |
| `label` | String? | Optional user-facing label |
| `color` | String? | Override color (falls back to layer color) |
| `layerId` | String | FK → Layer |
| `createdById` | String? | FK → User (optional) |
| `createdAt` | DateTime | Auto-set |
| `updatedAt` | DateTime | Auto-updated |

**Shape `data` JSON formats by type:**

| Type | JSON shape |
|------|-----------|
| `RECT` | `{ x, y, width, height, rotation?, cornerRadius? }` |
| `POLYGON` | `{ points: [x1,y1, x2,y2, ...] }` |
| `LINE` | `{ points: [x1,y1, x2,y2] }` |
| `CIRCLE` | `{ x, y, radius }` |
| `TEXT` | `{ x, y, text, fontSize, bold, italic, underline, strikethrough, fill, width }` |

**Relationships:**
- Belongs to one `Layer`
- Belongs to one `User` (creator, optional)

---

## Relationship Summary

```
Company
  └─ has many Users
  └─ has many Projects
       └─ has many ProjectMembers  ←→  Users (access control)
       └─ has many Documents
            └─ has many Layers
                 └─ has many Shapes
```

---

## Access Control

| Level | Field | Values | Scope |
|-------|-------|--------|-------|
| Platform | `User.role` | `SUPER_ADMIN`, `ADMIN`, `MEMBER` | All resources |
| Project | `ProjectMember.role` | `ADMIN`, `EDIT`, `VIEW` | Per-project |

---

## Future Migration Notes

If migrating away from PostgreSQL:
- **To another SQL DB** (MySQL, SQLite): schema is straightforward to translate; same relations apply.
- **To NoSQL** (MongoDB): map each entity → collection; flatten `ProjectMember` into embedded arrays or a separate collection; `Shape.data` (already JSON) maps naturally to document fields.
- The **`Database/ER-DIAGRAM.md`** diagram is the technology-agnostic reference for any migration.
