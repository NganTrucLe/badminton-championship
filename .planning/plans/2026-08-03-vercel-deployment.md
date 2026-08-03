# Vercel Deployment Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Get the badminton-championship Next.js site live on Vercel with a production URL, auto-deploy on push to `main`, and per-branch preview deployments — with zero secrets to leak because the app currently has no backend.

**Architecture:** Vercel's native Git integration is the deployment mechanism. Vercel watches the GitHub repo `spartan-trucle/badminton-championship`; every push to `main` triggers a production build (`next build`), every push to a non-default branch / PR gets its own preview URL. No `vercel.json` is needed — Vercel auto-detects Next.js and runs the framework build. This is a mechanical/operational plan, not a code-writing one: "tests" here are verification commands and live-URL checks.

**Tech Stack:** Next.js 16.2.12 (App Router, Turbopack) · React 19 · Tailwind CSS 4 · TypeScript 5 · Vitest 4. Deploy target: Vercel (Hobby or Pro).

## Global Constraints

- **App is 100% frontend today.** No Supabase, no `.env`, no `process.env` usage anywhere in `app/`, `components/`, `contexts/`, `lib/`. `RefereeAuthContext` is demo-only ("DEMO · KHÔNG XÁC THỰC THẬT"); `MatchesContext` is mock data. **Deploying now ships a demo, not a real product.** No environment variables are required for this deployment.
- **Build gate:** `npm run build` MUST pass locally before any push. Verified passing on 2026-08-03 — all 6 routes (`/`, `/referee`, `/rules`, `/schedule`, `/teams`, `/_not-found`) prerender as static content.
- **All referenced `public/` assets must be committed** before connecting Vercel. Uncommitted files never reach a Git-integration build.
- **Never push to `main` without the build passing.** `main` is production and auto-deploys.
- **No secrets in the repo.** When Supabase lands later, keys go in Vercel's Environment Variables UI (or `vercel env`), never in committed files.
- **Node version:** Next 16 + React 19 require Node ≥ 18.18 (Node 20 LTS recommended). Vercel defaults to a recent LTS, but this plan pins it explicitly to avoid drift.
- **User-driven steps are marked `[USER ACTION]`.** These require the human's Vercel account / browser login and cannot be done by an agent or CLI without an auth token.

---

## File Structure

This deployment touches almost no code. Files created or modified:

- **Modify: `package.json`** — add an `engines.node` field to pin the Node major version Vercel uses. One responsibility: declare the runtime floor.
- **Create (optional): `.nvmrc`** — local Node version hint, keeps local dev aligned with Vercel. One responsibility: local toolchain pin.
- **Commit (not modify): `public/avatars/*.jpg`** — currently untracked; must be tracked so Vercel builds include them.
- **No `vercel.json`.** Deliberately omitted (YAGNI) — Vercel's zero-config Next.js detection is correct for this app. A `vercel.json` is added only if a future task needs redirects, headers, or region pinning.

Everything else (connecting the repo, first deploy, domain) is configuration performed in the Vercel dashboard or via the Vercel CLI, not files in this repo.

---

## Task 1: Pre-flight — commit assets and confirm the build gate

**Files:**
- Commit: `public/avatars/*.jpg` (currently untracked)
- Verify: `package.json` scripts (`build`, `lint`, `test`)

**Interfaces:**
- Consumes: nothing.
- Produces: a clean working tree on `main` where `git status` shows no untracked assets that the app references, and a green `npm run build`. Later tasks assume the pushed commit builds identically to local.

- [ ] **Step 1: List untracked files the app depends on**

Run: `git status --short`
Expected: several `?? public/avatars/*.jpg` lines. These are referenced by `components/PlayerAvatar.tsx` / team data — if they stay untracked, avatars 404 in production.

- [ ] **Step 2: Confirm every avatar the code references actually exists on disk**

