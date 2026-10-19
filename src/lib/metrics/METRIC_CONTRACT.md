# NYTO Admin Web — Frontend Metric Contract

Timezone display: **Asia/Kolkata**, 24h. Money: **INR**.

## Overview

| Metric | Scope | Source |
|--------|-------|--------|
| Upcoming nights | Next 30d nights (when API contract `upcoming_ops`) | `GET /admin/overview` |
| Confirmed bookings | CONFIRMED on those nights | Overview API |
| Seats allocated | CONFIRMED+ATTENDED seats of capacity | Overview API |
| Payments pending | Payment records PENDING | Overview API |
| Active venues / NYTO / Partner / Inactive | Loaded venues list | `GET /admin/venues` (FE) |
| Captured / Pending / Refunded amounts | Current ledger status sums | Overview `finance` when present |
| Attention queue | Only “clear” if Overview loaded successfully | Overview `attention` |

Legacy Overview shape (`activeVenues` / `sessions` / `confirmed` / `pendingPayment`) is normalized and **labelled honestly** (all-time / non-upcoming) — never silently remapped as “upcoming”.

## Module lists (loaded-list scope unless noted)

| Module | Primary KPIs | Filtered results |
|--------|--------------|------------------|
| Venues | Active venues, Active NYTO, Active partner | Beside search |
| Bookings | Total / Awaiting payment / Confirmed / Cancelled **booking records** | Beside filters · **not** Overview 30d window |
| Payments | Captured/Pending/Refunded **₹** + Failed **records** | Beside filters |
| Host apps | Awaiting review / Approved / Rejected | Beside filters |
| Guests | Guest accounts / With a booking / Signed up only / Booking records | Beside filters |
| Team | Active admins / Pending invitations / Team size (= active + invited) / Signed in as | — |

Shared helpers: `src/lib/kpi.ts`. Overview normalizer: `src/lib/api/overview.ts`.

## Backend data gaps — not changed in this phase

- Overview cannot invent venue-level upcoming nights per row without richer venue list payloads.
- Bookings feed KPIs cannot be forced to the same 30d night window without a scoped bookings API.
- Venue Experiences table cannot show confirmed seats / remaining without seatsTaken on each experience row in the UI data path.
- No platform share / profit / settlement.
- No occupancy “alert” threshold without product agreement + data.
