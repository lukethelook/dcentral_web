import { defineMiddleware } from 'astro:middleware';

// Fix Keystatic GitHub-OAuth on proxied hosts (Vercel/Netlify): the platform
// proxies requests, so context.request.url carries an internal host and
// Keystatic builds redirect_uri as https://localhost/... → GitHub 404.
// For the OAuth routes we rebuild the URL from x-forwarded-host/-proto so the
// redirect_uri matches the GitHub App's registered callback.
// Workaround for https://github.com/Thinkmill/keystatic/issues/1022
export const onRequest = defineMiddleware(async (context, next) => {
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
