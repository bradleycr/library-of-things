# Pocket Library Feature

## Overview

The **Pocket Library** feature enables decentralized book sharing, allowing users to add books to the Library of Things network without requiring them to be housed at a physical library node. This creates a more flexible, community-driven lending system.

## Key Features

### 1. **Two Ways to Add Books**

Users can now add books in two ways:

- **Library Node Books**: Traditional method where books are housed at a physical library location (e.g., Foresight Berlin Node)
- **Pocket Library Books**: "Floating books" that users keep in their personal possession but share through the network

### 2. **User-Facing Add Book Page**

- **Location**: `/add-book`
- **Features**:
  - ISBN lookup with OpenLibrary integration
  - Radio button selection between Node and Pocket Library
  - For Pocket Library books:
    - Required contact email field for arranging pickups
    - Optional location capture (auto-detects with browser geolocation)
  - Success dialog showing QR code URL for the book
  - Recommendation popup encouraging users to bring books to nodes
  
### 3. **Enhanced Book Display**

Books now display their type with visual indicators:

- **Pocket Library Badge**: Purple badge with package icon
- **Contact Information**: Email displayed for Pocket Library books
- **Location Icons**: Different icons for nodes (building) vs. pocket books (package)
- **Borrowing Instructions**: Customized instructions based on book type
  - Node books: "Visit the library node and scan the QR code"
  - Pocket books: "Contact the owner to arrange pickup"

## Database Schema Changes

New columns added to the `books` table:

```sql
owner_contact_email text              -- Contact email for Pocket Library books
is_pocket_library boolean NOT NULL DEFAULT false  -- Flag for Pocket Library books
```

Migration script: `npm run db:migrate-pocket-library`

## API Changes

### Updated Endpoint: `/api/books/create`

**New Request Parameters:**
- `is_pocket_library` (boolean): Whether this is a Pocket Library book
- `owner_contact_email` (string): Required for Pocket Library books
- `current_location_text` (string): Optional location description

**Validation:**
- Either `node_id` OR `is_pocket_library` must be provided
- If `is_pocket_library` is true, `owner_contact_email` is required

## Type Updates

The `Book` interface now includes:

```typescript
interface Book {
  // ... existing fields
  
  /** For Pocket Library books, owner's contact email */
  owner_contact_email?: string
  
  /** Whether this is a Pocket Library (floating) book */
  is_pocket_library?: boolean
}
```

## User Experience Flow

### Adding a Pocket Library Book

1. User navigates to `/add-book`
2. Requires library card (creates one if needed)
3. Enters book details (with optional ISBN lookup)
4. Selects "Pocket Library (Keep with me)"
5. Provides contact email
6. Optionally adds current location (auto-detected)
7. Sets lending terms
8. Submits form
9. Receives QR code URL for printing/NFC tag
10. Sees recommendation dialog to consider bringing book to a node

### Borrowing a Pocket Library Book

1. User finds book in catalog (marked with "Pocket" badge)
2. Views book detail page
3. Sees owner's contact email
4. Clicks "Contact Owner" button (opens email)
5. Arranges pickup with owner
6. Meets owner and scans book's QR code to check out

## Visual Design

### Components Updated

- **BookCard**: Shows Pocket Library badge and package icon
- **Book Detail Page**: Displays contact email, custom borrow instructions, and Pocket badge
- **Site Navigation**: New `/add-book` route (steward route moved to Admin dropdown)

### Color & Icon System

- **Pocket Library Badge**: Primary color with package icon
- **Node Books**: Building icon, traditional display
- **Location Indicators**: Package icon vs. Building icon

## Navigation Changes

- Main nav "Add a Book" now points to `/add-book` (user-facing)
- Steward add book page moved to Admin dropdown: `/steward/add-book`
- Homepage hero and footer updated to link to new page

## Scripts

- `npm run db:migrate-pocket-library` - Add Pocket Library columns
- `npm run db:provision` - Now includes Pocket Library schema

## Future Enhancements

Potential features to consider:

- [ ] Map view showing Pocket Library books by location
- [ ] Owner availability calendar
- [ ] Automatic email templates for borrowing requests
- [ ] Transfer Pocket Library books to nodes
- [ ] Pocket Library owner dashboard
- [ ] Location-based search radius
- [ ] NFC tag generation tool

## Benefits

### For Users
- Lower barrier to participation
- Keep favorite books while sharing
- More books available in the network
- Flexibility in sharing

### For the Network
- Increased catalog size
- Distributed book ownership
- Community engagement
- Reduced node capacity pressure

### For the Community
- Builds trust through direct contact
- Encourages personal connections
- Enables sharing in areas without nodes
- Grassroots library growth

## Technical Notes

- All Pocket Library books have `current_node_id = NULL`
- Location capture uses browser Geolocation API (falls back to manual entry)
- Email validation ensures proper contact info
- QR code URLs are identical to node-based books (same checkout flow)
- Lending history tracks Pocket Library books with "Pocket Library" location text

## Testing Checklist

- [x] Database migration runs successfully
- [x] Add book form validates correctly
- [x] Pocket Library books create with contact email
- [x] Node books still work as before
- [x] Book detail page shows correct info for both types
- [x] Book cards display Pocket Library badges
- [x] Navigation links updated
- [x] No TypeScript errors
- [x] No linting errors

## Clever Naming

The feature uses "**Pocket Library**" as the user-facing term for floating books:
- Friendly and accessible
- Suggests portability and personal ownership
- Contrasts nicely with formal "Library Node"
- Evokes the idea of "books in your pocket"
- Memorable and distinctive

Alternative names considered:
- Personal Library ❌ (too generic)
- Floating Books ❌ (technical, unclear)
- Mobile Library ❌ (confused with vehicle libraries)
- Pocket Library ✅ (perfect!)
