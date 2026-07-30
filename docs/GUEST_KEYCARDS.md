# Guest keycards and general library items

The shared circulation system can lend books, numbered guest keycards, and
future physical objects. Existing books and their `/book/...` QR/NFC URLs are
unchanged. Operational items use `/thing/...` URLs.

## Provision ten guest keycards

1. Run `pnpm db:ensure-schema` after deploying this version.
2. Open **Steward dashboard → Guest keycards**.
3. Choose the home node, leave **Starts at** as `1` and **How many** as `10`.
4. Create the cards and copy each **NFC URL**.
5. Program each physical tag as a URL record. Test it before attaching it.

Each keycard is hidden from the public book catalog, has its own immutable home
node and public ledger history, and does not count against the two-book limit.

## Guest borrowing

A tap opens a minimal page asking for an email address. No library account or
email verification is required. The email is stored only in the private
`guest_loans` row while the item is checked out; it is never written to the
public ledger and is erased when the item is returned.

The browser receives an opaque, HTTP-only guest-loan cookie. A second tap in
that browser opens the return flow. If the browser session is lost, a steward
can record the return from the dashboard.

## Return location

Location is requested once, only after the borrower chooses to return. It is
not watched in the background. The server recomputes distance from the trusted
node coordinates and accepts the return within the configured radius (3 km by
default, editable under **Library settings**).

Guest keycards return only to their home node. Books may return to any selected
node. If location permission, GPS, or node coordinates are unavailable, the
borrower may use the explicit physical-return confirmation. A known location
outside the radius is not treated as a GPS failure and remains blocked.

Raw coordinates are not retained. Ledger metadata records only the verification
method and rounded distance. Browser location can be spoofed, so this is a
practical guard against accidental remote returns—not proof of physical presence.

## Contact policy

Email is required by default for all existing and newly added books/items.
Stewards and book contributors can opt a specific item out with **Allow checkout
without email**. A borrower's email remains private unless they separately turn
on public contact information for their profile.
