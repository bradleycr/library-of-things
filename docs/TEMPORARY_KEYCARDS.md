# Temporary keycards and general library items

The shared circulation system can lend books, numbered temporary keycards, and
future physical objects. Existing books and their `/book/...` QR/NFC URLs are
unchanged. Operational items use `/thing/...` URLs.

## Provision ten temporary keycards

1. Run `pnpm db:ensure-schema` after deploying this version.
2. Open **Steward dashboard → Temporary keycards**.
3. Choose the home node, leave **Starts at** as `1` and **How many** as `10`.
4. Create the cards and copy each **NFC URL**, or open **Print QR labels**.
5. Program each physical tag as a URL record, and/or cut out the printed QR
   squares and attach them to the cards.

Each temporary keycard is hidden from the public book catalog, has its own
immutable home node and public ledger history, and does not count against the
two-book limit.

## Printable QR labels

`/steward/print-keycard-qr` (steward login required) prints a sheet of cut-out
labels — **1.5″** by default, or **1″**. Each square is the card number plus a
QR to that card’s checkout URL (same link as NFC). Print or save as PDF, cut
along the dashed line, and stick the label on the physical card.

## Borrowing

A tap or QR scan opens a simple page: the card image, Available / Out, and
either a name and email plus **Email me a confirmation**, or a **Return**
button. No library card is required. A visitor pass is not a membership.

The card stays available until the guest opens the email and presses
**Confirm checkout**. The message is the Foresight Berlin guest-pass letter
(use the pass, write a short report, how to return it) and comes from
`noreply@…` with replies going to the node manager. The confirm link lasts
7 days. Opening the link does not check the card out. Mail scanners prefetch
links, so only the button does.

The email is stored in private `guest_loans` while the card is out and used as
the steward holder label. It is erased from that live loan on return. Sharing
history stays public and shows **Guest**, not the address. The tap page does
not show the email either. Temporary keycards stay off the public catalog.

Anyone who taps the tag or scans the QR can return the card. Possession of
the physical card is enough. A steward can also record a return from the
dashboard. The same email may hold multiple keycards.

Mail uses Resend (`RESEND_API_KEY`, `SMTP_FROM`, `GUEST_PASS_REPLY_TO`,
`APP_URL`). See [DEPLOY.md](./DEPLOY.md). Without a key, local development
shows the confirm link on the card page. Production refuses to pretend the
email was sent.

## Contact policy

Email is required by default for all existing and newly added books/items.
Stewards and book contributors can opt a specific item out with **Allow checkout
without email**. A book borrower's email remains private unless they separately
turn on public contact information for their profile.
