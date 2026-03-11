# ISBN-based checkout and return — plan (implemented)

## How to disable

Set `ISBN_CHECKOUT_RETURN_ENABLED` to `false` in **`lib/feature-flags.ts`**. That hides: nav/menu “Scan to checkout or return”, book page “Check out via ISBN scanner” and “Return via ISBN scanner”, and the add-book success line. No other code paths depend on this feature.

---

## Goal

Allow users to **check out** and **return** books by scanning the ISBN barcode as an alternative to QR code or NFC, without removing or downplaying QR/NFC. Support books that have been added but don’t yet have a physical QR or NFC tag (“do this later”). Handle **multiple copies** of the same ISBN (e.g. same title at different nodes or Pocket Libraries) by letting the user pick which copy they are borrowing or returning.

---

## Current behavior (unchanged)

- **Checkout:** User opens `/book/[uuid]/checkout?token=...` (from QR or NFC). Tap API validates token; checkout page loads; user checks out with library card. Token is required today; without it the page shows “Invalid link”.
- **Return:** From My Books (holder) or from the book’s checkout page (holder). No token required.
- **Add-book success:** “Add to book” guide (NFC + QR) with “Do this later”. Every book gets a `checkout_url` (with token) at creation; that URL is used for QR/NFC.
- **Book page:** Explains “scan the NFC or QR code on the book”; no in-app checkout/return buttons today (user uses the physical link).

---

## 1. Lookup by ISBN (multiple copies)

- **Source of truth:** Bootstrap already returns all books with `isbn` and `checkout_url`. No new API required for “find books by ISBN.”
- **Client flow:** After scanning, normalize the barcode with existing `normalizeIsbn()`, then filter `data.books` (from `useBootstrapData()`) where the book’s ISBN normalizes to the same value (handle missing/empty ISBN by not matching).
- **Result:**  
  - **0 matches** → “No book with this ISBN in the library.”  
  - **1 match** → Go straight to that book’s checkout/return flow (see below).  
  - **2+ matches** → Show a **copy picker**: list each copy with a clear label so the user can choose the right one (e.g. “*Title* — Berlin Node”, “*Title* — San Francisco Node”, “*Title* — Pocket Library (John)”). Use `current_node_name` for node books and “Pocket Library” plus owner/location for pocket books. On select, proceed with the chosen book’s `id` and `checkout_url` (and show return flow if they’re the holder).
- **Trust:** We rely on the user to select the correct copy (same as trusting they tap the right physical book). No extra verification beyond clear labels.

---

## 2. Global entry point: “Scan to checkout or return”

- **Placement:** Add a single entry in the **main nav / menu** (e.g. “Scan to checkout or return” or “ISBN scanner”) so it’s discoverable but not dominant. Reuse the existing mobile menu and desktop nav pattern (e.g. next to Explore, Add a Book, Sharing history, or inside a “More” / dropdown).
- **Behavior:**  
  - Opens the same **ISBN scanner dialog** used on add-book (or a shared component that only does “scan → return result”), with copy/return intent instead of “fill add-book form”.  
  - On successful scan → normalize ISBN → lookup books from bootstrap (as above).  
  - 0 → toast or in-dialog message: “No book with this ISBN in the library.”  
  - 1 → Redirect to that book’s **checkout page with token**: use `book.checkout_url` (it already contains `/book/[uuid]/checkout?token=...`). If the user is the current holder, the checkout page can show the return flow; if available, it shows checkout. So one URL works for both.  
  - 2+ → Show a **picker dialog/page**: “Multiple copies of this book” with a list (title, location label, availability). Each row selects that book; on select, redirect to that book’s `checkout_url` (same as above).
- **No token bypass:** We always redirect to the existing `checkout_url` (with token). No change to “Invalid link” when opened without token; the only way to get a valid link for ISBN flow is via this scan → picker → redirect to stored `checkout_url`.

---

## 3. Book detail page: “Check out / Return via ISBN scanner”

- **When to show:**  
  - **Check out:** Book is **available**; show a secondary option “Check out via ISBN scanner” (in addition to the existing “scan the NFC or QR code” copy).  
  - **Return:** Current user is **holder**; show “Return via ISBN scanner.”
- **Behavior:**  
  - User clicks “Check out via ISBN scanner” (or “Return via ISBN scanner”).  
  - Open scanner; user scans the **same** book’s barcode.  
  - Optional: verify that normalized ISBN matches `book.isbn` (if book has ISBN). If it doesn’t match, show “This doesn’t match the book on this page” and do not proceed.  
  - If match (or no ISBN to compare): redirect to `book.checkout_url` (checkout page with token). That page already shows checkout or return depending on holder/availability.  
