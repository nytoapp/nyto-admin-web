# NYTO Admin Web

Internal operations console for NYTO founders.

## Stack

- Next.js 15 (App Router) + TypeScript + Tailwind
- Shared NYTO backend (`../backend`) — no second API

## Run locally

1. Start backend (from `../backend`) on port 3000
2. Ensure seed has run (`admin@nyto.app` is ADMIN)
3. For local OTP without email, set in backend `.env`:
   `OTP_TEST_DESTINATIONS=admin@nyto.app:123456`
4. In this folder:

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open http://localhost:3001

## Auth

Email OTP via existing `/auth/email/otp/*`, then `/admin/access-check` (ADMIN only).

## Domain mapping

| Admin UI           | Backend                              |
|--------------------|--------------------------------------|
| Venues             | `/admin/venues`                      |
| Experiences        | `/admin/venues/:id/menus`            |
| Sessions/nights    | `/admin/venues/:id/tables`           |
| Venue staff        | `/admin/venues/:id/staff`            |
| Bookings           | `/admin/bookings`                    |
| Payments           | `/admin/payments`                    |
| Host applications  | `/admin/host-applications`           |
