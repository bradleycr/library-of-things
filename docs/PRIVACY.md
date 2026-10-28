# Privacy

What operators and forks should expect about data visibility in Library of Things.

## Public by design

These surfaces are visible without signing in (or are intentionally shared):

| Data | Where |
|------|--------|
| Book / item titles, authors, availability, node names | Catalog, book pages, explore |
| Public display names (or “Anonymous”) | Profiles, ledger, “added by” / holder labels |
| Sharing history (ledger events) | `/ledger`, book history |
| Pocket Library owner contact email | On that book’s public page (by design — borrowers need a way to arrange pickup) |
| Checkout URLs for catalog-visible books | Bootstrap / ISBN scan deep-links |

Temporary keycards and other operational items marked not catalog-visible stay
off the public browse surfaces; their NFC URLs are for people who tap the tag.

## Private by design

| Data | Notes |
|------|--------|
| Library card PIN | Salted hash in the database. Asking for the card emails a new PIN and retires the old one. The plaintext lives only in that email and, for up to 24 hours, on the one-time link. |
| Auth / account email and phone | Not public unless the member opts into public contact |
| Guest borrower email (temporary keycards) | Asked at checkout and confirmed from the inbox before the card is out. Stored on the active loan and shown to stewards. Erased from the live loan on return. Sharing history (`/ledger` and its export) shows **Guest**, never the email. A private copy may remain on the loan event for the node manager. Guest-pass and return-reminder messages are also CC’d to the steward archive address (`STEWARD_MAIL_CC` / `GUEST_PASS_REPLY_TO`) so the node manager has them on file. Library-card PIN emails are never CC’d. |
| Raw GPS coordinates | Not retained; book returns may record verification method / rounded distance only |
| Steward password | Env var only; never returned by the API |

## Defaults that affect privacy

- **Return reminders** go to the email on the borrower’s account: the day a book is due, one week later, and one month after the due date. They explain leaving the book at CIC Berlin reception or in the after-hours return locker. They are not written into the public sharing history.
- **Keycard drop-off photos** are optional. If a guest attaches one when returning a temporary keycard, only stewards can see it, and it is deleted after about two weeks.
- **A verified email is required for a library card and for book checkout.**
  The member confirms the address from their inbox. Asking for a lost card
  emails the number and a new PIN to that address only. Required email is for
  stewards / return contact — it is not the same as public profile contact opt-in.
  Temporary keycards use a separate guest-email flow: name plus email, then a
  confirmation message before the card is checked out. No library card is created.
- **Profiles are public by default**; members can set a profile private
  (`profile_public`), which shows as “Anonymous” in public views.
- **Temporary keycard return** is NFC/QR-first: anyone with the physical card
  can tap Return. The tap page shows that the card is out, not the guest email.

## Operator responsibilities

- Do not paste production member or guest data into issues, PRs, or chat.
- Keep `.env.local` and Apple Wallet PEMs off git and out of screenshots.
- Set a strong `STEWARD_PASSWORD` in production (never ship the local default).
- When deleting a member, ledger history may remain with anonymized display names.

The public notice for members and guests is at `/privacy`.

For vulnerability reports, see [SECURITY.md](../SECURITY.md).
