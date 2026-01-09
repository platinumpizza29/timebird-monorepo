# Web App Notes

Minimal orientation guide for the web UI (React + TanStack Router).

## Where to change things
- Pages live in `apps/web/src/routes/`.
- Shared UI lives in `apps/web/src/components/`.
- Data access lives in `apps/web/src/utils/orpc.ts`.
- Global styles and theme tokens live in `apps/web/src/index.css`.

## Shifts page pointers
- Calendar + day timeline: `apps/web/src/routes/calendar.tsx`.
- Shifts list + weekly summaries: `apps/web/src/routes/shifts.tsx`.
- Weekly Hours chart layout: `apps/web/src/routes/shifts.tsx`.

## Running locally
From the repo root:

```bash
bun run dev:web
```
