import { defineMiddleware } from 'astro:middleware';

// Fix Keystatic GitHub-OAuth on proxied hosts (Vercel/Netlify): the platform
// proxies requests, so context.request.url carries an internal host and
// Keystatic builds redirect_uri as https://localhost/... → GitHub 404.
// For the OAuth routes we rebuild the URL from x-forwarded-host/-proto so the
// redirect_uri matches the GitHub App's registered callback.
// Workaround for https://github.com/Thinkmill/keystatic/issues/1022
export const onRequest = defineMiddleware(async (context, next) => {
  // Preview deployments: open Keystatic on the deployment's own branch, not on `main`
  // (main = the live site, and its content may not match this branch's schema).
  const deployBranch = process.env.VERCEL_GIT_COMMIT_REF;
  if (deployBranch && deployBranch !== 'main' && context.url.pathname.replace(/\/$/, '') === '/keystatic') {
    return context.redirect(`/keystatic/branch/${encodeURIComponent(deployBranch)}`);
  }

  const isOAuthRoute =
    context.url.pathname.includes('/github/oauth/') ||
    context.url.pathname.includes('/github/login');

  if (isOAuthRoute) {
    const forwardedHost = context.request.headers.get('x-forwarded-host');
    const forwardedProto = context.request.headers.get('x-forwarded-proto');

    if (forwardedHost && forwardedProto) {
      const correctUrl = new URL(context.url);
      correctUrl.protocol = forwardedProto;
      correctUrl.host = forwardedHost;

      const newRequest = new Request(correctUrl.toString(), {
        method: context.request.method,
        headers: context.request.headers,
        body: context.request.body,
        // @ts-ignore — required when forwarding a body stream
        duplex: 'half',
      });

      Object.defineProperty(context, 'url', { value: correctUrl, writable: false });
      Object.defineProperty(context, 'request', { value: newRequest, writable: false });
    }
  }

  return next();
});
