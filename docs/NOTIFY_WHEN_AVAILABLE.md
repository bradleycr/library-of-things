# Notify When Available — How to add email later

The "Notify when available" button on book pages is currently **disabled** and labeled "coming soon". No backend or Supabase change is required to keep it that way.

When you want to ship real email notifications, you do **not** need a new Supabase project. You only need:

1. **One new table** in the same Postgres (Supabase) DB  
2. **One API route** (or a call from existing routes) that sends email  
3. **An email provider** (e.g. Resend, SendGrid) with an API key in env  

---

## 1. New table (same DB)

```sql
create table notify_requests (
  id text primary key default gen_random_uuid()::text,
  book_id text not null references books(id) on delete cascade,
  user_id text references users(id) on delete cascade,
  email text,
  created_at timestamptz not null default now(),
  unique(book_id, coalesce(user_id::text, email))
);

create index idx_notify_requests_book on notify_requests(book_id);
```

- Either `user_id` (logged-in) or `email` (guest) so you know where to send the email.  
- Unique on `(book_id, user_id or email)` so one request per person per book.

---

## 2. When to send the email

Send when a book **becomes available**:

- In **`returnBook()`** in `lib/server/repositories.ts` — after you set `availability_status = 'available'`, query `notify_requests` for that `book_id`, then call your email sender.
- If stewards can set a book to "available" from the dashboard, the same logic should run after **`updateBook()`** when `availability_status` changes to `'available'`.

So: one small function, e.g. `notifySubscribersWhenAvailable(bookId: string)`, that:

1. Selects rows from `notify_requests` where `book_id = $1`.  
2. Gets book title (and maybe book URL) for the email body.  
3. For each row, sends one email (to `email` or to the user’s contact_email from `users`).  
4. Optionally deletes or marks as sent so you don’t email twice.

---

## 3. Sending email programmatically

Use a transactional email API; no Supabase-specific setup.

**Option A — Resend (recommended, simple)**

- Sign up at [resend.com](https://resend.com), get an API key.  
- Add `RESEND_API_KEY` to `.env.local` and Vercel.  
- In a Next.js API route or a server helper:

```ts
import { Resend } from "resend"

const resend = new Resend(process.env.RESEND_API_KEY)

await resend.emails.send({
  from: "Library of Things <notify@yourdomain.com>",
  to: userEmail,
  subject: `"${bookTitle}" is back in the library`,
  html: `...`,
})
```

Call this from your repository (e.g. after `returnBook`) or from an API route that the repository calls. You can keep the logic in one place, e.g. `lib/server/notify-when-available.ts`, and call it from both return and steward-update flows.

**Option B — SendGrid, Postmark, etc.**

Same idea: env var for API key, then one server-side function that sends the email when a book becomes available.

---

## 4. Enabling the button (client)

Once the backend exists:

- Add an API route, e.g. `POST /api/books/[id]/notify-request`, that requires the user to be logged in (or accepts email for guests), inserts into `notify_requests`, and returns success.  
- On the book page, replace the disabled "Notify when available (coming soon)" button with a real button that calls that API.  
- Remove the "coming soon" label and the `disabled` state.

No new Supabase setup is required — same database, one new table and one email provider key.
