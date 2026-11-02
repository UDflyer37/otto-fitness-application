/*
 * Otto Fitness offline worker.
 *
 * The app keeps all of its data in localStorage, so the only thing standing
 * between it and a gym with no signal is the shell itself. Strategy:
 *
 *   navigation      network first, cached document when the network fails
 *   /moves/         cache first, filled on first view or by "save demos"
 *   /_next/static/  cache first (content hashed, safe to keep forever)
 *   /api/           never touched, those requests must stay live
 *   everything else stale while revalidate
 *
 * A new deploy bumps VERSION, which drops the old caches on activate.
 */
const VERSION = "otto-v1";
const SHELL = `${VERSION}-shell`;
const STATIC = `${VERSION}-static`;
const MOVES = `${VERSION}-moves`;

const SHELL_URLS = [
  "/",
  "/manifest.webmanifest",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/icons/apple-touch-icon.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(
    (async () => {
      const cache = await caches.open(SHELL);
      // One missing file should not fail the whole install.
      await Promise.all(
        SHELL_URLS.map((url) =>
          cache.add(new Request(url, { cache: "reload" })).catch(() => undefined),
        ),
      );
      await self.skipWaiting();
    })(),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    (async () => {
      const keys = await caches.keys();
      await Promise.all(
        keys
          .filter((key) => key.startsWith("otto-") && !key.startsWith(VERSION))
          .map((key) => caches.delete(key)),
      );
      await self.clients.claim();
    })(),
  );
});

function canStore(response) {
  return response && (response.ok || response.type === "opaque");
}

async function cacheFirst(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  if (hit) return hit;
  const response = await fetch(request);
  if (canStore(response)) await cache.put(request, response.clone());
  return response;
}

async function staleWhileRevalidate(request, cacheName) {
  const cache = await caches.open(cacheName);
  const hit = await cache.match(request);
  const refresh = fetch(request)
    .then(async (response) => {
      if (canStore(response)) await cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return hit ?? (await refresh) ?? Response.error();
}

async function navigate(request) {
  const cache = await caches.open(SHELL);
  try {
    const response = await fetch(request);
    if (response && response.ok) await cache.put("/", response.clone());
    return response;
  } catch {
    const hit = (await cache.match(request)) ?? (await cache.match("/"));
    if (hit) return hit;
    return new Response(
      "<!doctype html><meta name=\"viewport\" content=\"width=device-width\"><body style=\"margin:0;background:#0b0b0c;color:#efe7d7;font-family:system-ui;padding:32px\"><h1 style=\"font-size:20px\">Otto Fitness is not saved yet</h1><p style=\"color:#a8a29a;line-height:1.6\">Open the app once with a connection, then it will work here.</p></body>",
      { status: 200, headers: { "Content-Type": "text/html; charset=utf-8" } },
    );
  }
}

self.addEventListener("fetch", (event) => {
  const { request } = event;
  if (request.method !== "GET") return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  // The AI describer and anything else on the server must stay live.
  if (url.pathname.startsWith("/api/")) return;

  if (request.mode === "navigate") {
    event.respondWith(navigate(request));
    return;
  }

  if (url.pathname.startsWith("/moves/")) {
    event.respondWith(cacheFirst(request, MOVES));
    return;
  }

  if (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname === "/manifest.webmanifest"
  ) {
    event.respondWith(cacheFirst(request, STATIC));
    return;
  }

  event.respondWith(staleWhileRevalidate(request, STATIC));
});

/**
 * "Save the movement demos" posts the full frame list here. Downloads run a
 * few at a time so a phone on a weak connection is not swamped, and progress
 * goes back over a MessagePort.
 */
self.addEventListener("message", (event) => {
  const data = event.data || {};
  if (data.type !== "precache-moves") return;

  const port = event.ports && event.ports[0];
  const urls = Array.isArray(data.urls) ? data.urls.filter((url) => typeof url === "string") : [];

  event.waitUntil(
    (async () => {
      if (!urls.length) {
        port?.postMessage({ done: 0, total: 0, complete: true });
        return;
      }

      const cache = await caches.open(MOVES);
      const queue = [...urls];
      const total = urls.length;
      let done = 0;

      const report = (complete) => port?.postMessage({ done, total, complete });

      const worker = async () => {
        while (queue.length) {
          const url = queue.shift();
          try {
            if (!(await cache.match(url))) {
              const response = await fetch(url, { cache: "reload" });
              if (canStore(response)) await cache.put(url, response);
            }
          } catch {
            // A single failed frame is skipped; the app falls back for it.
          }
          done += 1;
          if (done % 8 === 0) report(false);
          // Small pause keeps the main thread and the radio from saturating.
          await new Promise((resolve) => setTimeout(resolve, 15));
        }
      };

      await Promise.all(Array.from({ length: 5 }, worker));
      report(true);
    })(),
  );
});
