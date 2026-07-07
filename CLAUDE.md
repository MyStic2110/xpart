# Xpart Automotive — project context

Commercial multi-tenant SaaS for Indian car/bike wash + detailing + service businesses (target 10k users, multi-branch). Real first customer: **Xpart Automotive**, Chennai. Working dir `D:\Claude Projects\xpart`.

**Product principle: "not CRUD" — intelligence + automation that helps the owner _make_ revenue, not just record it.** Flagship = the Client 360° predictive sales queue. Master-data screens (vehicle make/model, products) are intentionally plain CRUD; the operational/transactional layer is where intelligence lives.

---

## Stack
- **Backend**: Node + TypeScript + **Fastify** + **Drizzle ORM** + **Postgres** (`postgres` driver). Zod, JWT, bcryptjs, `@fastify/multipart` + `@fastify/static` (uploads → `uploads/` volume).
- **Frontend**: Vite + React 18 + TS + **Tailwind** (charcoal/slate/accent-blue, Inter) + react-router-dom + **lucide-react** (outline icons).
- **Docker Compose**: `db` (5432), `backend` (3000), `frontend` (5173). `./src` and `./frontend/src` volume-mounted for live reload.
- tsconfig `moduleResolution: "Bundler"`; **no `.js` extensions** on relative imports (drizzle-kit bundler breaks on them).

## Multi-tenancy & RBAC
`organizations → branches → staff_assignments`. `staff_assignments.branchId NULL = org-wide` (org_owner). Every table has `orgId`; isolation enforced in every query. JWT: `{ userId, orgId, assignments:[{branchId, role}] }`. Roles: `super_admin, org_owner, admin, branch_manager, frontdesk, mechanic, viewer`. Middleware in `src/middleware/auth.ts`: `requireAuth`, `requireRole(...)`, `effectiveBranchIds`.

## Money
**Integer paise everywhere** (DB + API). Frontend ÷100 to show, ×100 on submit. Never floats.

---

