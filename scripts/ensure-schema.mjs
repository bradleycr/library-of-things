/**
 * Ensures all required tables and columns exist. Does NOT truncate or seed.
 * Safe to run on existing/production DBs. Use when you see "Server setup incomplete"
 * or after creating a new Supabase project.
 *
 * Usage: pnpm db:ensure-schema
 * (requires DATABASE_URL in .env.local)
 */

import { Pool } from "pg"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error("DATABASE_URL is missing. Set it in .env.local and run: pnpm db:ensure-schema")
  process.exit(1)
}

const pool = new Pool({
  connectionString,
  ssl: { rejectUnauthorized: false },
})

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

    // Scope all column checks to table_schema='public' — Supabase also has auth.users
    // which can cause false positives (e.g. auth.users.phone exists, public.users.phone does not).
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
        availability_status text not null check (availability_status in ('available','checked_out','in_transit','retired')),
        lending_terms jsonb not null,
        created_at timestamptz not null default now(),
        expected_return_date timestamptz
      );
    `)

    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'checkout_url') THEN
          ALTER TABLE public.books ADD COLUMN checkout_url text;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'added_by_user_id') THEN
          ALTER TABLE public.books ADD COLUMN added_by_user_id text REFERENCES public.users(id) ON DELETE SET NULL;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'added_by_display_name') THEN
          ALTER TABLE public.books ADD COLUMN added_by_display_name text;
        END IF;
        IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'books' AND column_name = 'description') THEN
          ALTER TABLE public.books ADD COLUMN description text;
        END IF;
      END $$;
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

    // Allow 'added' in existing DBs (migration for older schema)
    await client.query(`
      alter table loan_events drop constraint if exists loan_events_event_type_check;
      alter table loan_events add constraint loan_events_event_type_check
        check (event_type in ('added','checkout','return','transfer','report_lost','report_damaged'));
    `)

    await client.query(`
      create index if not exists idx_books_added_by_user_id on books(added_by_user_id)
    `)
    await client.query("commit")
    console.log("Schema ensured. Tables: users, nodes, books, library_cards, loan_events.")
  } catch (error) {
    await client.query("rollback")
    console.error("Schema ensure failed:", error.message)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

void main()
