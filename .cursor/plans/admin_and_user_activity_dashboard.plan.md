# Admin and User Activity Dashboard

## Two dashboards

- **Activity dashboard** — for **all users**. Shows the current user’s own activity (message count, messages-per-day chart, optional token stats). Route: `/activity`. Linked from the **main sidebar** as "Activity"; visible to everyone.
- **Admin dashboard** — for **global admins only**. Shows user list (total messages, last activity), global and per-user message charts, optional token stats. Route: `/admin/activity` (or `/admin/dashboard`). Linked from the **main sidebar** as "Admin dashboard"; visible only when the user is an admin (same check as [lib/admin.ts](lib/admin.ts) / [sidebar-user-nav](components/sidebar-user-nav.tsx)).

## Left sidebar links (what we add)

All new items go in [components/app-sidebar.tsx](components/app-sidebar.tsx), in the same `SidebarMenu` as Integrations, Files, Notes, Tasks, Agents.

| Label              | URL               | Who sees it   |
|--------------------|-------------------|---------------|
| **Activity**       | `/activity`       | All users     |
| **Admin dashboard** | `/admin/activity` | Admins only  |

**Order** (after existing items): … Agents → Activity → Admin dashboard. (Non-admins see only up to Activity.)

**Implementation:** Add two `SidebarMenuItem` entries. For "Admin dashboard", wrap in `{isAdmin && ( ... )}`. Derive `isAdmin` via `useSession()` and the same admin-email list as in [components/sidebar-user-nav.tsx](components/sidebar-user-nav.tsx); do not import server-only [lib/admin.ts](lib/admin.ts). Remove "Waitlist Management" from the user dropdown (it becomes a button on the Admin dashboard).

## Admin dashboard page content

- **Waitlist Management** — A **button** on the Admin dashboard (e.g. top of page or toolbar) that links to `/admin/waitlist`. No separate sidebar link.
- **Users table** — Display users in a **table** (not a list) with columns:
  - **User** (email, name)
  - **Message count**
  - **Token consumption** (total; needs optional `UsageLog` or aggregate from `chat.lastContext`)
  - **User type** (paid / not paid) — e.g. from [WaitlistRequest](lib/db/schema.ts) `upgradedAt` (upgraded = paid) or a future billing field
  - **Upgrade** — button per row (e.g. link to waitlist/approval or upgrade action)

Use a table component (e.g. semantic `<table>` or existing UI) with theme classes. Default sort by last activity.

## User dropdown ([components/sidebar-user-nav.tsx](components/sidebar-user-nav.tsx))

- Remove "Waitlist Management" (replaced by button on Admin dashboard).
- Keep "Feedback" for admins.

## Current state

- **Users / messages:** [lib/db/schema.ts](lib/db/schema.ts); helpers in [lib/db/queries.ts](lib/db/queries.ts).
- **Token usage:** Only last turn per chat in `Chat.lastContext`; historical tokens need optional `UsageLog` table.
- **Admin:** [lib/admin.ts](lib/admin.ts); admin pages under `app/(chat)/admin/`.

## Implementation summary

1. **Sidebar:** Add Activity (all users) and Admin dashboard (admins only) in [components/app-sidebar.tsx](components/app-sidebar.tsx). Use `useSession()` + admin-email check for the admin item.
2. **User dropdown:** Remove Waitlist Management from [components/sidebar-user-nav.tsx](components/sidebar-user-nav.tsx).
3. **Activity dashboard:** Page `app/(chat)/activity/page.tsx`, API `GET /api/activity` — current user’s stats and chart.
4. **Admin dashboard:** Page `app/(chat)/admin/activity/page.tsx`, API `GET /api/admin/activity` — Waitlist Management button (→ `/admin/waitlist`), **users table** (columns: user, message count, token consumption, user type paid/not paid, Upgrade button), global/per-user charts; guard with `isAdminSession`.
5. **Optional:** `UsageLog` table + chat-route write for token history; queries for totals and by-day.
