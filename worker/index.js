const INDEX_PATH = "/index.html";

function isHtmlNavigation(request) {
  return (
    request.method === "GET" &&
    request.headers.get("accept")?.includes("text/html")
  );
}

async function injectRequestOrigin(response, request) {
  if (!response.headers.get("content-type")?.includes("text/html")) {
    return response;
  }

  const headers = new Headers(response.headers);
  headers.delete("content-encoding");
  headers.delete("content-length");
  headers.delete("etag");

  const origin = new URL(request.url).origin;
  const html = (await response.text()).replaceAll("__SITE_ORIGIN__", origin);

  return new Response(html, {
    status: response.status,
    statusText: response.statusText,
    headers,
  });
}

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);

    if (response.status !== 404 || !isHtmlNavigation(request)) {
      return injectRequestOrigin(response, request);
    }

    const indexUrl = new URL(request.url);
    indexUrl.pathname = INDEX_PATH;

    const indexResponse = await env.ASSETS.fetch(new Request(indexUrl, request));
    return injectRequestOrigin(indexResponse, request);
  },
};
