# Manual test checklist — cross-device

Use this to verify the latest UX changes on **Android**, **iOS**, and **desktop** (Chrome, Safari, Firefox).

---

## 1. Tap without card — “Get Library Card or Log In”

**Steps**

1. On a device **without** a library card (or in an incognito/private window with no card saved), open a book’s **checkout URL** (from QR/NFC or steward “Bulk NFC Tag URLs”).  
   Example: `https://your-app.vercel.app/book/<book-uuid>/checkout?token=<token>`
2. Ensure the book is **available** (not checked out).

**Expected**

- Title: **“Library card required”**
- Message: “Get a free library card or log in to check out this book.”
- **One button:** “Get Library Card or Log In” (not “Go to Library of Things”).
- Tapping the button goes to **/settings** (get card or log in).

**Check on:** Android Chrome, iOS Safari, desktop Chrome/Safari/Firefox.

---

## 2. Return dialog — “Confirm Return” clickable

**Steps**

1. Log in with a library card that has at least one **borrowed** book.
2. Go to **My Books** → **Currently Borrowed**.
3. Tap **Return** on a book.
4. In the dialog: choose a return location and optionally add notes.

**Expected**

- Dialog fits the screen or **scrolls** (no content cut off).
- **“Confirm Return”** is visible and **tappable/clickable** (no need to scroll blindly).
- After tapping, the return completes and the dialog closes.

**Check on:** Android (Chrome), iOS (Safari) — especially small screens; desktop is usually fine.

---

## 3. Loan period — 2 months (60 days)

**Steps**

1. **Checkout:** Check out any available book. Success message should say “Suggested return within **60** days” (not 21).
2. **Book detail:** Open a book that has lending terms. Under terms, it should say “**60** day borrow period (suggested)” (or the book’s custom value).
3. **Add book:** On Add Book, the lending terms blurb should say “Suggested return period is **2 months (60 days)**”.
4. **Steward:** In steward dashboard, edit a book’s lending terms. Default **Loan period (days)** should be **60**.

**Check on:** Any one device is enough; the value is server/default-driven.

---

## Quick smoke (already verified in CI/build)

- `pnpm build` — succeeds.
- `/settings` — returns 200.
- Checkout page bundle includes “Get Library Card or Log In”.
- Dialog component includes `max-h-[85vh] overflow-y-auto`.

---

## Optional: real devices

- **Android:** Chrome on phone/tablet; or Android emulator.
- **iOS:** Safari on iPhone/iPad; or iOS Simulator (Mac).
- **Desktop:** Chrome, Safari, Firefox — quick sanity check.

If you use **BrowserStack**, **Sauce Labs**, or similar, run the three sections above in their mobile and desktop browsers.
