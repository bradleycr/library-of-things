import { Pool } from "pg"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error("DATABASE_URL is missing. Set it before running provision-db.")
  process.exit(1)
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

const users = [
  {
    id: "u1",
    display_name: "CleverRaven88",
    email: "raven@example.com",
    auth_provider: "email",
    trust_score: 92,
    community_memberships: ["c1"],
    created_at: "2024-06-01T10:00:00Z",
  },
  {
    id: "u2",
    display_name: "WanderingOwl42",
    email: "owl@example.com",
    auth_provider: "linkedin",
    trust_score: 87,
    community_memberships: ["c1"],
    created_at: "2024-07-15T14:00:00Z",
  },
  {
    id: "u3",
    display_name: "BrightFox29",
    email: "fox@example.com",
    auth_provider: "twitter",
    trust_score: 74,
    community_memberships: ["c1", "c2"],
    created_at: "2024-08-01T09:30:00Z",
  },
  {
    id: "u4",
    display_name: "CuriousDeer17",
    email: "deer@example.com",
    auth_provider: "email",
    trust_score: 95,
    community_memberships: ["c2"],
    created_at: "2024-09-10T11:00:00Z",
  },
]

// Foresight Flybrary locations only: Berlin (CIC) and SF (The Fold). No cafe or other nodes.
const nodes = [
  {
    id: "n1",
    name: "Foresight Berlin Flybrary",
    type: "coworking",
    location_lat: 52.4977,
    location_lng: 13.4478,
    location_address: "Lohmühlenstraße 65, 12435 Berlin · +49 176 22525121",
    steward_id: "u1",
    public: true,
    capacity: 120,
    operating_hours: "Open 24 hours",
    created_at: "2024-05-01T08:00:00Z",
  },
  {
    id: "n2",
    name: "Foresight SF Flybrary",
    type: "coworking",
    location_lat: 37.7506,
    location_lng: -122.4144,
    location_address: "3359 26th Street, San Francisco, CA 94110",
    steward_id: "u2",
    public: true,
    capacity: 80,
    operating_hours: "Event hours at The Fold",
    created_at: "2024-06-15T10:00:00Z",
  },
]

const defaultTerms = {
  type: "borrow",
  is_free: true,
  sale_price: null,
  requires_id: false,
  pseudonymous_allowed: true,
  contact_required: false,
  loan_period_days: 21,
  shipping_allowed: false,
  local_only: true,
  contact_opt_in: true,
}

// Helper to generate checkout URL with simple token
function generateCheckoutUrl(bookId) {
  const token = Buffer.from(`${bookId}-${Date.now()}`).toString('base64url')
  return `/book/${bookId}/checkout?token=${token}`
}