Run:
```bash
grep -rEho "avatars/[a-zA-Z0-9_-]+\.(jpg|png|webp)" app components contexts lib | sort -u
ls public/avatars/
```
Expected: every filename from the first command appears in the `ls` output. If a referenced file is missing, STOP and get the asset before deploying — do not ship a broken image reference.

- [ ] **Step 3: Stage and commit the avatar assets**

```bash
git add public/avatars/
git commit -m "chore(deploy): track avatar assets for production build"
```

- [ ] **Step 4: Run the full local gate exactly as Vercel will**

Run: `npm run build`
Expected: `✓ Compiled successfully`, `✓ Generating static pages`, and a route table listing `/`, `/referee`, `/rules`, `/schedule`, `/teams`. Exit code 0. If this fails, fix it before proceeding — Vercel runs the identical command and will fail the deploy.

- [ ] **Step 5: Run lint and tests (secondary gates)**

Run: `npm run lint && npm run test`
Expected: lint clean; Vitest suite passes. These don't block a Vercel deploy by default but should be green before shipping. If tests fail, decide with the user whether to fix or proceed.

- [ ] **Step 6: Confirm the working tree is clean**

Run: `git status --short`
Expected: empty output (no untracked/modified files that belong in the build).

---

## Task 2: Pin the Node runtime

**Files:**
- Modify: `package.json` — add `engines` block
- Create: `.nvmrc`

**Interfaces:**
- Consumes: the committed repo from Task 1.
- Produces: an explicit Node floor Vercel reads at build time, so a Vercel default-Node change can't silently break the build.

- [ ] **Step 1: Add an `engines` field to `package.json`**

Add this top-level key (alongside `"private": true`):
```json
"engines": {
  "node": ">=20.0.0"
}
```
Rationale: Next 16 + React 19 require Node ≥ 18.18; Node 20 LTS is the safe production floor. Vercel honors `engines.node` when selecting the build image's Node major version.

- [ ] **Step 2: Create `.nvmrc` for local alignment**

Create `.nvmrc` with a single line:
```
20
```

- [ ] **Step 3: Re-run the build to confirm nothing broke**

Run: `npm run build`
Expected: same green output as Task 1 Step 4. The `engines` field does not change local behavior on a compatible Node but validates the JSON is well-formed.

- [ ] **Step 4: Commit**

```bash
git add package.json .nvmrc
git commit -m "chore(deploy): pin Node 20 runtime for Vercel"
```

- [ ] **Step 5: Push `main` to GitHub**

Run: `git push origin main`
Expected: push succeeds to `git@github.com:spartan-trucle/badminton-championship.git`. The repo is now in the state Vercel will import.

---

## Task 3: Connect the repo to Vercel and run the first production deploy

This task is primarily `[USER ACTION]` — it needs the human's Vercel account. An agent can substitute the CLI path (see Appendix A) if a `VERCEL_TOKEN` is available, but the dashboard Git integration is the recommended default because it wires up auto-deploy + previews in one step.

**Files:** none (Vercel-side configuration only).

**Interfaces:**
- Consumes: the pushed `main` branch from Task 2.
- Produces: a live production URL (e.g. `https://badminton-championship.vercel.app`) and a Vercel project linked to the GitHub repo. Task 4 verifies this URL.

- [ ] **Step 1: `[USER ACTION]` Sign in to Vercel with GitHub**

Go to https://vercel.com → Log in → continue with GitHub → authorize Vercel for the account that owns `spartan-trucle/badminton-championship`.

- [ ] **Step 2: `[USER ACTION]` Import the project**

Vercel dashboard → **Add New… → Project** → **Import Git Repository** → select `spartan-trucle/badminton-championship`. If the repo isn't listed, click **Adjust GitHub App Permissions** and grant access to that repo.

- [ ] **Step 3: `[USER ACTION]` Confirm the auto-detected settings — do not override**

On the import screen Vercel should show:
- **Framework Preset:** Next.js (auto-detected)
- **Build Command:** `next build` (default — leave blank/default)
- **Output Directory:** `.next` (default — leave blank/default)
- **Install Command:** `npm install` (default)
- **Root Directory:** `./` (the app is at repo root)
- **Environment Variables:** leave empty — this app needs none (Global Constraints).

