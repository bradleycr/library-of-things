# Pocket Library

Pocket Library extends the lending model beyond physical nodes. Instead of
placing a book on a shared shelf, an owner keeps the book and lists it in
the catalog. Borrowers contact the owner to arrange pickup.

## How it works

1. Owner goes to `/add-book` and selects **Pocket Library (Keep with me)**.
2. Provides a contact email (required) and optional location.
3. Book appears in the catalog with a "Pocket" badge.
4. Borrowers see the owner's contact info and reach out to arrange a handoff.
5. Checkout still happens via QR/NFC scan — same flow as node books.

## Database

Two columns on the `books` table:

| Column | Type | Purpose |
|--------|------|---------|
| `is_pocket_library` | `boolean NOT NULL DEFAULT false` | Flags floating books |
| `owner_contact_email` | `text` | Required for Pocket Library books |

Both are created automatically by `pnpm db:ensure-schema`.

Pocket Library books have `current_node_id = NULL` — they don't belong to any
physical node.

## API

`POST /api/books/create` accepts:

- `is_pocket_library` (boolean) — set to `true` for Pocket Library books
- `owner_contact_email` (string) — required when `is_pocket_library` is true
- `current_location_text` (string) — optional location description

Validation: either `node_id` or `is_pocket_library` must be provided.

## UI

- **Book cards** show a Pocket Library badge (purple, package icon).
- **Book detail** displays the owner's contact email and custom borrow instructions
  ("Contact the owner to arrange pickup" instead of "Visit the node").
- **Add book page** has a radio toggle between node and Pocket Library modes.

## Future ideas

- Map view showing Pocket Library books by location
- In-app messaging between owner and borrower
- Transfer a Pocket Library book to a node
- Location-based search radius
