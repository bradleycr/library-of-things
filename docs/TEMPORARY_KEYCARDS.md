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
or emailed verification link is required. After sign-out, a dedicated success
screen shows the card as **Out** and connected to that email. The address is
stored only in the private `guest_loans` row while the item is checked out; it
is never written to the public ledger and is erased when the item is returned.
The return screen is a dedicated **Home / Returned** confirmation.

The browser may receive an optional loan cookie, but return never depends on it.
To return: tap the NFC tag on any phone, enter the same private email used at
sign-out, promise you are at the home node, and confirm. A steward can also
record the return from the dashboard.

## Return confirmation

Temporary keycards return only to their home node. There is no GPS/geofence
check on this flow: the borrower must tap a promise that they are physically at
the home node with the keycard, then confirm return.

Books may still use separate return geolocation on their own checkout pages.
A steward can also record a temporary-keycard return from the dashboard.

## Contact policy

Email is required by default for all existing and newly added books/items.
Stewards and book contributors can opt a specific item out with **Allow checkout
without email**. A borrower's email remains private unless they separately turn
on public contact information for their profile.
