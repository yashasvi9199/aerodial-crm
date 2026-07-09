export async function onRequest(context) {
  const env = context.env;
  const body = `window.VITE_SUPABASE_URL = "${env.VITE_SUPABASE_URL || ''}";
window.VITE_SUPABASE_ANON_KEY = "${env.VITE_SUPABASE_ANON_KEY || ''}";`;
  
  return new Response(body, {
    headers: {
      "content-type": "application/javascript",
    },
  });
}
