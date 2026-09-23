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
| Library card PIN | Salted hash only; never recoverable |
| Auth / account email and phone | Not public unless the member opts into public contact |
| Guest borrower email (temporary keycards) | Stored in `guest_loans` while the card is out and shown on the NFC/QR tap page so a found card can be returned; erased on return; not in the public catalog |
| Raw GPS coordinates | Not retained; book returns may record verification method / rounded distance only |
| Steward password | Env var only; never returned by the API |

## Defaults that affect privacy

- **Borrower email required by default** for book checkout (configurable per item
  and via library settings). Required email is for stewards / return contact — it
  is not the same as public profile contact opt-in.
- **Profiles are public by default**; members can set a profile private
  (`profile_public`), which shows as “Anonymous” in public views.
- **Temporary keycard return** is NFC/QR-first: anyone with the physical card
  can tap Return. The borrower email is shown on that tap page while the card
  is out.

## Operator responsibilities

- Do not paste production member or guest data into issues, PRs, or chat.
- Keep `.env.local` and Apple Wallet PEMs off git and out of screenshots.
- Set a strong `STEWARD_PASSWORD` in production (never ship the local default).
- When deleting a member, ledger history may remain with anonymized display names.

For vulnerability reports, see [SECURITY.md](../SECURITY.md).
