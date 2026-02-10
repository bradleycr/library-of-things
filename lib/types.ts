export interface LendingTerms {
  type: "borrow" | "trade" | "sell" | "gift" | "browse-only"
  deposit_required: boolean
  deposit_amount?: number
  loan_period_days: number
  shipping_allowed: boolean
  local_only: boolean
  member_only: boolean
  contact_opt_in: boolean
}

export interface Book {
  id: string
  isbn?: string
  title: string
  author?: string
  edition?: string
  qr_tag_id: string
  cover_image_url?: string
  current_holder_id?: string
  current_holder_name?: string
  current_location_lat?: number
  current_location_lng?: number
  current_location_text?: string
  current_node_id?: string
  current_node_name?: string
  availability_status: "available" | "checked_out" | "in_transit" | "retired"
  lending_terms: LendingTerms
  created_at: string
  expected_return_date?: string
}

export interface User {
  id: string
  display_name: string
  email?: string
  auth_provider?: "email" | "linkedin" | "twitter"
  real_name?: string
  profile_picture_url?: string
  trust_score: number
  community_memberships: string[]
  created_at: string
}

export interface LoanEvent {
  id: string
  event_type: "checkout" | "return" | "transfer" | "report_lost" | "report_damaged"
  book_id: string
  book_title?: string
  user_id: string
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
