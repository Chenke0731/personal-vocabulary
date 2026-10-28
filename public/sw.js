const CACHE = "cijian-shell-development";
const PRECACHE = ["/", "/index.html", "/manifest.webmanifest", "/icon.svg"];
self.addEventListener("install", (event) =>
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) =>
        cache.addAll(PRECACHE),
      ),
  ),
);
self.addEventListener("activate", (event) =>
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((k) => k.startsWith("cijian-shell-") && k !== CACHE)
            .map((k) => caches.delete(k)),
        ),
      )
      .then(() => self.clients.claim()),
  ),
);
self.addEventListener("fetch", (event) => {
  const u = new URL(event.request.url);
  if (event.request.method !== "GET" || u.origin !== self.location.origin)
    return;
  if (event.request.mode === "navigate") {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE).then((c) => c.put("/index.html", copy));
          }
          return response;
        })
        .catch(() => caches.match("/index.html")),
    );
    return;
  }
  if (
    u.pathname.startsWith("/assets/") ||
    ["/manifest.webmanifest", "/icon.svg", "/wordpacks/core-academic-01.json", "/wordpacks/core-academic-02.json"].includes(u.pathname)
  ) {
    event.respondWith(
      caches.match(event.request, { ignoreVary: true }).then(
        (cached) =>
          cached ||
          fetch(event.request).then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(CACHE).then((c) => c.put(event.request, copy));
            }
            return response;
          }),
      ),
    );
  }
});
