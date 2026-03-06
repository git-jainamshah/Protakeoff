# ProTakeOff — Database Directory

This folder is the **single source of truth** for the database design.
It is technology-agnostic — it describes *what* the data looks like, not *how* it is stored.

| File | Purpose |
|------|---------|
| [`DATABASE-ARCHITECTURE.md`](./DATABASE-ARCHITECTURE.md) | All entities, fields, types, relationships, and migration notes in plain language |
| [`ER-DIAGRAM.md`](./ER-DIAGRAM.md) | Visual entity relationship diagrams (Mermaid format) |

## Code implementation

The live schema is at `backend/prisma/schema.prisma` — always keep this in sync with the docs here.

## How to view the data

```bash
# Set your DATABASE_URL then:
cd backend
npx prisma studio
# Opens at http://localhost:5555
```

## Current database

| Property | Value |
|----------|-------|
| Type | PostgreSQL |
| Provider | Vercel Postgres (Neon) |
| ORM | Prisma v6 |
| Env var | `DATABASE_URL` (pooled) + `DIRECT_URL` (non-pooled for migrations) |
