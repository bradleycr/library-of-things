# Temporary keycards and general library items

The shared circulation system can lend books, numbered temporary keycards, and
future physical objects. Existing books and their `/book/...` QR/NFC URLs are
unchanged. Operational items use `/thing/...` URLs.

## Provision ten temporary keycards

1. Run `pnpm db:ensure-schema` after deploying this version.
2. Open **Steward dashboard → Temporary keycards**.
3. Choose the home node, leave **Starts at** as `1` and **How many** as `10`.
4. Create the cards and copy each **NFC URL**.
5. Program each physical tag as a URL record. Test it before attaching it.

Each temporary keycard is hidden from the public book catalog, has its own
immutable home node and public ledger history, and does not count against the
two-book limit.

## Temporary keycard borrowing

A tap opens a minimal page asking for an email address. The borrower must
confirm that it is a valid address they can be reached at. No library account
or emailed verification link is required. After sign-out, the screen shows that
the card is checked out and connected to that email. The address is stored only
in the private `guest_loans` row while the item is checked out; it is never
written to the public ledger and is erased when the item is returned. The
return screen is a dedicated “Returned” confirmation.

The browser receives an opaque, HTTP-only loan cookie **per keycard** (so several
cards can be out at once). A second tap in that browser opens the return flow.
If the browser session is lost, the borrower can return by entering the same
email used at sign-out (still private, never shown in the ledger). A steward can
also record the return from the dashboard.

## Return location

Location is requested once, only after the borrower chooses to return. It is
not watched in the background. The server recomputes distance from the trusted
node coordinates and accepts the return within the configured radius (3 km by
default, editable under **Library settings**).

Temporary keycards return only to their home node. Books may return to any
selected node. If location permission, GPS, or node coordinates are unavailable,
the borrower may use the explicit physical-return confirmation. A known location
outside the radius is blocked unless they also confirm the physical return.

Raw coordinates are not retained. Ledger metadata records only the verification
method and rounded distance. Browser location can be spoofed, so this is a
practical guard against accidental remote returns—not proof of physical presence.

## Contact policy

Email is required by default for all existing and newly added books/items.
Stewards and book contributors can opt a specific item out with **Allow checkout
without email**. A borrower's email remains private unless they separately turn
on public contact information for their profile.