const books = [
  {
    id: "b1",
    isbn: "9780593189481",
    title: "The Precipice",
    author: "Toby Ord",
    edition: null,
    qr_tag_id: "qr-001",
    checkout_url: generateCheckoutUrl("b1"),
    cover_image_url: "https://covers.openlibrary.org/b/isbn/9780316484923-L.jpg",
    current_holder_id: null,
    current_holder_name: null,
    current_location_lat: null,
    current_location_lng: null,
    current_location_text: "Foresight Berlin Flybrary, Shelf A",
    current_node_id: "n1",
    current_node_name: "Foresight Berlin Flybrary",
    availability_status: "available",
    lending_terms: defaultTerms,
    created_at: "2024-06-01T12:00:00Z",
    expected_return_date: null,
  },
  {
    id: "b2",
    isbn: "9780199678112",
    title: "Superintelligence",
    author: "Nick Bostrom",
    edition: null,
    qr_tag_id: "qr-002",
    checkout_url: generateCheckoutUrl("b2"),
    cover_image_url: "https://covers.openlibrary.org/b/isbn/9780199678112-L.jpg",
    current_holder_id: "u2",
    current_holder_name: "WanderingOwl42",
    current_location_lat: null,
    current_location_lng: null,
    current_location_text: "With WanderingOwl42",
    current_node_id: "n1",
    current_node_name: "Foresight Berlin Flybrary",
    availability_status: "checked_out",
    lending_terms: defaultTerms,
    created_at: "2024-06-01T12:00:00Z",
    expected_return_date: "2026-03-01T00:00:00Z",
  },
  {
    id: "b3",
    isbn: "9780525558613",
    title: "Human Compatible",
    author: "Stuart Russell",
    edition: null,
    qr_tag_id: "qr-003",
    checkout_url: generateCheckoutUrl("b3"),
    cover_image_url: "https://covers.openlibrary.org/b/isbn/9780525558613-L.jpg",
    current_holder_id: null,
    current_holder_name: null,
    current_location_lat: null,
    current_location_lng: null,
    current_location_text: "Foresight Berlin Flybrary, Shelf B",
    current_node_id: "n1",
    current_node_name: "Foresight Berlin Flybrary",
    availability_status: "available",
    lending_terms: defaultTerms,
    created_at: "2024-06-01T12:00:00Z",
    expected_return_date: null,
  },
  {
    id: "b4",
    isbn: "9781101946596",
    title: "Life 3.0",
    author: "Max Tegmark",
    edition: null,
    qr_tag_id: "qr-004",
    checkout_url: generateCheckoutUrl("b4"),
    cover_image_url: "https://covers.openlibrary.org/b/isbn/9781101946596-L.jpg",
    current_holder_id: null,
    current_holder_name: null,
    current_location_lat: null,
    current_location_lng: null,
    current_location_text: "Foresight SF Flybrary, Shelf A",
    current_node_id: "n2",
    current_node_name: "Foresight SF Flybrary",
    availability_status: "available",
    lending_terms: { ...defaultTerms },
    created_at: "2024-06-15T12:00:00Z",
    expected_return_date: null,
  },
  {
    id: "b5",
    isbn: "9780393635829",
    title: "The Alignment Problem",
    author: "Brian Christian",
    edition: null,
    qr_tag_id: "qr-005",
    checkout_url: generateCheckoutUrl("b5"),
    cover_image_url: "https://covers.openlibrary.org/b/isbn/9780393635829-L.jpg",
    current_holder_id: "u3",
    current_holder_name: "BrightFox29",
    current_location_lat: null,
    current_location_lng: null,
    current_location_text: "With BrightFox29",
    current_node_id: "n1",
    current_node_name: "Foresight Berlin Flybrary",
    availability_status: "checked_out",
    lending_terms: defaultTerms,
    created_at: "2024-06-01T12:00:00Z",
    expected_return_date: "2026-02-28T00:00:00Z",
  },
  {
    id: "b6",
    isbn: "9781541618626",
    title: "What We Owe the Future",
    author: "William MacAskill",
    edition: null,
    qr_tag_id: "qr-006",
    checkout_url: generateCheckoutUrl("b6"),
    cover_image_url: "https://covers.openlibrary.org/b/isbn/9781541618626-L.jpg",
    current_holder_id: "u1",
    current_holder_name: "CleverRaven88",
    current_location_lat: null,
    current_location_lng: null,
    current_location_text: "With CleverRaven88",
    current_node_id: "n1",
    current_node_name: "Foresight Berlin Flybrary",
    availability_status: "checked_out",
    lending_terms: defaultTerms,
    created_at: "2024-06-01T12:00:00Z",
    expected_return_date: "2026-02-25T00:00:00Z",
  },
]

