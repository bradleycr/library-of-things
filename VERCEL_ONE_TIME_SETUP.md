# One-time: set env vars in Vercel (then redeploy)

The script can't set them (token scope). Do this once:

1. **Open:** https://vercel.com/bradley-royes-projects/library-of-things/settings/environment-variables

2. **Add two variables:**

   | Key | Value | Environments |
   |-----|--------|--------------|
   | `DATABASE_URL` | Copy from your `.env.local` (the full `postgresql://...` line) | Production, Preview |
   | `STEWARD_PASSWORD` | Pick a strong password for `/steward/login` | Production |

3. **Redeploy:**  
   Deployments → open the latest deployment → **⋯** → **Redeploy**  
   (Or push a commit to the connected branch to trigger a new deploy.)

4. **Live URL:** https://libraryofthings.vercel.app (add this domain in Settings → Domains if needed)
