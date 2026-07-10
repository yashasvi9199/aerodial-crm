# Cloudflare Pages Environment Variables Configuration

To run your production build on Cloudflare Pages, you need to configure your Supabase variables in the Cloudflare Pages settings panel.

### Steps to configure:

1. **Log in** to your Cloudflare Dashboard.
2. Select your Pages project (**aerodial-crm**).
3. Navigate to **Settings** > **Environment variables**.
4. Click **Add variables** under the **Production** (and optionally Preview) section.
5. Add the following variables:
   - **`VITE_SUPABASE_URL`**: `https://xqmyinmyhirtvxtgjmya.supabase.co`
   - **`VITE_SUPABASE_ANON_KEY`**: *(Your anon public key)*
6. Click **Save**.
7. Go to **Deployments** and click **Retry deployment** or push a new commit to rebuild the project with the variables.
