// Automatically detect the current host (works on localhost, LAN IP, or any computer)
const defaultHost = (typeof window !== "undefined" && window.location.hostname) || "localhost";

window.__MART_CONFIG__ = window.__MART_CONFIG__ || {
  BACKEND_URL: `http://${defaultHost}:3000`,
  API_URL: `http://${defaultHost}:3000/api`,
  SOCKET_URL: `http://${defaultHost}:3000`
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

  // ======================================================
  // ANTI-INSPECT & DEVTOOLS PROTECTION
  // ======================================================
  // 1. Disable Right-Click (Context Menu)
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
    return false;
  }, { capture: true });

  // 2. Disable DevTools & View Source Shortcuts
  document.addEventListener("keydown", (e) => {
    // Block F12
    if (e.key === "F12" || e.keyCode === 123) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    // Block Ctrl+Shift+I / J / C (DevTools & Console)
    if ((e.ctrlKey || e.metaKey) && e.shiftKey && ["I", "i", "J", "j", "C", "c"].includes(e.key)) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    // Block Ctrl+U (View Page Source)
    if ((e.ctrlKey || e.metaKey) && (e.key === "u" || e.key === "U")) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
    // Block Ctrl+S (Save Page)
    if ((e.ctrlKey || e.metaKey) && (e.key === "s" || e.key === "S")) {
      e.preventDefault();
      e.stopPropagation();
      return false;
    }
  }, { capture: true });

  // 3. DevTools Detection & Debugger Deterrent
  setInterval(() => {
    const widthDiff = window.outerWidth - window.innerWidth;
    const heightDiff = window.outerHeight - window.innerHeight;
    if (widthDiff > 160 || heightDiff > 160) {
      try {
        Function("debugger")();
      } catch (_) {}
    }
  }, 1000);

  // ======================================================
  // 4. 2-MINUTE INACTIVITY AUTO-LOCK TO LOGIN
  // ======================================================
  (function () {
    const INACTIVITY_TIMEOUT_MS = 2 * 60 * 1000; // 2 minutes in milliseconds
    const path = (window.location.pathname || "").toLowerCase();
    const isLoginPage = path.endsWith("login.html") || path.endsWith("/login");
    const isIndexPage = path === "/" || path.endsWith("index.html") || path === "";

    // Do not run inactivity lock on login or root redirector
    if (isLoginPage || isIndexPage) {
      return;
    }

    function lockSession() {
      try {
        localStorage.removeItem("martUser");
        localStorage.removeItem("martLastActivity");
      } catch (_) {}
      window.location.replace("login.html?reason=inactivity");
    }

    try {
      const user = localStorage.getItem("martUser");
      if (!user) return;
    } catch (_) {
      return;
    }

    const now = Date.now();
    const lastActivityStr = localStorage.getItem("martLastActivity");
    const lastActivity = lastActivityStr ? parseInt(lastActivityStr, 10) : 0;

    // If user opened or refreshed page after 5 minutes of idle time
    if (lastActivity && (now - lastActivity >= INACTIVITY_TIMEOUT_MS)) {
      lockSession();
      return;
    }

    // Refresh last activity for this active session
    try {
      localStorage.setItem("martLastActivity", String(now));
    } catch (_) {}

    let lastRecordedActivity = now;
    function recordActivity() {
      const currentTime = Date.now();
      lastRecordedActivity = currentTime;
      // Throttle updating localStorage to once every 3 seconds
      const stored = parseInt(localStorage.getItem("martLastActivity") || "0", 10);
      if (currentTime - stored >= 3000) {
        try {
          localStorage.setItem("martLastActivity", String(currentTime));
        } catch (_) {}
      }
    }

    // Track user activity across interactions
    ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "wheel"].forEach((eventName) => {
      window.addEventListener(eventName, registerActivity, { passive: true, capture: true });
    });

    // Check every 3 seconds if 5 minutes have elapsed without interaction
    setInterval(() => {
      try {
        const currentUser = localStorage.getItem("martUser");
        if (!currentUser) return;

        const stored = parseInt(localStorage.getItem("martLastActivity") || "0", 10) || lastRecordedActivity;
        if (Date.now() - stored >= INACTIVITY_TIMEOUT_MS) {
          lockSession();
        }
      } catch (_) {}
    }, 3000);
  })();
})();
