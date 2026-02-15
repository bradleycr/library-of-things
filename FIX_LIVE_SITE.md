# Fix the live site (database not connected)

Your **.env.local** is already updated to use the correct Supabase URL (port **6543**). Do these three steps so the live site uses it too.

---

## Step 1: Open Vercel env vars

**Click:** [Vercel → library-of-things → Environment Variables](https://vercel.com/bradley-royes-projects/library-of-things/settings/environment-variables)

---

## Step 2: Set DATABASE_URL in Vercel

1. If **DATABASE_URL** is already there, click **Edit**. Otherwise click **Add New**.
2. **Key:** `DATABASE_URL`
3. **Value:** Copy the **entire line** from your `.env.local` (the line that starts with `postgresql://postgres.ymndipepdnuidxpqlwdd:...` and ends with `...6543/postgres`).  
   It must use **6543**, not 5432.
4. Under **Environments**, tick **Production** and **Preview**.
5. Click **Save**.

---

## Step 3: Redeploy

1. Go to [Deployments](https://vercel.com/bradley-royes-projects/library-of-things/deployments).
2. Open the **⋯** menu on the latest deployment.
3. Click **Redeploy** → confirm.

Wait until the deployment is **Ready** (about 1–2 minutes).

---

## Step 4: Check it worked

Open: **https://libraryofthings.vercel.app/api/health**

- If you see **`{"ok":true}`** → database is connected. The homepage should show real catalog counts (or 0 if you haven’t added books yet).
- If you see **503** and `"error": "DATABASE_URL is required"` or a connection message → the new value isn’t in use yet. Make sure you saved the env var and redeployed.

---

**Summary:** Update `DATABASE_URL` in Vercel to the **6543** connection string (same as in your `.env.local`), then redeploy. After that, the live site will use your Supabase database.
