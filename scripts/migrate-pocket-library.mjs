import { Pool } from "pg"

const connectionString = process.env.DATABASE_URL

if (!connectionString) {
  console.error("DATABASE_URL is missing. Set it before running migration.")
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
    
    console.log("Adding Pocket Library support columns to books table...")
    
    // Add owner_contact_email column for floating books
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'books' AND column_name = 'owner_contact_email'
        ) THEN
          ALTER TABLE books ADD COLUMN owner_contact_email text;
        END IF;
      END $$;
    `)
    
    // Add is_pocket_library flag
    await client.query(`
      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM information_schema.columns
          WHERE table_name = 'books' AND column_name = 'is_pocket_library'
        ) THEN
          ALTER TABLE books ADD COLUMN is_pocket_library boolean not null default false;
        END IF;
      END $$;
    `)
    
    // Make current_node_id truly optional for pocket library books
    await client.query(`
      ALTER TABLE books ALTER COLUMN current_node_id DROP NOT NULL;
    `)
    
    // Create index for pocket library books
    await client.query(`
      CREATE INDEX IF NOT EXISTS idx_books_is_pocket_library ON books(is_pocket_library);
    `)

    await client.query("commit")
    console.log("✅ Migration completed successfully!")
    console.log("- Added owner_contact_email column")
    console.log("- Added is_pocket_library flag")
    console.log("- Made current_node_id nullable")
    console.log("- Created index for pocket library books")
  } catch (error) {
    await client.query("rollback")
    console.error("❌ Migration failed:", error)
    process.exitCode = 1
  } finally {
    client.release()
    await pool.end()
  }
}

void main()
