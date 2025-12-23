export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    
    // First, try to serve the requested static asset
    let response = await env.ASSETS.fetch(request);

    // If the asset is not found (404), and it's not a request for a specific file extension (like .css, .js, .png)
    // assume it's a navigation route and serve index.html (SPA Fallback)
    if (response.status === 404 && !url.pathname.includes('.')) {
      response = await env.ASSETS.fetch(new URL("/index.html", request.url));
    }

    return response;
  },
};