- **Placement:** In the “How to Borrow This Book” card (when available) add a small link or button “Or check out via ISBN scanner”. When checked out and user is holder, add “Return via ISBN scanner” near the return-related copy. Keep QR/NFC as the primary, recommended path.

---

## 4. Add-book success: “Do this later” and ISBN option

- **When user clicks “Do this later”:** After collapsing the QR/NFC guide, show a short line so they know the book is still usable without a tag:  
  **“You can still check out or return this book using the ISBN scanner — find it in the menu under ‘Scan to checkout or return’.”**  
- No extra modal; just one sentence below or inside the collapsed state so it doesn’t distract from “add QR/NFC later.”

---

## 5. Checkout page (no change to token rule)

- **Keep current rule:** The checkout page continues to require a valid token when opened directly. The only way to get a valid URL is via QR/NFC link or via the **in-app ISBN flow** that redirects to `book.checkout_url` (which includes the token).  
- So we do **not** add `?via=isbn` or “allow checkout without token.” We only add ways to **get** to the existing checkout URL (with token) via ISBN scan + picker or from the book page.

---

## 6. UI/UX summary

| Location | Change |
|----------|--------|
| **Menu / nav** | New item: “Scan to checkout or return” → opens ISBN scanner → scan → 0/1/many → redirect or picker → redirect to `checkout_url`. |
| **Book page (available)** | Add “Or check out via ISBN scanner” → scan → (optional) verify ISBN → redirect to `checkout_url`. |
| **Book page (holder)** | Add “Return via ISBN scanner” → scan → (optional) verify ISBN → redirect to `checkout_url` (return flow). |
| **Add-book success** | When guide is collapsed (“Do this later”), add one line: book is still checkoutable/returnable via ISBN scanner in the menu. |
| **Multiple copies** | Picker: “X copies of this book in the library — which one?” List each with title + node name or “Pocket Library” + location/owner; on select, go to that book’s `checkout_url`. |

---

## 7. Files to add or change (high level)

| Area | Action |
|------|--------|
| **Shared ISBN scan for checkout/return** | Reuse or extend `IsbnScannerDialog` so it can run in “fill form” mode (add-book) vs “return scanned ISBN only” mode (global + book page). Same normalization and scanner UI. |
| **Lookup by ISBN** | Client-only: `normalizeIsbn(scanResult)`, then filter `data.books` by normalized ISBN. Optional: small helper `findBooksByIsbn(books, normalizedIsbn)`. |
| **Copy picker** | New component (e.g. `IsbnCopyPickerDialog`): receives list of books with same ISBN; renders list with title + location label; on select, callback with chosen `book` (id + checkout_url). |
| **Site header / nav** | Add “Scan to checkout or return” (or “ISBN scanner”) that opens scanner; on scan → lookup → 0/1/many handling and redirect or picker. |
| **Book detail page** | Add “Check out via ISBN scanner” and “Return via ISBN scanner” with scanner + optional ISBN check + redirect to `book.checkout_url`. |
| **Add-book success card** | When guide is collapsed, show one line about ISBN scanner in the menu. |
| **Bootstrap / API** | No change; books already include `isbn` and `checkout_url`. |

---

## 8. Edge cases

- **Book has no ISBN:** Lookup by ISBN won’t find it; user must use QR/NFC or search. No change.
- **Same ISBN, different editions:** We treat “same normalized ISBN” as same title; picker shows all copies. If we later want to distinguish (e.g. subtitle/edition), we can show more detail in the picker.
- **Stale bootstrap:** If a book was just added and bootstrap isn’t refreshed, global scan might not find it until refresh. Acceptable; user can refresh or go to book page. Optional: refetch bootstrap after add-book success so the new book is in the list.

---

## 9. Out of scope

- Changing checkout API or token rules.
- Requiring a physical scan for every checkout/return when we already know the book (e.g. from book page we can offer “Check out” without scanning; we still offer “via ISBN scanner” as an option for consistency and for users who didn’t add QR/NFC).
- Dedicated “return only” or “checkout only” global flows; one “Scan to checkout or return” entry is enough; the checkout page already shows the right action (checkout vs return) based on state.

This plan keeps QR/NFC as the primary path, adds a clear but secondary path via ISBN scan everywhere it’s relevant, and handles duplicates with a simple, trust-based picker.
