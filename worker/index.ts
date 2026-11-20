export interface Env {
  ASSETS: Fetcher;
  DB: D1Database;
  UPLOADS?: R2Bucket;
}

type CaseStatus = "open" | "review" | "resolved" | "released";
const allowedStatuses = new Set<CaseStatus>(["open", "review", "resolved", "released"]);

function json(data: unknown, status = 200): Response {
  return Response.json(data, { status, headers: { "Cache-Control": "no-store" } });
}

function mapCase(row: Record<string, unknown>) {
  return {
    id: row.id,
    location: row.location,
    hazard_type: row.hazard_type,
    description: row.description,
    status: row.status,
    reporter_id: row.reporter_id,
    created_at: row.created_at,
    updated_at: row.updated_at
  };
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    const path = url.pathname;

    if (path === "/api/health" && request.method === "GET") {
      try {
        await env.DB.prepare("SELECT 1").first();
        return json({ ok: true, service: "stop-work-safety", storage: "d1-connected" });
      } catch {
        return json({ ok: false, service: "stop-work-safety", storage: "d1-error" }, 503);
      }
    }

    if (path === "/api/cases" && request.method === "GET") {
      try {
        const result = await env.DB.prepare(
          "SELECT id, location, hazard_type, description, status, reporter_id, created_at, updated_at FROM stop_cases ORDER BY created_at DESC"
        ).all();
        return json({ cases: (result.results ?? []).map(row => mapCase(row as Record<string, unknown>)) });
      } catch {
        return json({ error: "Не удалось загрузить журнал. Проверьте применение D1 migration." }, 500);
      }
    }

    if (path === "/api/cases" && request.method === "POST") {
      let body: Record<string, unknown>;
      try { body = await request.json() as Record<string, unknown>; }
      catch { return json({ error: "Некорректный JSON" }, 400); }

      const location = typeof body.location === "string" ? body.location.trim() : "";
      const hazardType = typeof body.hazard_type === "string" ? body.hazard_type.trim() : "";
      const description = typeof body.description === "string" ? body.description.trim() : "";
      const reporterId = typeof body.reporter_id === "string" && body.reporter_id.trim()
        ? body.reporter_id.trim().slice(0, 120) : "anonymous";

      if (!location || !hazardType || !description) {
        return json({ error: "Заполните место, тип опасности и описание." }, 400);
      }
      if (location.length > 200 || hazardType.length > 100 || description.length > 4000) {
        return json({ error: "Превышена допустимая длина одного из полей." }, 400);
      }

      const id = "SW-" + crypto.randomUUID();
      try {
        await env.DB.prepare(
          "INSERT INTO stop_cases (id, location, hazard_type, description, status, reporter_id) VALUES (?, ?, ?, ?, 'open', ?)"
        ).bind(id, location, hazardType, description, reporterId).run();
        await env.DB.prepare(
          "INSERT INTO case_events (case_id, actor_id, action, note) VALUES (?, ?, 'created', ?)"
        ).bind(id, reporterId, "STOP WORK зарегистрирован").run();
        const created = await env.DB.prepare(
          "SELECT id, location, hazard_type, description, status, reporter_id, created_at, updated_at FROM stop_cases WHERE id = ?"
        ).bind(id).first();
        return json({ case: created ? mapCase(created as Record<string, unknown>) : null }, 201);
      } catch {
        return json({ error: "Не удалось сохранить STOP WORK в D1." }, 500);
      }
    }

    const caseMatch = path.match(/^\/api\/cases\/([^/]+)$/);
    if (caseMatch && request.method === "PATCH") {
      let body: Record<string, unknown>;
      try { body = await request.json() as Record<string, unknown>; }
      catch { return json({ error: "Некорректный JSON" }, 400); }
      const status = body.status as CaseStatus;
      if (!allowedStatuses.has(status)) return json({ error: "Недопустимый статус." }, 400);
      const actorId = typeof body.actor_id === "string" && body.actor_id.trim()
        ? body.actor_id.trim().slice(0, 120) : "system";
      const note = typeof body.note === "string" ? body.note.slice(0, 1000) : null;
      try {
        const result = await env.DB.prepare(
          "UPDATE stop_cases SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?"
        ).bind(status, decodeURIComponent(caseMatch[1])).run();
        if (!result.meta.changes) return json({ error: "Заявка не найдена." }, 404);
        await env.DB.prepare(
          "INSERT INTO case_events (case_id, actor_id, action, note) VALUES (?, ?, ?, ?)"
        ).bind(decodeURIComponent(caseMatch[1]), actorId, "status:" + status, note).run();
        const updated = await env.DB.prepare(
          "SELECT id, location, hazard_type, description, status, reporter_id, created_at, updated_at FROM stop_cases WHERE id = ?"
        ).bind(decodeURIComponent(caseMatch[1])).first();
        return json({ case: updated ? mapCase(updated as Record<string, unknown>) : null });
      } catch {
        return json({ error: "Не удалось обновить статус." }, 500);
      }
    }

    if (path.startsWith("/api/")) return json({ error: "API endpoint not found" }, 404);
    return env.ASSETS.fetch(request);
  }
};