Do not add a `vercel.json` or custom commands. Zero-config is correct here.

- [ ] **Step 4: `[USER ACTION]` Deploy**

Click **Deploy**. Watch the build log. Expected: the same `next build` output seen locally, ending in a successful deployment and a `*.vercel.app` URL. Build should take ~1–2 min.

- [ ] **Step 5: Verify the production alias exists**

Expected: the project's **Production Deployment** shows a green "Ready" status and a clickable domain like `https://badminton-championship.vercel.app`. Record this URL — Task 4 checks it. If the build failed, read the Vercel build log; the most likely causes are (a) an uncommitted asset — re-check Task 1, or (b) a Node mismatch — re-check Task 2.

---

## Task 4: Verify the deployed site end-to-end

**Files:** none (verification only).

**Interfaces:**
- Consumes: the production URL from Task 3.
- Produces: confirmation that every route, asset, and the demo interaction work in production — the actual definition of "deployed successfully."

- [ ] **Step 1: Verify all routes return 200**

Run (substitute the real URL):
```bash
BASE="https://badminton-championship.vercel.app"
for p in / /referee /rules /schedule /teams; do
  printf "%s -> " "$p"; curl -s -o /dev/null -w "%{http_code}\n" "$BASE$p"
done
```
Expected: `200` for every route.

- [ ] **Step 2: Verify avatar assets load (the Task 1 gotcha)**

Run:
```bash
# pick one real filename from `ls public/avatars/`
curl -s -o /dev/null -w "%{http_code}\n" "$BASE/avatars/truc-avatar.jpg"
```
Expected: `200`. A `404` means an asset wasn't committed — go back to Task 1 Step 3.

- [ ] **Step 3: Verify a 404 route behaves**

Run: `curl -s -o /dev/null -w "%{http_code}\n" "$BASE/does-not-exist"`
Expected: `404` (Next.js `_not-found` page).

- [ ] **Step 4: Manual visual check in a browser**

Open `$BASE` and click through all 5 nav pages. Confirm:
- Vietnamese copy renders with correct fonts/diacritics.
- Standings/schedule mock data displays.
- On `/referee`, the demo "Đăng nhập Google" button flips the signed-in state (client-side only — expected to reset on reload).
- No broken images, no console errors (open devtools → Console).

- [ ] **Step 5: Record the result**

Note the live URL and that all checks passed. Deployment of the current demo build is complete.

---

## Task 5 (Optional): Verify preview deployments on a branch

Do this to confirm the PR-preview workflow that matches the repo's `feature/*` branching convention.

**Files:** none.

**Interfaces:**
- Consumes: the linked Vercel project from Task 3.
- Produces: proof that non-`main` branches get isolated preview URLs, so future features can be reviewed live before merging.

- [ ] **Step 1: Create a throwaway branch and trivial change**

```bash
git checkout -b chore/verify-preview
# make a harmless change, e.g. bump a comment in README.md
git commit -am "chore: verify vercel preview deploy"
git push origin chore/verify-preview
```

- [ ] **Step 2: Open a PR (or check the branch) on GitHub**

Run: `gh pr create --draft --fill` (or open the branch in GitHub).
Expected: within ~1–2 min the Vercel bot comments with a **Preview** URL, distinct from production.

- [ ] **Step 3: Verify the preview URL loads**

Run: `curl -s -o /dev/null -w "%{http_code}\n" "<preview-url>"`
Expected: `200`, serving the branch's build — production is untouched.

- [ ] **Step 4: Clean up**

```bash
gh pr close --delete-branch chore/verify-preview   # or close the PR and delete the branch
```
Expected: branch removed; the preview deployment is torn down automatically by Vercel.

---

## Task 6 (Optional): Attach a custom domain

Only if the club has a domain to point at the site.

