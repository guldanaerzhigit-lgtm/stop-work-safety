export interface Env {
  ASSETS: Fetcher;
  DB?: D1Database;
  UPLOADS?: R2Bucket;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/api/health") {
      return Response.json({ ok: true, service: "stop-work-safety", storage: env.DB ? "d1-configured" : "not-configured" });
    }
    if (url.pathname.startsWith("/api/")) {
      return Response.json({ error: "API endpoint is not implemented yet" }, { status: 501 });
    }
    return env.ASSETS.fetch(request);
  }
};