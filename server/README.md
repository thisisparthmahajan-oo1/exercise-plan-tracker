# Sync server

Offline-first sync backend for Exercise Logger. The phone's SQLite stays the
source of truth; this server keeps each account's latest copy of every row and
lets devices push/pull changes (last-write-wins per row).

- `POST /auth/session {token}` → device session. Single owner, same scheme as margin: one `APP_TOKEN`, entered once per device; the device keeps only an HMAC-signed session (1 year). No user accounts or session state on the server
- `POST /sync/push`, `GET /sync/pull?since=<cursor>` (Bearer token)
- `GET /health`

## Environment

| Var           | Notes                                                              |
| ------------- | ------------------------------------------------------------------ |
| `MONGODB_URI` | Atlas `mongodb+srv://…` string                                     |
| `MONGODB_DB`  | Database name, default `fitness` (created on first write)          |
| `APP_TOKEN`   | Access secret (`openssl rand -hex 24`, 24+ chars). Entered once in the app; changing it signs every device out |
| `PORT`        | Local only, default `8787`                                         |

Copy `.env.example` to `.env` for local use. `.env` is gitignored — never commit it.

## Local

```bash
npm install
npm run dev        # tsx watch, reads .env
npm test           # server tests + two-device client sync tests (in-memory Mongo)
```

## Deploy (Vercel)

1. Import the GitHub repo in Vercel and set **Root Directory** to `server`.
   Framework preset: Express (zero-config — `src/index.ts` default-exports the app).
2. Add the env vars above under Project → Settings → Environment Variables.
3. Atlas → Network Access must allow `0.0.0.0/0` (Vercel has no fixed IPs).
   Use a database user scoped to the `fitness` database only.
4. Deploy, then check `https://<project>.vercel.app/health`.
5. In the app repo root, set `EXPO_PUBLIC_SYNC_URL=https://<project>.vercel.app`
   in `.env.local` (gitignored), then rebuild the app. In the app: Settings →
   Account & Sync → paste `APP_TOKEN` → Connect.