**Files:** none (Vercel + DNS configuration).

**Interfaces:**
- Consumes: the production deployment from Task 3.
- Produces: the site served from a custom domain over HTTPS.

- [ ] **Step 1: `[USER ACTION]` Add the domain in Vercel**

Vercel project → **Settings → Domains → Add** → enter the domain (e.g. `championship.example.com`).

- [ ] **Step 2: `[USER ACTION]` Configure DNS at the registrar**

Follow Vercel's shown records:
- Apex domain → `A` record to Vercel's IP, or Vercel nameservers.
- Subdomain → `CNAME` to `cname.vercel-dns.com`.

- [ ] **Step 3: Wait for DNS + SSL, then verify**

Expected: Vercel shows the domain as **Valid**, issues an SSL cert automatically. Then:
```bash
curl -s -o /dev/null -w "%{http_code}\n" "https://<your-domain>"
```
Expected: `200` over HTTPS.

---

## Task 7 (Future — do NOT do now): Environment variables for Supabase

This is a placeholder for when the app gains its Supabase backend (see `CLAUDE.md` "Stack (planned)"). **No action today** — the app has no env dependencies. Documented here so the deployment story is complete.

**When Supabase is added, before merging that feature:**

- [ ] Add these in **Vercel → Settings → Environment Variables** (one per environment: Production / Preview / Development):
  - `NEXT_PUBLIC_SUPABASE_URL` — safe to expose (public).
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY` — safe to expose (RLS-protected, public).
  - `SUPABASE_SERVICE_ROLE_KEY` — **server-only, never `NEXT_PUBLIC_`**; used only in server actions / route handlers. Setting this must never leak to the client bundle.
- [ ] Never commit any of these to the repo; `.env.local` stays gitignored.
- [ ] Re-verify that a production build with the vars set still passes before merging.

---

## Appendix A: CLI alternative to Task 3 (for automated / agent-driven deploy)

Use this instead of the dashboard when you have a Vercel token and want a scriptable path. Auto-deploy-on-push still requires linking the Git repo in the dashboard, so this is best for a one-off manual production deploy or CI.

- [ ] **Step 1:** `npm i -g vercel` (or use `npx vercel`).
- [ ] **Step 2:** `[USER ACTION]` `vercel login` (interactive) — or export `VERCEL_TOKEN` from https://vercel.com/account/tokens for non-interactive use.
- [ ] **Step 3:** From the repo root: `vercel link` → select scope + create/link project `badminton-championship`.
- [ ] **Step 4:** Deploy a preview: `vercel` → returns a preview URL. Verify it, then promote.
- [ ] **Step 5:** Deploy to production: `vercel --prod` → returns the production URL.
- [ ] **Step 6:** Run the Task 4 verification checks against the returned URL.

Note: even with the CLI, connect the GitHub repo in the dashboard afterward (Task 3) if you want automatic deploys on push — the CLI alone does not set up Git-triggered builds.

---

## Self-Review

**Spec coverage** (request = "deploy this website using Vercel"):
- Core deploy → Tasks 1–4 (commit assets, pin runtime, connect + deploy, verify). ✅
- Auto-deploy on push + previews → Task 3 (Git integration) + Task 5 (verify previews). ✅
- Custom domain → Task 6 (optional). ✅
- Secrets/env → Global Constraints + Task 7 (none needed now; future-proofed). ✅

**Placeholder scan:** No "TBD/handle appropriately" placeholders — every step has an exact command or exact UI path. Task 7 is explicitly labeled future/no-action, not a hidden gap. ✅

**Consistency:** Build command (`next build` / `npm run build`), the repo slug, the route list (`/`, `/referee`, `/rules`, `/schedule`, `/teams`), and the avatar-asset gotcha are referenced identically across Tasks 1, 3, and 4. ✅

**Known risk flagged:** Deploying now ships a demo (mock data + fake auth). This is called out in Global Constraints so the user makes that choice consciously rather than by accident.
