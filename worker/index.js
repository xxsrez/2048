const ASSETS = __SITES_ASSET_MANIFEST__;
const INDEX_PATH = "/index.html";
const textDecoder = new TextDecoder();
const textEncoder = new TextEncoder();

function isHtmlNavigation(request) {
  return (
    (request.method === "GET" || request.method === "HEAD") &&
    request.headers.get("accept")?.includes("text/html")
  );
}

function decodeBase64(value) {
  const binary = atob(value);
  const bytes = new Uint8Array(binary.length);

  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }

  return bytes;
}

function findAsset(request) {
  const pathname = new URL(request.url).pathname;
  const directPath = pathname === "/" ? INDEX_PATH : pathname;
  const directAsset = ASSETS[directPath];

  if (directAsset) {
    return { asset: directAsset, pathname: directPath };
  }

  if (isHtmlNavigation(request) && ASSETS[INDEX_PATH]) {
    return { asset: ASSETS[INDEX_PATH], pathname: INDEX_PATH };
  }

  return null;
}

function createAssetResponse(request, match) {
  let body = decodeBase64(match.asset.body);
  const isHtml = match.asset.contentType.startsWith("text/html");

  if (isHtml) {
    const origin = new URL(request.url).origin;
    body = textEncoder.encode(
      textDecoder.decode(body).replaceAll("__SITE_ORIGIN__", origin),
    );
  }

  const headers = new Headers({
    "content-type": match.asset.contentType,
    "x-content-type-options": "nosniff",
  });

  headers.set(
    "cache-control",
    match.pathname.startsWith("/assets/")
      ? "public, max-age=31536000, immutable"
      : isHtml
        ? "no-cache"
        : "public, max-age=86400",
  );

  return new Response(request.method === "HEAD" ? null : body, { headers });
}

export default {
  async fetch(request) {
    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method not allowed", {
        status: 405,
        headers: { allow: "GET, HEAD" },
      });
    }

    const match = findAsset(request);

    return match
      ? createAssetResponse(request, match)
      : new Response("Not found", { status: 404 });
  },
};
