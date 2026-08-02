/**
 * Cloudflare Worker – adds HTTP security headers to every response.
 *
 * Deployed via .github/workflows/deploy-worker.yml.
 * Required GitHub secrets:
 *   CLOUDFLARE_API_TOKEN  – a token with "Edit Workers" permission
 *   CLOUDFLARE_ACCOUNT_ID – your Cloudflare account ID
 */

const SECURITY_HEADERS = {
  // Enforce HTTPS for 1 year, include sub-domains, opt into the HSTS preload list
  "Strict-Transport-Security": "max-age=31536000; includeSubDomains; preload",

  // Prevent browsers from MIME-sniffing away from the declared content-type
  "X-Content-Type-Options": "nosniff",

  // Allow framing only from the same origin (defence against clickjacking)
  "X-Frame-Options": "SAMEORIGIN",

  // Send only the origin (no path/query) for cross-origin requests
  "Referrer-Policy": "strict-origin-when-cross-origin",

  // Restrict access to powerful browser features that the site does not use
  "Permissions-Policy":
    "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()",

  // Content Security Policy – mirrors the meta tag already in the HTML layout
  // so that both HTTP-header CSP (enforced by the browser before HTML is parsed)
  // and the meta tag (fallback) agree on the same policy.
  "Content-Security-Policy": [
    "default-src 'self'",
    "script-src 'self' https://platform.twitter.com",
    "style-src 'self' https://fonts.bunny.net",
    "font-src https://fonts.bunny.net",
    "img-src 'self' data: https://pbs.twimg.com https://abs.twimg.com",
    "frame-src https://open.spotify.com https://platform.twitter.com",
    "connect-src 'self' https://syndication.twitter.com",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "),
};

export default {
  async fetch(request, _env, _ctx) {
    const response = await fetch(request);

    const newHeaders = new Headers(response.headers);
    for (const [name, value] of Object.entries(SECURITY_HEADERS)) {
      newHeaders.set(name, value);
    }

    return new Response(response.body, {
      status: response.status,
      statusText: response.statusText,
      headers: newHeaders,
    });
  },
};