## Modules (backend `src/modules/*`, frontend `src/pages/*`, routes wired in `src/app.ts` / `frontend/src/App.tsx`)
- **auth** — org signup (org+branch+owner+JWT), phone+password login, `/me`.
- **branches** — CRUD, owner-gated (name, salonName, city, logo, phone, email, website, gstNumber, workingHours, status, + loyalty config: loyaltyPointsEnabled / pointsPerThousand / redeemPaisePerPoint). Also hosts the org-wide `walletEnabled` master switch (`PATCH /org/settings`). **System Settings** business-profile fields also live on the branch: facebookUrl / instagramUrl / youtubeUrl / googleMapsUrl, loginBgUrl, openingTime / closingTime, `workingDays` (jsonb per-day {day,open,close,closed}), extraHoursEnabled, dayEndReportTime — all edited from the **Software setting** page (`SoftwareSettings.tsx`, `/settings/software`) with a branch picker. `logoUrl`/`website` are lenient strings (uploaded `/uploads/..` paths + scheme-less domains), not strict URLs. NOTE: loginBgUrl, extraHoursEnabled and dayEndReportTime are stored but not yet applied (login screen still static; no report scheduler).
- **staff** — Add Mechanic / Add Staff → `users` + `staff_assignments` + `staff_profiles` (commission %, salary, hours, DOB). Branch required. Photo/ID upload.
- **attendance + payroll** — attendance (present/half_day/absent/leave/lop); payroll = base − LOP deduction + service commission (revenue via `job_card_mechanics→job_cards→invoices`). Yearly hours chart.
- **catalog (vehicle make/model)** — global shared (`orgId NULL`, 51 makes/271 models) + per-org custom.
- **services** — name, defaultPrice, `recurrenceDays` (wash 30 / polish 90 / ppf 365) → drives Client 360.
- **clients** — list w/ aggregates, `/clients/:id` detail, `/clients/:id/360`, phone search/autocomplete, find-or-create by phone. `clients.clientType`: `customer` (default) | `third_party` — a **vendor** (e.g. a mechanic) who brings in customer vehicles daily on a credit tab. Third-party: NO loyalty points earn, NO points redeem, NO wallet payments (enforced in invoices service), NO offers (360 returns `offers: []`; job-card create rejects `appliedOfferId`); dues tracked per open invoice (draft/partial) and closed vehicle-by-vehicle via normal invoice payments — **vehicle number (plate) is the tracking key**; the ClientDetail credit ledger is grouped by plate with per-plate subtotals. "Add client" modal on Clients page (type picker + tabs + Credit-due column); vendor credit ledger on ClientDetail; dashboard shows vendor credit due / collected-this-month / vendor count, and `totalClients` excludes third_party.
- **jobcards** — Create Job Card (phone autocomplete → find/create client+vehicle, line items, discount, 0/18% tax, images). draft→in_progress→completed→billed. `POST /job-cards/:id/complete` → draft invoice.
- **invoices (billing)** — payment collection (cash/upi/card/wallet/**points**; wallet debits client wallet); partial→paid; full pay flips job card to `billed` and updates client spend.
- **loyalty points (wallet)** — every cash/UPI/card payment earns points = `floor(₹collected/1000 × branch.pointsPerThousand)`; wallet & points payments earn nothing (no double-dip). Points redeemed against an invoice balance at `branch.redeemPaisePerPoint` (₹/point), settled as a `points`-mode payment so invoice totals stay immutable. Gated by org `walletEnabled` master switch AND branch `loyaltyPointsEnabled`. Audit trail in `points_transactions` (earn/redeem/adjust). Config is owner-editable on the Branches page; a real super_admin cross-org owner of `walletEnabled` is still a stub.
- **sales (Client 360°)** — THE intelligence module. `refreshSalesActions` scans completed/billed job cards for recurring services, due = lastVisit + recurrenceDays (7-day lookahead), opens `sales_actions`. Queue sorted by closeness to expiry ("expiring today" top), Call/WhatsApp CTAs, outcome logs, appointment booking (completing it auto-closes the action). Shows missed/potential recurring revenue.
- **connectors** — config-only integrations hub: Exotel, Knowlarity (telephony), WhatsApp Cloud, Gupshup (messaging), Google Cloud Translation (localization — Indian-language config: target/source language + NMT model via `select` fields). Registry in `src/modules/connectors/registry.ts` (field types: text/password/**select** with options); secrets masked on read. **Adapters don't execute yet.**
- **dashboard** — `/dashboard/metrics` single SQL round-trip, branch-aware. Includes `segmentation` (customers only, by visit recency: existing = all, active ≤60d, churnRisk 61–180d, defected >180d/never) rendered as a "Clients segmentation" card row, plus third-party vendor metrics (credit due / collected month / count). Plus `/dashboard/forecast` — **least-squares linear-trend projection** (day/week/month, next 12 periods) of revenue (from payments) and new-customer acquisitions (from each client's first job-card date — `clients.created_at` is a bulk-import stamp, unusable). Zero-filled buckets, leading-zeros trimmed, mild residual-error band. Logic in `src/modules/dashboard/forecast.ts`; rendered by `frontend/src/components/ForecastChart.tsx` (hand-rolled SVG, history solid + forecast dashed + band + "now" divider).
- **products** — CRUD (admin-gated), 64 seeded.
- **inventory** — `inventory_lots` (lotNo, source vendor/client/mechanic, invoiceNo, isCredit/total/paid, vendorId) + `inventory_items` (qty/unit/purchasePrice/salePrice/expiry/vehicleId/vendorPaidStatus). Supports link to vendor, item cost/sale price, and customer vehicle autocomplete link. Tagging a vehicle auto-creates or appends the item to its active/draft job card. Available / expired tabs. 41 lots/93 items seeded.
- **vendors** — CRUD for suppliers (`vendors` table). Displays vendor ledger showing outstanding parts credit matched to customer vehicle plate numbers, customer invoice payment statuses (paid/unpaid), and markup margins. Supports full or partial payments distributed sequentially across unpaid lots.
- **enquiry** — lead intake + tracker (enquiry-for autocomplete, type, source, lead rep, status, SMS/WhatsApp channel, vehicle). Branch-stamped.
- **expenses** — branch-scoped spend tracking. `expense_categories` (org-wide shared master list — Daily expenses/Staff expenses/Parts/Job work/…, admin/manager-gated writes) + `expenses` (branch-stamped: date, categoryId=Type, amount paise, paymentMode **free text** e.g. "Cash"/"Online payment" — NOT an enum, source apps vary, recipient=paid-to, paidBy **free text** e.g. "Admin" — NOT a user FK, notes). Deleting a category nulls `expenses.category_id` (history kept). Page `Expenses.tsx` (`/expenses`): Date/Type/Amount/Payment mode/Recipient/Paid by/Action table + running total, "Add expense" + "Manage categories" drawers. Seeded from a real June-2026 report (92 rows ~₹2.23L). Plain spend ledger — not intelligence (yet).
- **calendar (Planner)** — owner planning calendar (`src/modules/calendar/*`, page `Calendar.tsx` at `/calendar`, sidebar "Planner"). Month grid: past days = revenue heatmap (sky tint) + job-card/appointment/expense dots; future days = expected-demand tint (peak/busy/slow). Intelligence: weekday indexes learned from own last-180-day payments; Indian festival dataset in `holidays.ts` (static 2026–27, lunar dates approximate — `washRush` flags pre-festival car-wash rush ×1.35–1.6, long weekends ×1.2); rain forecast via **Open-Meteo (free, keyless)** in `weather.ts` — static lat/lon map for major Indian cities (geocoding subdomain is DNS-flaky on Indian ISPs; only unknown cities hit it, 4s timeout), 3h in-memory cache, degrades to null gracefully. Rain ≥70% ×0.4, 40–69% ×0.7. Per-day drivers + actionable tips; "insights" strip (rush windows, rain days, strongest-weekday pattern). Future days carry `expectedRevenue` (score × own 180d avg daily collection) shown as ~₹ in cells; response also has `summary` {monthToDate, projected, prevMonthRevenue, bestDay, next7Expected} → dark gradient hero band + "Week ahead" chip strip + hover tooltips per cell. Day click → `GET /calendar/day` panel (job cards, appointments, expenses, payments by mode).
- **cameras** — per-branch CCTV/IP camera config (`src/modules/cameras/routes.ts`, table `branch_cameras`, page `CameraSettings.tsx` at `/settings/cameras`, sidebar Settings → Cameras). Fields: name, placement inside|outside, provider, streamUrl, username/password (masked `••••••` on read; masked value on PATCH won't overwrite secret), aiEnabled, notes, status. Provider registry in-route: hikvision/dahua/cpplus/tplink_tapo/generic_rtsp (RTSP — `browserPlayable:false`, need go2rtc/mediamtx gateway for live view/AI) + mjpeg_http/hls/device_webcam (playable). Writes: owner/admin/branch_manager. **AI layer = MediaPipe Tasks Vision loaded from jsDelivr CDN at runtime (no npm dep/rebuild)** — in-browser ObjectDetector (efficientdet_lite0 from storage.googleapis.com), person+vehicle counts with live boxes, currently sourced from the device webcam; IP-cam AI awaits a stream gateway. Endpoints: `GET /cameras?branchId=` (providers+cameras), `POST /cameras`, `PATCH/DELETE /cameras/:id`.
- **feedback** — reviews (rating/comment/source/reply); `/feedback/import` with externalId dedup for Google reviews via Places API / paid service.

## Branch switcher (cross-cutting)
`frontend/src/BranchContext.tsx` → `{branchId, branchParam, branches, setBranchId}` (localStorage). Dropdown at top of Sidebar ("Viewing").
- **Branch-filtered (operational):** dashboard, job cards, billing, client 360, inventory, enquiry, expenses.
- **Org-wide / shared (settings):** branches, staff, vehicle catalog, products, connectors, software settings, clients, feedback, expense categories.
- Backend endpoints accept `?branchId=` and filter when present.

---

## API endpoints
All under base `/` (frontend calls via `/api/*` Vite proxy). All except `/health`, `/auth/*` require `Authorization: Bearer <jwt>`. Operational list/summary endpoints accept optional `?branchId=<id>` (omit or `all` = org-wide).

**Auth & session**
- `GET  /health`
- `POST /auth/signup` — create org+branch+owner, returns JWT
- `POST /auth/login` — phone + password → JWT
- `GET  /me` — user, org, roles, branches

**Branches & org settings** (writes: org_owner)
- `PATCH /org/settings` — toggle org-wide `walletEnabled` (loyalty master switch)
- `GET  /branches`
- `POST /branches`
- `PATCH /branches/:id`

**Staff / users** (writes: org_owner, admin, branch_manager)
- `GET  /staff`
- `POST /staff/mechanics`
- `POST /staff/members`
- `POST /uploads` — multipart file (photo/ID), returns `{url}`

**Attendance & payroll**
- `POST /attendance` — mark (self, or manager for others)
- `GET  /attendance` — `?userId=&from=&to=`
- `GET  /attendance/summary` — `?userId=&year=` (12-month chart)
- `GET  /payroll/:userId/:month/preview` (owner/admin)
- `POST /payroll/:userId/:month/finalize` (owner/admin)
- `GET  /payroll/:userId/history`

**Vehicle catalog** (writes: org_owner, admin; global entries undeletable)
- `GET  /vehicle-makes` · `POST /vehicle-makes` · `DELETE /vehicle-makes/:id`
- `GET  /vehicle-models` · `POST /vehicle-models` · `DELETE /vehicle-models/:id`

**Services** (writes: org_owner, admin, branch_manager)
- `GET  /services`
- `POST /services`
- `PATCH /services/:id` — set `recurrenceDays`

**Clients**
- `GET  /clients` — list with aggregates (incl. `clientType`, `outstanding` credit paise)
- `POST /clients` — add client directly (name, phone, `clientType: customer|third_party`, …); dedup/update by phone. New customers trigger a WhatsApp referral invite ("invite friends, both get 500 pts on friend's first billing" + their referralCode) via `src/modules/connectors/whatsapp.ts` — template/trigger/provider-lookup live, actual HTTP send is a marked TODO until client activates whatsapp_cloud/gupshup; response carries `referralInvite: {sent, provider, reason, message}`. Same invite fires for first-time clients created via job cards. `POST /clients` also accepts `referredByCode` (another client's referralCode → sets `referredByClientId`; first attribution wins, self-referral ignored) — captured via an optional field in the Add-client modal. ClientDetail has a manual wa.me "Referral invite" header button plus a **Referral programme** card (customers only): code + "Send to customer" wa.me trigger, "Referred by" link, and per-referral status (Billed ✓ w/ date vs Joined · not billed yet); detail payload carries `referredBy` + `referrals[]` (hasBilled = any paid invoice).
- `GET  /clients/search?q=` — phone/name autocomplete
- `GET  /clients/:id` — detail (visits, vehicles, spend; + `credit` ledger for third_party)
- `GET  /clients/:id/credit` — open (draft/partial) invoices per vehicle + totalOutstanding
- `GET  /clients/:id/360` — 360 summary

**Job cards**
- `GET  /job-cards` — `?branchId=`
- `POST /job-cards` — create (find/create client+vehicle + line items)
- `GET  /job-cards/:id` — detail
- `POST /job-cards/:id/complete` — mark completed + generate draft invoice

**Billing / invoices**
- `GET  /invoices` — `?branchId=`
- `GET  /invoices/:id` — detail (line items, payments, balance, wallet, points balance, loyalty config)
- `POST /invoices/:id/payments` — record payment (cash/upi/card/wallet); cash/upi/card auto-earn loyalty points
- `POST /invoices/:id/redeem-points` — redeem `{points}` against balance at branch ₹/point rate

**Client 360° / sales (intelligence)** — `?branchId=` on list
- `POST /sales-actions/refresh` — recompute due follow-ups
- `GET  /sales-actions` — `?status=&branchId=`
- `GET  /sales-actions/:id/logs`
- `POST /sales-actions/:id/outcome` — contacted/booked/rescheduled/declined/closed
- `GET  /appointments`
- `POST /appointments/:id/status` — confirmed/completed/cancelled/no_show

**Dashboard**
- `GET  /dashboard/metrics` — `?branchId=` (single SQL round-trip)
- `GET  /dashboard/forecast` — `?granularity=day|week|month&branchId=` — 12-period revenue + new-customer trend forecast

**Calendar / planner**
- `GET  /calendar` — `?month=YYYY-MM&branchId=` — day aggregates, dowStats, holidays, weather, demand[], insights[]
- `GET  /calendar/day` — `?date=YYYY-MM-DD&branchId=` — that day's job cards, appointments, expenses, payments by mode

**Products** (writes: super_admin, org_owner, admin)
- `GET  /products` · `POST /products` · `PATCH /products/:id` · `DELETE /products/:id`

**Inventory** (writes: super_admin, org_owner, admin, branch_manager)
- `GET  /inventory/items` — `?filter=available|expired|all&branchId=`
- `GET  /inventory/summary` — `?branchId=`
- `POST /inventory/lots` — record a purchase (lot + items + source/credit/invoice + vendorId + vehicleId)
- `POST /inventory/lots/:id/pay` — record credit payment

**Vendors & Credit Matching** (writes: super_admin, org_owner, admin, branch_manager)
- `GET  /vendors` — list all vendors
- `POST /vendors` — create vendor
- `PATCH /vendors/:id` · `DELETE /vendors/:id`
- `GET  /vendors/:id/ledger` — get credit purchase ledger matched to plate numbers
- `POST /vendors/:id/pay-vehicle` — record partial or full credit payment to vendor for a vehicle
- `GET  /vehicles/search` — search vehicles by plate number


**Enquiry (leads)**
- `GET  /enquiries` — `?branchId=&status=&type=&source=&rep=&from=&to=&enquiryFor=`
- `POST /enquiries`
- `PATCH /enquiries/:id` — status/response/follow-up/rep

**Feedback / reviews**
- `GET  /feedback` — `?source=`
- `GET  /feedback/summary` — avg rating, counts
- `POST /feedback`
- `PATCH /feedback/:id/reply` (writes: manager+)
- `POST /feedback/import` — bulk import with externalId dedup (Google/paid service)

**Cameras** (writes: org_owner, admin, branch_manager)
- `GET  /cameras` — `?branchId=` — provider registry + cameras (passwords masked)
- `POST /cameras` · `PATCH /cameras/:id` · `DELETE /cameras/:id`

**Connectors** (writes: super_admin, org_owner, admin)
- `GET  /connectors` — registry + saved (secrets masked)
- `PUT  /connectors/:provider` — save/update config
- `DELETE /connectors/:provider`

**Expenses** — categories org-wide (writes: org_owner/admin/branch_manager); expense writes: any authed staffer. List/summary accept `?branchId=`
- `GET  /expense-categories` · `POST /expense-categories` · `PATCH /expense-categories/:id` · `DELETE /expense-categories/:id`
- `GET  /expenses` — `?branchId=&categoryId=&mode=&from=&to=`
- `GET  /expenses/summary` — `?branchId=` (count, all-time total, this-month total — paise)
- `POST /expenses` · `PATCH /expenses/:id` · `DELETE /expenses/:id`

---

## Run / iterate
- Start: `docker compose up -d --build`. Health `curl localhost:3000/health`; UI `localhost:5173`.
- Backend dep/schema change needing node_modules: `docker compose up -d --build backend`. Plain `src` edits hot-reload — but **new files + their `app.ts` registration may not be picked up by the watcher; `docker compose restart backend` if a freshly-added route 404s**.
- Frontend deps added → rebuild frontend container; otherwise hot-reload.

## Migrations (Drizzle)
- Generate (host): `npx drizzle-kit generate --name=<desc>` — **always `--name`, avoid column renames** (interactive prompt can't take piped input here; split into drop-then-add or hand-write SQL).
- Apply: `docker compose exec backend npm run db:migrate`. Files in `src/db/migrations/`.
- NOT NULL on populated table → hand-edit SQL to backfill first.

## Seed / import
- **`package.json` is NOT mounted into the container (only `./src`)** → run seeds with `docker compose exec backend npx tsx src/db/<script>.ts`.
- Scripts: `seed-catalog.ts`, `import-xpart.ts`, `backfill-imported-payments.ts`, `seed-products.ts`, `seed-inventory.ts`, `seed-expense-categories.ts` (8 standard buckets, idempotent), `seed-expenses.ts` (92 June-2026 expenses from `xpart-expenses.json`; idempotent replace-in-date-range, stamps to org's primary branch). Source JSON in `src/db/xpart-*.json`.
- Loaded real data: 294 clients, job cards + paid invoices (~₹8.96L historical, dated at real visit dates), 64 products, 41 lots/93 items, services w/ recurrence.

## Test credentials (dev)
- `9999999999` / `secret123` — **Test Owner**, org "Xpart Automotive" (all seeded data). Use this.
- `8888888888` / `secret123` — "Test Workshop 2" (empty, tenant-isolation checks).
- `/login` has a DEV-only quick-login panel.

---

## Gotchas already fixed — do NOT regress
1. **`crypto.randomUUID()` crashes over LAN HTTP** (non-secure context). Use `uid()` from `frontend/src/utils/id.ts`.
2. **Bodyless POST must NOT send `Content-Type: application/json`** (Fastify 400 `FST_ERR_CTP_EMPTY_JSON_BODY`). `frontend/src/api.ts` `request()` only sets it when a body exists.
3. **Vite needs `server.watch.usePolling`** (set in `frontend/vite.config.ts`) for Docker-on-Windows file watching.
4. **`FloatingInput`** keeps label pinned for `date/time/month/week` (they show their own placeholder).
5. **`tsc --noEmit` passes but Vite/Babel catches JSX nesting.** After big JSX edits, verify: `curl "http://localhost:5173/src/pages/<X>.tsx?t=$(date +%s)"` → 200, and check `docker compose logs frontend --tail` for `Internal server error`.

## Verification discipline (expected)
Never claim success without checking. Backend: `curl` + bearer token. Frontend: `curl` page (200) + `/src/...tsx` transform (200). Be honest about stubs/missing data — don't fabricate (e.g. Google reviews can't be scraped; connectors don't execute yet).

## Known stubs / next steps
- Connectors store config but don't execute (no real Exotel call / Gupshup send). Exception scaffolding: `connectors/whatsapp.ts` `sendWhatsApp()` resolves the org's active WhatsApp provider and returns `{sent:false, reason: connector_not_configured | adapter_not_activated}` — the real API call is a single marked TODO (payload shapes for whatsapp_cloud & gupshup documented inline).
- Referral rewards NOT implemented: invite message promises 500/500 points on friend's first billing, but there's no referral-code capture on job card/billing nor auto-credit yet.
- Google reviews unscrapable (blocked + ToS); `/feedback/import` ready for Places API / paid service.
- No persistent top bar (branch switcher is in sidebar; true top bar = shared-layout refactor of ~20 pages).
- Enquiry → Job Card conversion not wired.

> Mirror of the persistent memory in `~/.claude/projects/.../memory/`. Keep both in sync when architecture changes.
