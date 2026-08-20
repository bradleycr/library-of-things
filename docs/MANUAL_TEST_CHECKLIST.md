# Manual test checklist — cross-device

Use this to verify the latest UX changes on **Android**, **iOS**, and **desktop** (Chrome, Safari, Firefox).

---

## Post-deploy verification (uploads, checkouts, profile names)

After deploying, quickly confirm these flows:

1. **Profile / display name**
   - Log in with a library card → **Settings** → update **Display name** (and/or contact info) → Save.
   - Open a book you added (or that shows “Added by [you]”). It should show the **new** name, not the old one.
   - Check **My Books** and any “current holder” text — all should show the updated name.

2. **Checkout (including contact-required)**
   - **Normal book:** Open a book’s checkout URL (with `?token=...`). With a valid card, you should be able to complete checkout.
   - **Email-required book:** A member without email should see an inline required email field. Checkout should save it privately and succeed. An item with “Allow checkout without email” enabled should not require it.

3. **Temporary keycard (email-first return)**
   - Create two numbered temporary keycards from the steward dashboard and copy an NFC URL.
   - Open the URL in a private browser, enter an email + public name, promise the email, and sign it out. Confirm success shows **Out** and that the public bootstrap/ledger does not contain the email.
   - Open the same URL in a **different** private browser (or clear cookies). Enter the same email, promise you are at the home node, and return. Confirm success shows **Home / Returned**.
   - Sign out a second keycard with the **same** email — both should be allowed.
   - A steward return must recover a forgotten email.

4. **Cover upload (steward)**
   - **Steward dashboard** → Book Management → **Show more** if needed → Edit a book.
   - **Cover image:** Paste a URL (e.g. OpenLibrary) **or** click “Upload photo” and choose an image. Save.
   - Book detail and explore should show the new cover (and URL pastes should still work).

4. **Add book (node selection)**
   - **Add book** → choose “Library node” → select a node → fill title and submit. Should create the book without “Invalid node_id”.

5. **Node collections (home → explore)**
   - **Home** → Library nodes section → click **View Collection** on a node card. Should open **Explore** with the same layout as before, filtered to that node’s books (URL has `?node=<id>`). No location prompt on explore.

6. **Add node (steward)**
   - **Steward dashboard** → **Add node** → fill name, type (including “other”), steward, **address** (no lat/lng fields). Submit. New node should appear on homepage and in add-book node list; directions link should work if geocoding succeeded.

---

## 1. Tap without card — get a card or log in

**Steps**

1. On a device **without** a library card (or in an incognito/private window with no card saved), open a book’s **checkout URL** (from QR/NFC or steward “Bulk NFC Tag URLs”).  
   Example: `https://libraryofthings.vercel.app/book/<book-uuid>/checkout?token=<token>`
2. Ensure the book is **available** (not checked out).

**Expected**

- Clear message that a library card is required to check out.
- Primary actions to **get a library card** and/or **log in with card** (typically linking to `/settings?mode=generate` and `/settings?mode=login`).
- No dead-end “go home only” CTA.

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

- `pnpm check` — succeeds.
- `/settings` — returns 200.
- Checkout page offers get-card / log-in paths when no card is present.
- Dialog component includes `max-h-[85vh] overflow-y-auto`.

---

## Optional: real devices

- **Android:** Chrome on phone/tablet; or Android emulator.
- **iOS:** Safari on iPhone/iPad; or iOS Simulator (Mac).
- **Desktop:** Chrome, Safari, Firefox — quick sanity check.

If you use **BrowserStack**, **Sauce Labs**, or similar, run the three sections above in their mobile and desktop browsers.
