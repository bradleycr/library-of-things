export interface LendingTerms {
  type: "borrow" | "trade" | "sell" | "gift" | "browse-only"
  // Pricing options
  is_free: boolean
  sale_price?: number // Price if owner is open to selling
  // Identity requirements
  requires_id: boolean // Does checkout require identification?
  pseudonymous_allowed: boolean // Can be checked out pseudonymously?
  /** When true, only borrowers who have added contact info (email, phone, or social) to their profile may check out. Still trust-based. */
  contact_required: boolean
  loan_period_days: number
  shipping_allowed: boolean
  local_only: boolean
  contact_opt_in: boolean
}

export interface Book {
  id: string
  isbn?: string
  title: string
  author?: string
  edition?: string
  qr_tag_id: string
  checkout_url: string // URL for QR/NFC tag: /book/{uuid}/checkout?token={secret}
  cover_image_url?: string
  /** Short description (e.g. from Open Library); optional, for display on book page. */
  description?: string
  current_holder_id?: string
  current_holder_name?: string
  current_location_lat?: number
  current_location_lng?: number
  current_location_text?: string
  /** 
   * For node-based books, this is the library node where the book is housed.
   * For Pocket Library (floating) books, this is null - the book is kept by the owner.
   */
  current_node_id?: string
  current_node_name?: string
  /** User who added this book to the library; enables "Added by" attribution. */
  added_by_user_id?: string
  /** Display name of the user who added the book (denormalized for listing). */
  added_by_display_name?: string
  /**
   * For Pocket Library (floating) books without a node, the owner's contact email
   * so borrowers can reach out to arrange pickup/return.
   */
  owner_contact_email?: string
  /**
   * Whether this is a Pocket Library book (floating, not at a node).
   * When true, the book is kept by the owner and borrowers contact them directly.
   */
  is_pocket_library?: boolean
  availability_status: "available" | "checked_out" | "in_transit" | "retired"
  lending_terms: LendingTerms
  created_at: string
  expected_return_date?: string
}

/** Optional contact info shown on profile when contact_opt_in is true. */
export interface UserContactInfo {
  /** Public contact email (optional; may differ from auth email). */
  contact_email?: string
  phone?: string
  twitter_url?: string
  linkedin_url?: string
  website_url?: string
}

export interface User {
  id: string
  display_name: string
  email?: string
  auth_provider?: "email" | "linkedin" | "twitter" | "library_card"
  real_name?: string
  trust_score: number
  community_memberships: string[]
  created_at: string
  /** When true, show contact section on profile if any contact method is set. */
  contact_opt_in?: boolean
  /** Optional; only shown when contact_opt_in is true. */
  contact_email?: string
  phone?: string
  twitter_url?: string
  linkedin_url?: string
  website_url?: string
}

export interface LoanEvent {
  id: string
  event_type: "added" | "checkout" | "return" | "transfer" | "report_lost" | "report_damaged"
  book_id: string
  book_title?: string
  user_id?: string
  user_display_name?: string
  timestamp: string
  location_lat?: number
  location_lng?: number
  location_text?: string
  previous_holder_id?: string
  new_holder_id?: string
  notes?: string
  metadata?: Record<string, unknown>
}

export interface Node {
  id: string
  name: string
  type: "home" | "cafe" | "coworking" | "library" | "bookstore" | "little_free_library"
  location_lat?: number
  location_lng?: number
  location_address?: string
  steward_id: string
  public: boolean
  capacity?: number
  operating_hours?: string
  created_at: string
}

export interface Community {
  id: string
  name: string
  description?: string
  gating_mechanism: "open" | "invite_only" | "token_gated" | "zupass"
  members: string[]
  created_at: string
}

/** Single trust score change — used for "where your score came from" breakdown. */
export interface TrustEvent {
  id: string
  user_id: string
  reason: "return_on_time" | "return_late" | "return_very_late" | "add_book"
  delta: number
  score_after: number
  book_id?: string | null
  book_title?: string | null
  created_at: string
}

export interface LibraryCard {
  id: string
  card_number: string // 16-digit number like "4532 1098 7654 1942"
  pin: string // 4-digit PIN (only present client-side / when just created or logged in)
  pseudonym: string // Auto-generated pseudonym e.g. "CleverRaven47"
  user_id?: string // Backend user id (present for cards created or logged in via API)
  created_at: string
  last_accessed?: string
  access_count: number
  status: "active" | "suspended" | "expired"
  encrypted_data?: string // Optional encrypted metadata
}

export interface LibraryCardSession {
  card_id: string
  card_number: string
  pseudonym: string
  is_active: boolean
  last_activity: string
  expires_at?: string
}
