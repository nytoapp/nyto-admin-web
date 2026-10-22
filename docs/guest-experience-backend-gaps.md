# Guest Experience — backend gaps (developer note)

The Guest Experience admin dashboard uses the capped `/admin/bookings` feed for journey staging only. The following capabilities are **not** on admin APIs and must not be faked in the UI.

Source of truth in code: `GUEST_EXPERIENCE_API_GAPS` in `src/lib/guest-experience.ts`.

| Gap | Need |
|-----|------|
| Complaint / report records | Persisted reports with guest, booking, venue, category, description, priority, status, assignment |
| Follow-up case records | Cases with due date, assignee, status workflow, action history |
| Guest feedback | Feedback/rating entity on admin APIs |
| Physical arrival confirmation | Expose `TableMember.attended` (or equivalent) on admin booking payloads |
| Instant admin notifications | Persist on report create; authorized admin channel or inbox; recover missed events |
| Reminder / confirmation send status | Admin-visible delivery ledger |

Do not treat dashboard “Not connected” / unavailable labels as product defects for these items until the APIs exist.
