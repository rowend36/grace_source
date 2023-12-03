// Choose a cache name
const cacheName = "v1-0002";
// List the files to precache
const precacheResources = ['/', '/index.html', '/index.js', '/ext/all.js'];

// When the service worker is installing, open the cache and add the precache resources to it
self.addEventListener("install", (event) => {
  console.log("Service worker install event!");
    event.waitUntil(caches.open(cacheName).then((cache) => cache.addAll(precacheResources)));
});

const deleteCache = async (key) => {
  await caches.delete(key);
};

const deleteOldCaches = async () => {
  const cacheKeepList = [cacheName];
  const keyList = await caches.keys();
  const cachesToDelete = keyList.filter((key) => !cacheKeepList.includes(key));
  await Promise.all(cachesToDelete.map(deleteCache));
};

self.addEventListener("activate", (event) => {
  console.log("Service worker activate event!");
  event.waitUntil(deleteOldCaches());
});

const putInCache = async (request, response) => {
  const cache = await caches.open(cacheName);
  await cache.put(request, response);
};

const cacheFirst = async ({request, fallbackUrl}) => {
  // First try to get the resource from the cache
  const responseFromCache = await caches.match(request);
  if (responseFromCache) {
    return responseFromCache;
  }

  // Next try to get the resource from the network
  try {
    const responseFromNetwork = await fetch(request);
    // response may be used only once
    // we need to save clone to put one copy in cache
    // and serve second one
    if (
      request.method === "GET" &&
      request.url.startsWith(self.location.origin) &&
      !request.url.startsWith(self.location.origin + "/root")
    )
      putInCache(request, responseFromNetwork.clone());
    return responseFromNetwork;
  } catch (error) {
    // const fallbackResponse = await caches.match(fallbackUrl);
    // if (fallbackResponse) {
    //   return fallbackResponse;
    // }
    // when even the fallback response is not available,
    // there is nothing we can do, but we must always
    // return a Response object
    return new Response(
      "No network. Cannot "+ request.method+" "+ request.url,
      {
        status: 408,
        headers: {"Content-Type": "text/plain"},
      }
    );
  }
};

self.addEventListener("fetch", (event) => {
  event.respondWith(
    cacheFirst({
      request: event.request,
      // fallbackUrl: "/gallery/myLittleVader.jpg",
    })
  );
});