const loanEvents = [
  {
    id: "e1",
    event_type: "checkout",
    book_id: "b2",
    book_title: "Superintelligence",
    user_id: "u2",
    user_display_name: "WanderingOwl42",
    timestamp: "2026-02-08T14:30:00Z",
    location_text: "Foresight Berlin Flybrary",
    notes: null,
  },
  {
    id: "e2",
    event_type: "checkout",
    book_id: "b5",
    book_title: "The Alignment Problem",
    user_id: "u3",
    user_display_name: "BrightFox29",
    timestamp: "2026-02-06T10:15:00Z",
    location_text: "Foresight Berlin Flybrary",
    notes: null,
  },
  {
    id: "e3",
    event_type: "return",
    book_id: "b1",
    book_title: "The Precipice",
    user_id: "u1",
    user_display_name: "CleverRaven88",
    timestamp: "2026-02-05T16:45:00Z",
    location_text: "Foresight Berlin Flybrary",
    notes: null,
  },
  {
    id: "e4",
    event_type: "checkout",
    book_id: "b6",
    book_title: "What We Owe the Future",
    user_id: "u1",
    user_display_name: "CleverRaven88",
    timestamp: "2026-01-15T11:20:00Z",
    location_text: "Foresight Berlin Flybrary",
    notes: null,
  },
  {
    id: "e5",
    event_type: "transfer",
    book_id: "b4",
    book_title: "Life 3.0",
    user_id: "u2",
    user_display_name: "WanderingOwl42",
    timestamp: "2025-11-15T16:00:00Z",
    location_text: "Foresight SF Flybrary",
    notes: "Transferred at Foresight SF Flybrary",
  },
]

