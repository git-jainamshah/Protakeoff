# ProTakeOff — Construction Takeoff & Estimation Platform

> **Industry-grade, browser-native construction quantity takeoff and cost estimation.**
> Upload PDFs, draw measurement shapes, calibrate scale, build estimates — all in one tool.

[![Node.js](https://img.shields.io/badge/Node.js-20+-339933?logo=nodedotjs)](https://nodejs.org)
[![React](https://img.shields.io/badge/React-18-61DAFB?logo=react)](https://react.dev)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6?logo=typescript)](https://typescriptlang.org)
[![Prisma](https://img.shields.io/badge/Prisma-6-2D3748?logo=prisma)](https://prisma.io)
[![SQLite](https://img.shields.io/badge/SQLite-dev-003B57?logo=sqlite)](https://sqlite.org)

---

## One-Command Setup

```bash
git clone https://github.com/git-jainamshah/Protakeoff.git protakeoff-studio
cd protakeoff-studio
chmod +x setup.sh && ./setup.sh
npm run dev
```

That's it. Open **http://localhost:5173** → sign up or use the demo credentials.

---

## Demo Login (after running `npm run seed`)
```
Email:    admin@protakeoff.dev
Password: ProTakeOff@2026
```
> Full credentials & server URLs in `CREDENTIALS.local.txt` (gitignored for safety).

---

## Tech Stack

| Layer | Technology |
|---|---|
| **Frontend** | React 18, TypeScript, Vite 6, Tailwind CSS 3 |
| **State** | Zustand (auth) + TanStack Query v5 (server) |
| **Canvas** | react-konva (Konva.js) + pdfjs-dist |
| **Forms** | react-hook-form + Zod |
| **Backend** | Node.js 20, Express 5, TypeScript |
| **ORM** | Prisma 6 |
| **Database** | SQLite (dev) → PostgreSQL (production) |
| **Auth** | JWT (24h tokens) + bcrypt password hashing |
| **File Upload** | multer (100MB limit, local storage) |

---

## Key Features

- **PDF Takeoff Canvas** — Upload construction plans and draw precision measurements
- **Drawing Tools** — Rectangle, Polygon, Line/Ruler, Circle, Scale Calibrator
- **Layer System** — Organize by type: Area, Linear, Count with live totals
- **Cost Estimator** — Add unit prices per layer → auto-calculate grand total → export CSV
- **50-Step Undo/Redo** + Auto-save every 3 seconds
- **User Auth** — JWT-based login/signup with company setup
- **Role-Based Access** — Project roles: Admin / Edit / View
- **Admin Portal** — Platform stats + user management
- **Version History** — Visual git commit timeline with one-click restore (local + GitHub)

---

## Project Structure

```
protakeoff-studio/
├── setup.sh              ← One-command setup script
├── ARCHITECTURE.md       ← Full technical reference (living doc)
├── CREDENTIALS.local.txt ← Dev credentials (gitignored)
├── backend/              ← Express API + Prisma + SQLite
│   ├── .env.example      ← Environment template
│   ├── prisma/           ← Schema + migrations + seed
│   └── src/              ← Routes, middleware, lib
└── frontend/             ← React + Vite SPA
    └── src/              ← Pages, components, canvas engine
```

---

## Manual Setup (step by step)

```bash
# 1. Clone
git clone https://github.com/git-jainamshah/Protakeoff.git protakeoff-studio
cd protakeoff-studio

# 2. Install all dependencies
npm install
npm install --prefix backend
npm install --prefix frontend

# 3. Environment setup
cp backend/.env.example backend/.env.local
# Edit backend/.env.local — update JWT_SECRET for production

# 4. Database
cd backend
DATABASE_URL="file:./prisma/dev.db" npx prisma migrate dev --name init
cd ..

# 5. (Optional) Seed demo data
npm run seed

# 6. Start
npm run dev
```

---

## Available Scripts

```bash
npm run dev              # Start frontend (:5173) + backend (:5000)
npm run dev-frontend     # Frontend only
npm run dev-backend      # Backend only
npm run seed             # Create demo admin account
npm run prisma:studio    # Open Prisma DB GUI (:5555)
npm run prisma:migrate   # Run pending migrations
npm run build            # Production build (frontend)
```

---

## Switching to PostgreSQL (Production)

1. Change `backend/.env.local`:
   ```
   DATABASE_URL="postgresql://user:password@host:5432/protakeoff"
   ```
2. Change `backend/prisma/schema.prisma`: `provider = "postgresql"`
3. Run: `npx prisma migrate deploy`

---

## Architecture Deep-Dive

See **[ARCHITECTURE.md](./ARCHITECTURE.md)** for the full technical reference including:
- Complete database schema (ER diagram + model details)
- API endpoint documentation
- Canvas engine architecture (PDF.js pipeline + Konva stage)
- Auth flow, role permissions
- Version history feature internals
- Deployment guide
- Feature roadmap

---

## License

Proprietary — © 2026 ProTakeOff · All rights reserved.
