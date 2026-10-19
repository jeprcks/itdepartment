# HRIS SSO

HRIS remains the identity provider. A logged-in HRMS user opens Project Management from the HRMS nav. HRMS posts a one-time `token` to `POST /api/sso/hris`. This app sends that token to `HRIS_SSO_CONSUME_URL` as JSON `{ token, nonce, audience: "project_management" }`, signed as HMAC-SHA256 over `timestamp + "." + raw JSON body` in `X-SSO-Timestamp` and `X-SSO-Signature`. The HRMS response is verified the same way. A matching nonce and audience create an HttpOnly session cookie.

The launch stays hidden in HRMS until `PROJECT_MANAGEMENT_SSO_URL`, `PROJECT_MANAGEMENT_SSO_SECRET`, `PROJECT_MANAGEMENT_SSO_AUDIENCE=project_management`, and `PROJECT_MANAGEMENT_SSO_ALLOWED_HOST` are set on the HRMS server. Use a new secret. Do not reuse the Inventory secret, the IT Support secret, or `APP_SECRET`.

This has not been tested against the live HRMS.

`HRIS_SSO_TEST_MODE=true` runs only when `NODE_ENV` is not `production`. The test signer in `lib/sso/adapter.ts` is a local harness. It is not the HRIS protocol. A previously exposed `APP_SECRET` must not be used.

The in-memory nonce set and session map exist for tests. They are not shared storage and must be replaced before any real login.

## Missing HRIS details

- SSO initiation endpoint.
- Callback URL and HTTP method.
- Required headers and payload.
- Exact canonical message used for signing.
- Signature encoding.
- Timestamp tolerance and replay-protection requirements.
- Employee identity fields.
- Expected issuer and audience.
- Session and logout behavior.

## Environment variables

Set these on the server. Do not commit values.

- `HRIS_SSO_ENABLED`
- `HRIS_SSO_PROTOCOL` (`unconfirmed` until the contract is validated)
- `HRIS_SSO_TEST_MODE` (never `true` in production)
- `HRIS_SSO_ISSUER`
- `HRIS_SSO_AUDIENCE`
- `HRIS_SSO_SECRET`
- `HRIS_SSO_MAX_AGE_SECONDS`

Share `HRIS_SSO_SECRET` with HRIS through the host's secret store, separately from this repository.
