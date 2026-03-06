# ProTakeOff — Software Architecture & Technical Reference

> **Living Document** — Updated with every major feature or architectural change.
> Single source of truth for the entire platform's technical and software details.

---

## Table of Contents
1. [Project Overview](#1-project-overview)
2. [Tech Stack](#2-tech-stack)
3. [Repository Structure](#3-repository-structure)
4. [Database Schema](#4-database-schema)
5. [API Reference](#5-api-reference)
6. [Frontend Architecture](#6-frontend-architecture)
7. [Canvas Engine](#7-canvas-engine)
8. [Authentication Flow](#8-authentication-flow)
9. [User Roles & Permissions](#9-user-roles--permissions)
10. [Version History Feature](#10-version-history-feature)
11. [Environment Variables](#11-environment-variables)
12. [Development Setup](#12-development-setup)
13. [Deployment Guide](#13-deployment-guide)
14. [Feature Roadmap](#14-feature-roadmap)
15. [Changelog](#15-changelog)

---

## 1. Project Overview

**ProTakeOff** is an industry-grade, browser-native Construction Takeoff & Cost Estimation platform. It allows construction engineers and estimators to:

- Upload architectural/structural PDF drawings
- Draw precision measurement shapes (rectangle, polygon, line, circle) directly on the PDF
- Organize measurements into typed layers (Area, Linear, Count)
- Calibrate scale against real-world distances
- Generate cost estimates with unit pricing
- Export measurements as CSV
- Manage multi-user project teams with role-based access
- Administer the platform including visual git version history

**Target Users:** Real estate developers, construction companies, quantity surveyors, MEP engineers.

**Comparable Product:** Procore Estimating, PlanSwift, Bluebeam Revu

---

## 2. Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18.3.x | UI framework |
| TypeScript | 5.7.x | Type safety |
| Vite | 6.x | Build tool & dev server |
| Tailwind CSS | 3.4.x | Utility-first styling (local install) |
| React Router | 7.x | Client-side routing |
| Zustand | 5.x | Global state management (auth) |
| TanStack Query | v5 | Server state, caching, mutations |
| react-konva | 18.x | Canvas rendering layer (shapes/tools) |
| Konva.js | 9.x | 2D canvas engine underlying react-konva |
| pdfjs-dist | 4.x | PDF rendering in browser |
| react-hook-form | 7.x | Form state management |
| Zod | 3.x | Schema validation |
| Axios | 1.x | HTTP client with interceptors |
| Lucide React | latest | Icon library |
| react-hot-toast | 2.x | Notification toasts |
| date-fns | 4.x | Date utilities |
| use-image | 1.x | Async image loading for Konva |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js | 20.x | Runtime |
| TypeScript | 5.7.x | Type safety |
| Express | 5.x | HTTP framework |
| Prisma | 6.x | ORM & migrations |
| SQLite | — | Database (dev); swap to PostgreSQL for prod |
| bcryptjs | 2.x | Password hashing (12 salt rounds) |
| jsonwebtoken | 9.x | JWT token signing/verification |
| multer | 1.x | Multipart file upload handling |
| cors | 2.x | Cross-origin request handling |
| simple-git | 3.x | Git operations for version history |
| dotenv | 16.x | Environment variable loading |
| tsx | 4.x | TypeScript execution (dev) |
| nodemon | 3.x | File-watching auto-restart (dev) |

### Database
| Mode | Technology | Connection |
|---|---|---|
| Development | SQLite | `file:./prisma/dev.db` |
| Production | PostgreSQL | `postgresql://user:pass@host/db` |

> Switching from SQLite to PostgreSQL requires only changing `DATABASE_URL` in `.env.local` and running `prisma migrate deploy`.

---

## 3. Repository Structure

```
protakeoff-studio/
│
├── ARCHITECTURE.md          ← This file (living doc)
├── CREDENTIALS.local.txt    ← Dev credentials (gitignored)
├── README.md                ← Quick-start guide
├── setup.sh                 ← One-command project setup
├── package.json             ← Root workspace config + scripts
├── .gitignore
│
├── backend/
│   ├── package.json
│   ├── tsconfig.json
│   ├── .env.local           ← Active env (gitignored)
│   ├── .env.example         ← Template (committed)
│   ├── uploads/             ← Uploaded PDFs/images (gitignored)
│   ├── prisma/
│   │   ├── schema.prisma    ← Database schema
│   │   ├── seed.ts          ← Demo data seeder
│   │   ├── dev.db           ← SQLite database (gitignored)
│   │   └── migrations/      ← Migration history
│   └── src/
│       ├── server.ts        ← Express app entrypoint
│       ├── lib/
│       │   ├── prisma.ts    ← Prisma client singleton
│       │   └── jwt.ts       ← Token sign/verify helpers
│       ├── middleware/
│       │   ├── auth.ts      ← JWT bearer token guard
│       │   └── upload.ts    ← Multer config (100MB limit)
│       └── routes/
│           ├── auth.ts      ← POST /register, /login, GET/PUT /me
│           ├── projects.ts  ← CRUD + member management
│           ├── documents.ts ← File upload + CRUD
│           ├── layers.ts    ← Layer CRUD
│           ├── shapes.ts    ← Shape CRUD + batch save
│           ├── users.ts     ← User management (admin only)
│           └── admin.ts     ← Stats, git log, GitHub API
│
└── frontend/
    ├── package.json
    ├── vite.config.ts       ← Proxy /api → :5000, code splitting
    ├── tailwind.config.ts   ← Custom brand colors + animations
    ├── postcss.config.cjs
    ├── tsconfig.json
    ├── index.html           ← Inter font, SEO meta
    └── src/
        ├── main.tsx         ← React root, QueryClient, Toaster
        ├── App.tsx          ← Router with protected/public routes
        ├── index.css        ← Tailwind + custom component classes
        ├── types/
        │   └── index.ts     ← All TypeScript interfaces
        ├── lib/
        │   ├── api.ts       ← Axios instance + all API functions
        │   └── utils.ts     ← cn(), geometry math, formatters
        ├── store/
        │   └── authStore.ts ← Zustand auth store (persisted)
        ├── components/
        │   ├── ui/          ← Button, Input, Modal, Badge, Avatar, Spinner
        │   └── layout/      ← AppLayout, Sidebar
        └── pages/
            ├── auth/        ← LoginPage, SignupPage
            ├── DashboardPage.tsx
            ├── ProjectPage.tsx
            ├── takeoff/
            │   ├── TakeoffPage.tsx          ← Main canvas page (state hub)
            │   └── components/
            │       ├── TakeoffCanvas.tsx    ← react-konva canvas engine
            │       ├── TakeoffHeader.tsx    ← Toolbar bar + tabs + save
            │       ├── TakeoffToolbar.tsx   ← Right-side tool palette
            │       ├── LayerPanel.tsx       ← Left layer manager
            │       └── EstimatePanel.tsx    ← Cost estimate table + CSV
            └── admin/
                ├── AdminPage.tsx            ← Stats dashboard
                └── VersionHistoryPage.tsx   ← Git commit timeline + restore
```

---

## 4. Database Schema

### Entity Relationship Overview
```
Company ──< User ──< ProjectMember >── Project ──< Document ──< Layer ──< Shape
```

### Models

#### `User`
```prisma
id, email (unique), name, password (bcrypt), role (SUPER_ADMIN|ADMIN|MEMBER),
avatar?, companyId?, createdAt, updatedAt
```

#### `Company`
```prisma
id, name, logo?, website?, plan (starter|pro|enterprise), address?, phone?,
createdAt, updatedAt
→ has many: User, Project
```

#### `Project`
```prisma
id, name, description?, status (ACTIVE|ARCHIVED|COMPLETED), address?,
clientName?, thumbnail?, companyId, createdById, createdAt, updatedAt
→ has many: ProjectMember, Document
```

#### `ProjectMember`
```prisma
id, projectId, userId, role (ADMIN|EDIT|VIEW), createdAt
@@unique([projectId, userId])
```

#### `Document`
```prisma
id, name, fileUrl, fileType (pdf|image), fileSize?, pageCount,
scale (float, px-per-unit), unit (ft|m|in), projectId, createdAt, updatedAt
→ has many: Layer
```

#### `Layer`
```prisma
id, name, color (hex), type (AREA|LINEAR|COUNT), visible, order,
documentId, createdAt, updatedAt
→ has many: Shape
```

#### `Shape`
```prisma
id, type (RECT|POLYGON|LINE|CIRCLE), data (JSON string), label?,
color?, layerId, createdById?, createdAt, updatedAt

data examples:
  RECT:    {"x":100,"y":200,"width":300,"height":150}
  POLYGON: {"points":[x1,y1,x2,y2,...]}
  LINE:    {"points":[x1,y1,x2,y2]}
  CIRCLE:  {"x":150,"y":150,"radius":75}
```

---

## 5. API Reference

**Base URL:** `http://localhost:5000/api`
**Auth Header:** `Authorization: Bearer <jwt_token>`

### Auth
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| POST | `/auth/register` | — | Create account + company |
| POST | `/auth/login` | — | Login → returns JWT |
| GET | `/auth/me` | ✓ | Get current user |
| PUT | `/auth/me` | ✓ | Update name/avatar |
| PUT | `/auth/me/password` | ✓ | Change password |

### Projects
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/projects` | ✓ | List user's projects |
| POST | `/projects` | ✓ | Create project |
| GET | `/projects/:id` | ✓ | Get project (members + docs) |
| PUT | `/projects/:id` | ✓ EDIT | Update project |
| DELETE | `/projects/:id` | ✓ OWNER | Delete project |
| POST | `/projects/:id/members` | ✓ ADMIN | Invite member by email |
| PUT | `/projects/:id/members/:uid` | ✓ ADMIN | Change member role |
| DELETE | `/projects/:id/members/:uid` | ✓ ADMIN | Remove member |

### Documents
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/documents/project/:projectId` | ✓ | List documents |
| POST | `/documents/project/:projectId` | ✓ | Upload file (multipart) |
| GET | `/documents/:id` | ✓ | Get doc + layers + shapes |
| PUT | `/documents/:id` | ✓ | Update name/scale/unit |
| DELETE | `/documents/:id` | ✓ | Delete doc + file |

### Layers & Shapes
| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/layers/document/:docId` | ✓ | List layers with shapes |
| POST | `/layers/document/:docId` | ✓ | Create layer |
| PUT | `/layers/:id` | ✓ | Update layer |
| DELETE | `/layers/:id` | ✓ | Delete layer + shapes |
| POST | `/shapes/layer/:layerId` | ✓ | Create shape |
| POST | `/shapes/layer/:layerId/batch` | ✓ | Replace all shapes (auto-save) |
| PUT | `/shapes/:id` | ✓ | Update shape |
| DELETE | `/shapes/:id` | ✓ | Delete shape |

### Admin (ADMIN / SUPER_ADMIN only)
| Method | Endpoint | Description |
|---|---|---|
| GET | `/admin/stats` | Platform-wide counts + recent activity |
| GET | `/admin/git/log` | Local git log (last 20 commits) |
| POST | `/admin/git/restore/:hash` | Restore to commit hash |
| GET | `/admin/github/commits` | GitHub API commits |
| GET | `/admin/users` | All platform users |

### File Serving
| Path | Description |
|---|---|
| `GET /uploads/:filename` | Serve uploaded files (static) |
| `GET /api/health` | Health check |

---

## 6. Frontend Architecture

### Routing
```
/ → /dashboard (redirect)
/login          → LoginPage (public)
/signup         → SignupPage (public)
/dashboard      → DashboardPage (protected, AppLayout)
/projects/:id   → ProjectPage (protected, AppLayout)
/projects/:projectId/takeoff/:documentId → TakeoffPage (protected, fullscreen)
/admin          → AdminPage (protected, ADMIN+)
/admin/versions → VersionHistoryPage (protected, ADMIN+)
```

### State Management
- **`useAuthStore` (Zustand + persist)** — token, user, isAuthenticated. Persisted to localStorage under key `pt_auth`.
- **TanStack Query** — all server data (projects, documents, layers, shapes, admin stats). Query keys: `['projects']`, `['project', id]`, `['document', docId]`, `['admin-stats']`, `['git-log']`, `['github-commits']`.
- **Local component state** — drawing state, active tool, polygon points, undo/redo history.

### Code Splitting (Vite chunks)
- `react-vendor` — react, react-dom, react-router-dom
- `konva-vendor` — konva, react-konva
- `pdf-vendor` — pdfjs-dist
- `query-vendor` — @tanstack/react-query

---

## 7. Canvas Engine

### PDF Rendering Pipeline
```
1. pdfjs-dist.getDocument(url)         → PDF document object
2. pdf.getPage(pageNum)                → Page object
3. page.getViewport({ scale: 2 })      → Viewport at 2x for retina clarity
4. page.render({ canvasContext, viewport }) → Renders to offscreen <canvas>
5. canvas.toDataURL('image/png')       → Data URL
6. new Image() + img.src = dataUrl     → HTMLImageElement for Konva
7. <KonvaImage image={img} />          → Rendered in Konva background Layer
```

### Konva Stage Architecture
```
Stage (pan via draggable, zoom via wheel event)
  ├── Layer 0: Background
  │   └── KonvaImage (rendered PDF page)
  └── Layer 1: Drawing
      ├── ShapeRenderer × n  (saved shapes)
      ├── In-progress shape  (currentRect / currentLine / etc.)
      ├── Polygon preview    (line + dots while drawing)
      └── Calibration points (red dots + dashed line)
```

### Drawing Tool State Machine
```
Tool: rect / line / circle
  mousedown → isDrawing=true, setDrawStart(pos)
  mousemove → update currentShape with new dimensions
  mouseup   → if size > MIN_SIZE → onAddShape() → pushHistory()

Tool: polygon
  click     → append vertex to polygonPoints[]
  dblclick  → if points >= 3 → onAddShape() → reset polygonPoints[]

Tool: calibrate
  click ×2  → collect calibPoints[4]
  modal     → enter real-world distance
  confirm   → scale = pixelDist / realDist → onScaleChange()

Tool: pan
  Stage.draggable = true (Konva built-in)

Tool: select
  click shape → setSelectedId(id) → visual highlight
  click stage → deselect
```

### Coordinate System
- Stage is panned (x,y offset) and scaled independently
- Pointer position in canvas-space = `(pointer - stage.position) / stage.scale`
- All shape coordinates are in **canvas-space** (PDF pixel coordinates)
- Measurements converted to real units: `pixels / scale` (where scale = px per unit)

### Undo / Redo
- History = array of `CanvasShape[]` snapshots (max 50)
- `historyIndex` pointer for position in stack
- `pushHistory(shapes)` → trims future, appends, increments index
- `undo()` → decrement index, restore snapshot
- `redo()` → increment index, restore snapshot
- Auto-save fires 3 seconds after last shape change (`batchSave` API)

---

## 8. Authentication Flow

```
Signup:
  POST /auth/register { name, email, password, companyName }
  → Creates User + Company (ADMIN role)
  → Returns { token, user }
  → Stored in Zustand + localStorage

Login:
  POST /auth/login { email, password }
  → bcrypt.compare() validates password
  → Returns { token, user }
  → Stored in Zustand + localStorage

API Requests:
  Axios interceptor reads token from localStorage
  → Adds Authorization: Bearer <token> header

Token Expiry:
  If 401 received → clear token → redirect to /login
  Token validity: 24 hours (configurable via JWT_EXPIRES_IN)
```

---

## 9. User Roles & Permissions

### Platform Roles (User.role)
| Role | Capabilities |
|---|---|
| `SUPER_ADMIN` | Full platform access, all admin endpoints |
| `ADMIN` | Company admin, can see admin portal |
| `MEMBER` | Standard user |

### Project Roles (ProjectMember.role)
| Role | Capabilities |
|---|---|
| `ADMIN` | Full project access, invite/remove members, upload plans |
| `EDIT` | Draw shapes, edit measurements |
| `VIEW` | Read-only, can view plans and estimates |

---

## 10. Version History Feature

### Local Repository (via simple-git / child_process)
- `GET /admin/git/log` — runs `git log --pretty=format:...` in repo root
- Returns: commits[], currentBranch, currentHash, hasUncommittedChanges
- `POST /admin/git/restore/:hash` — runs `git stash && git checkout <hash>`

### GitHub Remote (via GitHub REST API)
- `GET /admin/github/commits` — fetches `GET /repos/{owner}/{repo}/commits`
- Owner/repo configurable via `GITHUB_OWNER` / `GITHUB_REPO` env vars
- Optional auth via `GITHUB_TOKEN` (higher rate limits)

### Frontend UI
- Toggle between Local / GitHub source
- Timeline view with current commit highlighted in blue
- Each commit shows: hash, message, author, date, branch refs
- Restore button (index > 0) → confirmation modal → POST to restore endpoint

---

## 11. Environment Variables

**File:** `backend/.env.local` (copy from `.env.example`)

| Variable | Required | Default | Description |
|---|---|---|---|
| `DATABASE_URL` | ✓ | `file:./prisma/dev.db` | Prisma DB connection |
| `JWT_SECRET` | ✓ | — | JWT signing secret (min 32 chars) |
| `JWT_EXPIRES_IN` | — | `24h` | Token expiry |
| `PORT` | — | `5000` | API server port |
| `NODE_ENV` | — | `development` | Environment |
| `FRONTEND_URL` | — | `http://localhost:5173` | CORS allowed origin |
| `GITHUB_TOKEN` | — | — | GitHub PAT for version history |
| `GITHUB_OWNER` | — | `git-jainamshah` | GitHub repo owner |
| `GITHUB_REPO` | — | `Protakeoff` | GitHub repo name |

---

## 12. Development Setup

### Prerequisites
- Node.js 20+ (`node -v`)
- npm 10+ (`npm -v`)
- Git

### One-Command Setup
```bash
git clone https://github.com/git-jainamshah/Protakeoff.git protakeoff-studio
cd protakeoff-studio
chmod +x setup.sh && ./setup.sh
```

### Manual Setup
```bash
# 1. Install all dependencies
npm install
cd backend && npm install && cd ..
cd frontend && npm install && cd ..

# 2. Create backend env file
cp backend/.env.example backend/.env.local

# 3. Run database migration
cd backend
DATABASE_URL="file:./prisma/dev.db" npx prisma migrate dev --name init
cd ..

# 4. (Optional) Seed demo data
npm run seed

# 5. Start dev servers
npm run dev
```

### Useful Commands
```bash
npm run dev              # Start frontend + backend concurrently
npm run dev-frontend     # Frontend only (Vite, :5173)
npm run dev-backend      # Backend only (nodemon, :5000)
npm run prisma:studio    # Open Prisma Studio DB GUI (:5555)
npm run prisma:migrate   # Run new migrations
npm run seed             # Seed demo admin account
```

---

## 13. Deployment Guide

### Backend (Node.js)
1. Set `DATABASE_URL` to a PostgreSQL connection string
2. Run `prisma migrate deploy` (not dev)
3. Set `NODE_ENV=production`
4. Set a strong `JWT_SECRET`
5. Deploy to: Railway, Render, Fly.io, or EC2

### Frontend (Vite SPA)
1. Run `npm run build` in `/frontend`
2. Deploy `/frontend/dist` to: Vercel, Netlify, or S3 + CloudFront
3. Set `VITE_API_URL` if API is on a different domain

### Database
- **Development:** SQLite (no setup required)
- **Production:** PostgreSQL (Supabase, Railway, Neon, AWS RDS)
- Migration: Change `DATABASE_URL` + `provider = "postgresql"` in `prisma/schema.prisma`

---

## 14. Feature Roadmap

### Phase 2 (Next)
- [ ] Shape editing (drag to move, handles to resize)
- [ ] PDF page thumbnails navigation sidebar
- [ ] Measurement label editing (double-click to rename)
- [ ] Shape count tool (point clicks for counting items)
- [ ] Export measurement plan as PDF (jsPDF)
- [ ] Keyboard shortcut overlay (? key)
- [ ] Dark/light theme toggle

### Phase 3
- [ ] Real-time collaboration (Socket.io)
- [ ] AI shape detection (Vertex AI integration — backend proxy ready)
- [ ] Estimate templates (save/reuse unit prices)
- [ ] Multiple PDF pages navigator
- [ ] Measurement scale per page (different pages may have different scales)
- [ ] Project activity feed / audit log

### Phase 4
- [ ] Mobile app (React Native)
- [ ] Integration with QuickBooks / Xero for invoicing
- [ ] API webhooks for external systems
- [ ] White-label / multi-tenant

---

## 15. Changelog

### v1.0.0 — 2026-03-06 (Initial Build)
**Architecture:** Full monorepo rebuilt from scratch

**Backend:**
- Express 5 + TypeScript + Prisma + SQLite
- JWT authentication (register, login, me, password change)
- Full project CRUD + member role management
- PDF/image file upload (multer, 100MB limit, local storage)
- Layer + shape CRUD with batch save for canvas auto-save
- Admin API: platform stats, local git log, GitHub commits API, version restore
- CORS, static file serving for uploads

**Frontend:**
- React 18 + Vite 6 + Tailwind CSS 3 (local, not CDN)
- React Router 7 with protected/public route guards
- Zustand auth store (persisted)
- TanStack Query v5 for all server state
- Full auth pages (Login + Signup with form validation)
- Dashboard with project grid, stats, search/filter
- Project page with document management + team member management with roles
- **Takeoff Canvas:** PDF.js rendering + react-konva drawing engine
  - Tools: Select, Pan, Rectangle, Polygon, Line, Circle, Scale Calibrator, Eraser
  - Layer panel with type indicators and live measurement totals
  - 50-step undo/redo history
  - Auto-save every 3 seconds via batch API
  - Keyboard shortcuts (V, H, R, P, L, C, M, ⌘Z, ⌘S)
- **Estimate Tab:** Cost table with unit price inputs + CSV export + grand total
- Admin portal with platform stats and recent activity
- Version History with local git log + GitHub remote commits, visual timeline, one-click restore

**Infrastructure:**
- Git remote: https://github.com/git-jainamshah/Protakeoff.git
- SQLite for local dev, Prisma ORM for easy PostgreSQL migration
- CREDENTIALS.local.txt (gitignored) for dev creds reference
- setup.sh for one-command project replication
