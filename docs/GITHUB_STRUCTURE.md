# Структура репозитория

- `src/` — React-интерфейс STOP WORK.
- `worker/` — Cloudflare Worker entrypoint и будущий API.
- `migrations/` — SQL-схема Cloudflare D1.
- `public/` — PWA manifest и service worker.
- `.github/workflows/` — автоматическая проверка сборки.
- `wrangler.toml` — конфигурация Cloudflare.

## Роли целевой системы
- employee — регистрирует опасность и отслеживает свои сообщения;
- team_leader — координирует устранение опасности;
- hse — проверяет риски и подтверждает меры контроля;
- manager — контролирует сроки и показатели;
- admin — управляет пользователями и справочниками.

Роли описывают целевую архитектуру. В текущем frontend MVP вход и серверная авторизация ещё не реализованы.
