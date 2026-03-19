# Diagnosing library card login

If a user can’t log in with their card number and PIN, run these in the **Supabase SQL editor** (or any Postgres client) to see what’s in the database.

## 1. Check if the card exists

Card numbers are stored as entered (often with spaces). Login normalizes by removing spaces, so use the same when querying:

```sql
-- Replace with the card number the user is trying (digits only, no spaces)
SELECT id, card_number, user_id, pseudonym, created_at
FROM public.library_cards
WHERE replace(card_number, ' ', '') = '6981415735926084';
```

- **No rows** → That card number is not in the DB. Possibilities: typo, card was never created on this instance, or card was created with a different number (e.g. spaces/format).
- **One row** → Card exists. Note `user_id`; then check PIN (step 2) and user (step 3). PIN cannot be read back (it’s hashed); you can only verify by having the user try again or by resetting the PIN if you add a steward “reset PIN” flow.

## 2. PIN is hashed

We store `pin_hash` (salted SHA-256), not the PIN. You cannot “look up” the PIN. If the card exists but login still fails:

- User may be misremembering the PIN (e.g. leading zero: `0123` vs `123`).
- PIN is normalized to 4 digits (digits only, last 4, padded with leading zeros). So `12` and `0012` are the same; `12345` becomes `2345`.

## 3. Check the user row

If the card exists, confirm the user still exists and isn’t deleted:

```sql
-- Use user_id from the previous query
SELECT id, display_name, auth_provider, created_at
FROM public.users
WHERE id = '<user_id from library_cards>';
```

- **No row** → User was deleted; card row may still exist (depending on FK). Login will fail; consider cleaning up orphan cards.
- **One row** → User exists. Login failure is then almost certainly wrong PIN or wrong card number (e.g. extra/missing digit).

## 4. “Logged into a different account” on another device

Sessions are per-browser/device (httpOnly cookie). So:

- **Phone** has its own cookie; if someone else logged in on that phone, or the user logged in with a different card, the phone shows that account.
- **Desktop** has a different cookie; it can show a different account.

That’s expected. No “mixing” in the DB—only one card per row and one user per card. To “fix” the phone: log out (e.g. “Remove card from this device”) and log in again with the correct card + PIN.

## 5. Rate limiting

Login is limited to 10 attempts per IP per minute. If the user hit that, they’ll get “Too many login attempts” and must wait a minute. Check server logs for 429s if needed.