async function main() {
  const client = await pool.connect()
  try {
    await client.query("begin")
    await client.query(`
      create table if not exists users (
        id text primary key,
        display_name text not null unique,
        email text,
        auth_provider text,
        real_name text,
        profile_picture_url text,
        trust_score integer not null default 50,
        community_memberships text[] not null default '{}',
        created_at timestamptz not null default now()
      );
    `)

    // Optional contact fields (migration: add if not exist).
    // Scope to table_schema='public' — Supabase has auth.users with overlapping column names (e.g. phone).
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'contact_opt_in') THEN
          ALTER TABLE public.users ADD COLUMN contact_opt_in boolean not null default true;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'contact_email') THEN
          ALTER TABLE public.users ADD COLUMN contact_email text;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'phone') THEN
          ALTER TABLE public.users ADD COLUMN phone text;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'twitter_url') THEN
          ALTER TABLE public.users ADD COLUMN twitter_url text;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'linkedin_url') THEN
          ALTER TABLE public.users ADD COLUMN linkedin_url text;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'users' AND column_name = 'website_url') THEN
          ALTER TABLE public.users ADD COLUMN website_url text;
        END IF;
      END $$;
    `)

    await client.query(`
      create table if not exists nodes (
        id text primary key,
        name text not null,
        type text not null,
        location_lat double precision,
        location_lng double precision,
        location_address text,
        steward_id text not null references users(id) on delete restrict,
        public boolean not null default true,
        capacity integer,
        operating_hours text,
        created_at timestamptz not null default now()
      );
    `)

    // Add checkout_url column if it doesn't exist (migration)
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'books' AND column_name = 'checkout_url'
        ) THEN
          ALTER TABLE books ADD COLUMN checkout_url text;
        END IF;
      END $$;
    `)

    await client.query(`
      create table if not exists books (
        id text primary key,
        isbn text,
        title text not null,
        author text,
        edition text,
        qr_tag_id text not null unique,
        checkout_url text not null,
        cover_image_url text,
        current_holder_id text references users(id) on delete set null,
        current_holder_name text,
        current_location_lat double precision,
        current_location_lng double precision,
        current_location_text text,
        current_node_id text references nodes(id) on delete set null,
        current_node_name text,
        added_by_user_id text references users(id) on delete set null,
        added_by_display_name text,
        owner_contact_email text,
        is_pocket_library boolean not null default false,
        availability_status text not null check (availability_status in ('available','checked_out','in_transit','retired')),
        lending_terms jsonb not null,
        created_at timestamptz not null default now(),
        expected_return_date timestamptz
      );
    `)

    await client.query(`
      create table if not exists library_cards (
        id text primary key,
        card_number text not null unique,
        pin_hash text not null,
        user_id text not null references users(id) on delete cascade,
        pseudonym text not null,
        created_at timestamptz not null default now()
      );
    `)

    await client.query(`
      create table if not exists loan_events (
        id text primary key,
        event_type text not null check (event_type in ('added','checkout','return','transfer','report_lost','report_damaged')),
        book_id text not null references books(id) on delete cascade,
        book_title text,
        user_id text not null references users(id) on delete restrict,
        user_display_name text,
        timestamp timestamptz not null default now(),
        location_lat double precision,
        location_lng double precision,
        location_text text,
        previous_holder_id text,
        new_holder_id text,
        notes text,
        metadata jsonb
      );
    `)

    await client.query("truncate table loan_events restart identity cascade")
    await client.query("truncate table books restart identity cascade")
    await client.query("truncate table nodes restart identity cascade")
    await client.query("truncate table library_cards restart identity cascade")
    await client.query("truncate table users restart identity cascade")

    for (const u of users) {
      await client.query(
        `insert into users (id, display_name, email, auth_provider, trust_score, community_memberships, created_at)
         values ($1, $2, $3, $4, $5, $6, $7)`,
        [
          u.id,
          u.display_name,
          u.email,
          u.auth_provider,
          u.trust_score,
          u.community_memberships,
          u.created_at,
        ]
      )
    }

    for (const n of nodes) {
      await client.query(
        `insert into nodes (id, name, type, location_lat, location_lng, location_address, steward_id, public, capacity, operating_hours, created_at)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
        [
          n.id,
          n.name,
          n.type,
          n.location_lat,
          n.location_lng,
          n.location_address,
          n.steward_id,
          n.public,
          n.capacity,
          n.operating_hours,
          n.created_at,
        ]
      )
    }

    for (const b of books) {
      await client.query(
        `insert into books (id,isbn,title,author,edition,qr_tag_id,checkout_url,cover_image_url,current_holder_id,current_holder_name,current_location_lat,current_location_lng,current_location_text,current_node_id,current_node_name,added_by_user_id,added_by_display_name,owner_contact_email,is_pocket_library,availability_status,lending_terms,created_at,expected_return_date)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,$21::jsonb,$22,$23)`,
        [
          b.id,
          b.isbn,
          b.title,
          b.author,
          b.edition,
          b.qr_tag_id,
          b.checkout_url,
          b.cover_image_url,
          b.current_holder_id,
          b.current_holder_name,
          b.current_location_lat,
          b.current_location_lng,
          b.current_location_text,
          b.current_node_id,
          b.current_node_name,
          b.added_by_user_id ?? null,
          b.added_by_display_name ?? null,
          b.owner_contact_email ?? null,
          b.is_pocket_library ?? false,
          b.availability_status,
          JSON.stringify(b.lending_terms),
          b.created_at,
          b.expected_return_date,
        ]
      )
    }

    for (const e of loanEvents) {
      await client.query(
        `insert into loan_events (id,event_type,book_id,book_title,user_id,user_display_name,timestamp,location_text,notes)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
        [
          e.id,
          e.event_type,
          e.book_id,
          e.book_title,
          e.user_id,
          e.user_display_name,
          e.timestamp,
          e.location_text,
          e.notes,
        ]
      )
    }

    await client.query(
      "create index if not exists idx_books_availability_status on books(availability_status)"
    )
    await client.query(
      "create index if not exists idx_books_current_node_id on books(current_node_id)"
    )
    await client.query(
      "create index if not exists idx_books_is_pocket_library on books(is_pocket_library)"
    )
    await client.query(
      "create index if not exists idx_loan_events_book_timestamp on loan_events(book_id, timestamp desc)"
    )
    await client.query(
      "create index if not exists idx_loan_events_user_timestamp on loan_events(user_id, timestamp desc)"
    )

    await client.query("commit")
    console.log("Database provisioned and seeded successfully.")
  } catch (error) {
    await client.query("rollback")
    console.error("Provisioning failed:", error)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

void main()
