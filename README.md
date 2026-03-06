# ProTakeOff — Construction Estimation Platform

> Industry-grade web application for construction engineering project takeoff & cost estimation. Upload PDF plans, draw precise measurements directly on plans, manage projects across teams, and export detailed estimates.

---

## ✨ Key Features

| Feature | Description |
|---|---|
| **PDF Plan Viewer** | Upload multi-page PDF construction plans; pages render fast with lazy loading & session caching |
| **Interactive Canvas** | Draw rectangles, polygons, lines, circles, freehand areas & text annotations directly over plans |
| **Smart Tools** | Auto-scale calibration, auto-detect room boundaries, count markers, freeform shapes |
| **Shape Editing** | Select & resize any shape using corner/edge handles; move shapes by dragging |
| **Layer System** | Organise measurements into named layers (Area / Linear / Count types) with colour coding |
| **Live Estimates** | Measurements auto-calculate into a cost estimate panel with per-layer totals |
| **Role-Based Access** | Platform roles (SUPER_ADMIN / ADMIN / MEMBER) + per-project roles (Admin / Edit / View) |
| **Version History** | Full GitHub-backed version control — browse commits, one-click revert up to any point |
| **Admin Portal** | Platform stats, user management, project overview |
| **Auto-Save** | Changes debounce-save to the server every 3 seconds |

---

## 🛠 Tech Stack

### Frontend
| Technology | Version | Purpose |
|---|---|---|
| React | 18 | UI framework |
| TypeScript | 5 | Type safety |
| Vite | 6 | Build tool & dev server |
| Tailwind CSS | 3 | Utility-first styling |
| React Router | 7 | Client-side routing |
| Zustand | latest | Auth & global state |
| TanStack Query | v5 | Server state & caching |
| react-konva | latest | Canvas drawing engine |
| pdfjs-dist | latest | PDF rendering |
| Lucide React | latest | Icon set |
| react-hook-form + Zod | latest | Forms & validation |

### Backend
| Technology | Version | Purpose |
|---|---|---|
| Node.js | 20 | Runtime |
| TypeScript | 5 | Type safety |
| Express | 5 | HTTP server |
| Prisma | 6 | ORM & migrations |
| SQLite | — | Database (dev); swap for PostgreSQL in prod |
| JWT + bcryptjs | — | Authentication |
| Multer | — | File upload handling |
| simple-git | — | Git operations for version history |

---

## 🚀 Quick Start (One Command)

```bash
# Clone and run in one shot
git clone https://github.com/git-jainamshah/Protakeoff.git && cd Protakeoff && bash setup.sh
```

Then open **http://localhost:5173**

---

## 🔧 Manual Setup

### Prerequisites
- Node.js 20+
- npm 9+
- Git

### Steps

```bash
# 1 — Clone
git clone https://github.com/git-jainamshah/Protakeoff.git
cd Protakeoff

# 2 — Install all dependencies (root + frontend + backend)
npm install
npm install --prefix frontend
npm install --prefix backend

# 3 — Configure backend environment
cp backend/.env.example backend/.env.local
# Edit backend/.env.local if needed (defaults work out of the box)

# 4 — Set up the database & seed demo data
cd backend
DATABASE_URL="file:./prisma/dev.db" npx prisma migrate dev --name init
DATABASE_URL="file:./prisma/dev.db" npx prisma db seed
cd ..

# 5 — Start both servers
npm run dev
```

| URL | Service |
|---|---|
| http://localhost:5173 | Frontend |
| http://localhost:3001 | Backend API |
| http://localhost:3001/api/health | Health check |

---

## 🔑 Default Login

```
Email    : admin@protakeoff.dev
Password : ProTakeOff@2026
Role     : SUPER_ADMIN
```

---

## 📁 Project Structure

```
protakeoff-studio/
├── frontend/                   # React + Vite app
│   ├── src/
│   │   ├── components/         # Shared UI components
│   │   ├── lib/                # API client, utils, auth store
│   │   ├── pages/              # Route-level pages
│   │   │   ├── auth/           # Login, Signup
│   │   │   ├── admin/          # Admin Portal, Version History
│   │   │   └── takeoff/        # Canvas editor + tools
│   │   └── types/              # TypeScript type definitions
│   ├── public/                 # Static assets (favicon, etc.)
│   └── tailwind.config.ts
│
├── backend/                    # Express + Prisma API
│   ├── src/
│   │   ├── routes/             # auth, projects, documents, shapes, layers, admin
│   │   ├── middleware/         # JWT auth, role guards
│   │   └── server.ts           # Entry point
│   └── prisma/
│       ├── schema.prisma       # Database schema
│       └── seed.ts             # Demo data seeder
│
├── setup.sh                    # One-command setup script
├── package.json                # Root — runs both servers via concurrently
└── README.md
```

---

## 🌍 Environment Variables

| Variable | Default | Description |
|---|---|---|
| `DATABASE_URL` | `file:./prisma/dev.db` | Database connection string |
| `JWT_SECRET` | *(see .env.example)* | JWT signing secret — **change in production** |
| `PORT` | `3001` | Backend port |
| `FRONTEND_URL` | `http://localhost:5173` | CORS allowed origin |
| `GITHUB_TOKEN` | *(optional)* | PAT for Version History GitHub integration |
| `GITHUB_REPO` | *(optional)* | `owner/repo` for Version History |

---

## 🔄 Version History

ProTakeOff has a built-in **Git-backed version control** panel (Admin → Version History):
- Displays up to the last 20 commits
- One-click revert to any previous version
- Shows commit author, message, date, and hash

To enable: set `GITHUB_TOKEN` and `GITHUB_REPO` in `backend/.env.local`.

---

## 🚢 Production Notes

Before deploying to production:

1. Set a strong `JWT_SECRET` (64+ random characters)
2. Switch `DATABASE_URL` to a PostgreSQL connection string
3. Update `FRONTEND_URL` to your production domain
4. Configure file storage (AWS S3 / Cloudinary) for uploaded PDFs
5. Set `NODE_ENV=production`
6. Add `GITHUB_TOKEN` for version history

---

## 📄 License

MIT — build freely.
