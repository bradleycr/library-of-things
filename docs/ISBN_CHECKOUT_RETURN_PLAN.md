# ISBN-based checkout and return

Optional feature gated by `ISBN_CHECKOUT_RETURN_ENABLED` in
`lib/feature-flags.ts`. When enabled, members can scan an ISBN barcode as an
alternative path to a book’s QR/NFC checkout URL.

## How to disable

Set `ISBN_CHECKOUT_RETURN_ENABLED` to `false`. That hides:

- Nav / menu “Scan to checkout or return”
- Book page “Check out via ISBN scanner” / “Return via ISBN scanner”
- The add-book success hint about using the scanner

## How it works

1. User opens the ISBN scanner (camera or photo) or types an ISBN.
2. Client normalizes the barcode (`lib/isbn-utils.ts`) and looks up copies via
   **`GET /api/books/by-isbn`** (fresh server lookup — not the stale bootstrap
   cache). Matching uses ISBN-10/13 cross-match.
3. Results:
   - **0 matches** → Offer to add the book (`/add-book?isbn=...`)
   - **1 match** → Redirect to that copy’s `checkout_url` (includes `?token=`)
   - **2+ matches** → Copy picker (node / Pocket Library labels), then redirect
4. Checkout and return still use the existing tokenized checkout page and APIs.
   Opening `/book/[uuid]/checkout` without a valid token still shows an invalid
   link — the scanner only helps you *reach* a stored checkout URL.

## Related code

- `components/isbn-scanner-dialog.tsx` — live + photo scan
- `components/isbn-checkout-return-dialog.tsx` — scan → lookup → navigate
- `components/isbn-copy-picker-dialog.tsx` — multi-copy selection
- `lib/isbn-checkout.ts` — matching helpers
- `app/api/books/by-isbn/route.ts` — server lookup
