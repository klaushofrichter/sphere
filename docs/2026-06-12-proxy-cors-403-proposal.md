# Proposal: CORS headers on the proxy's bare-403 rejection paths

**Date:** 2026-06-12
**Target:** [een-oauth-proxy](https://github.com/klaushofrichter/een-oauth-proxy) — `proxy/src/index.js`
**Origin of this proposal:** debugging a transient login failure on the sphere
gallery's GitHub Pages deployment (filed as a GitHub issue on the proxy repo).

## The incident that motivated this

A browser console showed, during an OAuth code exchange from
`https://klaushofrichter.github.io`:

> Access to fetch at 'https://een-oauth-proxy…workers.dev/proxy/getAccessToken…'
> has been blocked by CORS policy: No 'Access-Control-Allow-Origin' header is
> present on the requested resource.

Investigation showed the origin **was** in `ALLOWED_ORIGINS` (verified by
probe), the worker had not been redeployed in months, and the same flow passed
end-to-end verification minutes before and after. The incident was transient —
but diagnosing it was needlessly hard, because when a response carries no CORS
headers, the browser hides its status and body from the page and reports only
a generic CORS failure. Every possible rejection looked identical from the
outside.

## Current behavior

The worker's `fetch` handler wraps nearly every response in `addCorsHeaders()`:
route results, token-exchange failures, the 429 rate limiter, even caught 500s.
Exactly two paths return bare responses without CORS headers:

```js
// 1) Origin not in ALLOWED_ORIGINS
const corsResult = validateOrigin(origin, env)
if (!corsResult.valid) {
  return new Response('Forbidden: Invalid origin', { status: 403 })
}

// 2) CSRF guard: state-changing request without an Origin header
if ((request.method === 'POST' || request.method === 'DELETE') && !origin) {
  return new Response('Forbidden: Origin header required', { status: 403 })
}
```

Consequences:

- A misconfigured allowlist, an Origin-stripping browser extension, and a
  Cloudflare edge error are **indistinguishable** from the calling page and in
  the console — all three surface as the same generic CORS block.
- The helpful rejection messages ("Invalid origin", "Origin header required")
  are written but never readable by the affected client.

## Proposed change

Attach CORS headers to both rejection responses:

```js
const corsResult = validateOrigin(origin, env)
if (!corsResult.valid) {
  return addCorsHeaders(
    new Response('Forbidden: Invalid origin', { status: 403 }),
    origin || '*',
    env,
  )
}

if ((request.method === 'POST' || request.method === 'DELETE') && !origin) {
  return addCorsHeaders(
    new Response('Forbidden: Origin header required', { status: 403 }),
    '*',
    env,
  )
}
```

Notes:

- For path 1 the rejected origin itself is echoed in
  `Access-Control-Allow-Origin`. This grants nothing: a specific-origin ACAO
  only lets *that* page read *this* response, whose body is a static
  "Forbidden" string. It does not whitelist the origin for any other request —
  every request re-validates.
- For path 2 there is no origin to echo; `'*'` lets a stripped-Origin client
  read the explanation. `getCorsHeaders` already omits
  `Access-Control-Allow-Credentials` when the origin is `'*'`, so the
  credentialed-wildcard combination cannot arise.

## Security analysis

- No data leaks: both bodies are static strings; no session, token, or
  configuration content.
- No access widening: CORS response headers are per-response read permissions,
  not an allowlist mutation. A disallowed origin still receives 403 for every
  request.
- Prior art: returning CORS headers on 401/403 is common API practice
  precisely so clients can distinguish auth failures from network failures.

## What this does NOT fix (out of scope)

Cloudflare **edge-level** errors (platform 5xx, quota, challenge pages) never
reach worker code and will still surface as CORS-less responses. That residual
case becomes easy to identify by elimination once the worker's own rejections
carry headers: if a CORS-less response still appears, it came from the edge,
not the worker.

## Suggested tests

The proxy's vitest suite already covers the 403 paths' status codes; extend
those cases to assert `Access-Control-Allow-Origin` is present on:
1. a request with a disallowed Origin (expect ACAO echoing that origin),
2. a POST with no Origin header (expect ACAO `*` and no
   `Access-Control-Allow-Credentials`).
