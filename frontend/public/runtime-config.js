// Edit these values when the static frontend is deployed separately.
window.__MART_CONFIG__ = window.__MART_CONFIG__ || {
  BACKEND_URL: "http://192.168.163.1:3000",
  API_URL: "http://192.168.163.1:3000/api",
  SOCKET_URL: "http://192.168.163.1:3000"
};

(function () {
  const config = window.__MART_CONFIG__;
  const backendUrl = String(config.BACKEND_URL || "").replace(/\/+$/, "");
  const apiUrl = String(config.API_URL || (backendUrl ? backendUrl + "/api" : "/api"))
    .replace(/\/+$/, "");

  window.MART_CONFIG = {
    BACKEND_URL: backendUrl,
    API_URL: apiUrl,
    SOCKET_URL: String(config.SOCKET_URL || backendUrl || window.location.origin).replace(/\/+$/, "")
  };

  const toBackendUrl = (value) => {
    if (typeof value !== "string" || !value.startsWith("/")) return value;
    return backendUrl ? backendUrl + value : value;
  };

  const originalFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    if (typeof input === "string" && input.startsWith("/api")) {
      input = apiUrl + input.slice(4);
    }

    return originalFetch(input, init).then((response) => {
      const originalJson = response.json.bind(response);
      response.json = async function () {
        const data = await originalJson();
        const rewrite = (value) => {
          if (Array.isArray(value)) return value.map(rewrite);
          if (!value || typeof value !== "object") {
            return typeof value === "string" && value.startsWith("/image/")
              ? toBackendUrl(value)
              : value;
          }
          return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, rewrite(item)]));
        };
        return rewrite(data);
      };
      return response;
    });
  };

  const rewriteImages = () => {
    if (!backendUrl) return;
    document.querySelectorAll("img[src^='/image/']").forEach((image) => {
      image.src = toBackendUrl(image.getAttribute("src"));
    });
  };

  new MutationObserver(rewriteImages).observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["src"]
  });
  document.addEventListener("DOMContentLoaded", rewriteImages);
})();
