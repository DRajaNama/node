# Lead automations

Lead automations are persisted in MongoDB and dispatched through the existing
BullMQ/Redis worker infrastructure. The application startup creates the
automation indexes before accepting traffic, including the unique indexes used
for first-time webhook and same-dispatch deduplication.

## Required configuration

- `AUTOMATION_ENCRYPTION_KEY` is required outside tests before saving or using
  secret webhook headers. Use a stable 32-byte base64 value, a 64-character hex
  value, or a strong passphrase. Rotating this value without re-encrypting
  existing records makes their secrets unreadable.
- Existing `MONGO_URI` and Redis settings are required by the API and workers.

For disposable local development only,
`AUTOMATION_ALLOW_INSECURE_DEV_KEY=true` enables a known fallback key and emits
a warning. This override is ignored in production.

## Optional webhook limits

- `AUTOMATION_WEBHOOK_TIMEOUT_MS` (default `10000`, clamped to 1–30 seconds)
- `AUTOMATION_WEBHOOK_MAX_REQUEST_BYTES` (default `262144`, max 1 MiB)
- `AUTOMATION_WEBHOOK_MAX_RESPONSE_BYTES` (default `65536`, max 256 KiB)
- `AUTOMATION_ALLOW_PRIVATE_WEBHOOKS=true` permits private/local destinations
  only outside production, primarily for local integration testing.

Webhook deliveries include a stable `Idempotency-Key` unless the automation
defines one. Receivers should persist that key because network failures can
make delivery acknowledgement ambiguous. SMTP itself has no portable
exactly-once primitive, so an SMTP timeout after provider acceptance can still
produce at-least-once delivery.

## Access and plans

Automation routes use the existing role-permission registry, owner scoping,
the `marketing_automation` feature entitlement, and the
`automation_workflows` create limit. Default plans with marketing automation
enabled treat workflow count as unlimited; custom plans can set a numeric
limit. Startup backfills the old inert zero placeholder in matching plans and
active subscription snapshots.

