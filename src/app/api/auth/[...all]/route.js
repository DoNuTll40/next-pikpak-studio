import { getAuth } from "@/lib/server/auth";

function handle(request) {
  if (!/^\/api\/auth\/callback\/(google|line|facebook)$/.test(new URL(request.url).pathname)) {
    return new Response(null, { status: 404 });
  }
  const auth = getAuth();
  return auth ? auth.handler(request) : Response.json({ error: "OAuth is not configured" }, { status: 503 });
}

export { handle as GET, handle as POST };
