# Guest Experience — purpose & backend gaps

## What this module is for

**Guest Experience** is the admin **support / issues inbox**:

- Guest complaints and behaviour / venue / group reports from the NYTO app
- Follow-up cases until resolution
- Guest feedback after a night
- Instant alerts when a new report is submitted

It is **not** a second Bookings list. Reservations stay in **Bookings**; profiles and visit history stay in **Guests**.

## What is not connected yet

Source constant: `GUEST_EXPERIENCE_API_GAPS` in `src/lib/guest-experience.ts`.

| Gap | Need |
|-----|------|
| Complaint / report records | Persisted reports with guest, booking, venue, category, description, priority, status, assignment |
| Follow-up case records | Cases with due date, assignee, status workflow, action history |
| Guest feedback | Feedback/rating entity on admin APIs |
| Instant admin notifications | Persist on report create; authorized admin channel or inbox |
| Physical arrival (optional elsewhere) | Separate from this inbox — door check-in is not complaint data |

Until those APIs exist, the Guest Experience UI must show **Not connected** — never invent complaints or alerts.
