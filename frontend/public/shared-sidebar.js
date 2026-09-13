(function () {
  // Global Authentication Guard: Enforce login across all pages using shared-sidebar
  let currentUserData = null;
  try {
    const rawUser = localStorage.getItem("martUser");
    currentUserData = rawUser ? JSON.parse(rawUser) : null;
    if (!currentUserData) {
      localStorage.removeItem("martUser");
      localStorage.removeItem("martLastActivity");
      window.location.replace("login.html");
      return;
    }
  } catch (e) {
    localStorage.removeItem("martUser");
    localStorage.removeItem("martLastActivity");
    window.location.replace("login.html");
    return;
  }

  // Check 2-minute inactivity
  const lastActivity = parseInt(localStorage.getItem("martLastActivity") || "0", 10);
  if (lastActivity && (Date.now() - lastActivity >= 2 * 60 * 1000)) {
    localStorage.removeItem("martUser");
    localStorage.removeItem("martLastActivity");
    window.location.replace("login.html");
    return;
  }

  // Verify cryptographic token to prevent Inspect/Console tampering
  if (currentUserData.token) {
    fetch("/api/verify-token", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: currentUserData.token })
    }).then(res => res.json()).then(data => {
      if (data && data.valid === false) {
        localStorage.removeItem("martUser");
        localStorage.removeItem("martLastActivity");
        window.location.replace("login.html");
      }
    }).catch(() => {});
  }

  const items = [
    { id: "dashboard", label: "Dashboard", href: "Dashboard-page.html", icon: "fas fa-tachometer-alt" },
    { id: "pos", label: "POS", href: "POS.html", icon: "fas fa-cash-register" },
    { id: "low-stock", label: "Low Stock", href: "LowStock.html", icon: "fas fa-box" },
    { id: "receipt-history", label: "Receipt History", href: "ReceiptHistory.html", icon: "fas fa-file-invoice" },
    { id: "products", label: "Products", href: "Product.html", icon: "fas fa-boxes" },
    { id: "category", label: "Category", href: "ProductCategory.html", icon: "fas fa-tags" },
    { id: "promotions", label: "Promotions", href: "Promotions.html", icon: "fas fa-tags" },
    { id: "staff", label: "Staff", href: "Staff.html", icon: "fas fa-user-cog" },
    { id: "branch", label: "Branch", href: "Branch.html", icon: "fas fa-code-branch" },
    { id: "account", label: "Accounts", href: "Account.html", icon: "fas fa-user-shield" }
  ];

  // 1. Ensure shared stylesheet is linked
  function ensureStylesheet() {
    if (!document.getElementById("shared-sidebar-stylesheet")) {
      const link = document.createElement("link");
      link.id = "shared-sidebar-stylesheet";
      link.rel = "stylesheet";
      link.href = "css/shared-sidebar.css";
      document.head.appendChild(link);
    }
  }
  ensureStylesheet();

  // 2. Ensure iOS-Style Page Loading Overlay exists
  function ensureLoadingOverlay() {
    let overlay = document.getElementById("page-loading-overlay");
    if (!overlay) {
      overlay = document.createElement("div");
      overlay.id = "page-loading-overlay";
      overlay.setAttribute("aria-hidden", "true");
      overlay.innerHTML = `
        <div class="page-loading-card">
          <div class="ios-spinner" role="status" aria-label="Loading">
            <div class="ios-blade"></div>
            <div class="ios-blade"></div>
            <div class="ios-blade"></div>
            <div class="ios-blade"></div>
            <div class="ios-blade"></div>
            <div class="ios-blade"></div>
            <div class="ios-blade"></div>
            <div class="ios-blade"></div>
            <div class="ios-blade"></div>
            <div class="ios-blade"></div>
            <div class="ios-blade"></div>
            <div class="ios-blade"></div>
          </div>
          <div class="page-loading-label" id="page-loading-label">Loading...</div>
        </div>
      `;
      (document.body || document.documentElement).appendChild(overlay);
    }
    return overlay;
  }

  // Show page loader perfectly centered on screen
  function showPageLoader(text = "Loading...") {
    const overlay = ensureLoadingOverlay();
    const label = document.getElementById("page-loading-label");
    if (label) label.textContent = text;
    overlay.classList.add("active");
  }

  // Hide page loader with smooth fade-out
  function hidePageLoader() {
    const overlay = document.getElementById("page-loading-overlay");
    if (overlay) {
      overlay.classList.remove("active");
    }
  }

  // Smooth page navigation: avoids abrupt jerking/flickering
  function navigateToPage(href, label = "Loading...") {
    if (!href || href === "#") return;

    // Check if current page is the destination
    const currentPath = window.location.pathname.split("/").pop() || "index.html";
    if (currentPath.toLowerCase() === href.toLowerCase()) {
      // Don't reload current page!
      if (window.innerWidth <= 768) {
        window.closeSidebar();
      }
      return;
    }

    showPageLoader(label);

    try {
      sessionStorage.setItem("mart_page_navigating", "1");
    } catch (_) {}

    // Give browser brief time to paint the iOS spinner before navigation
    setTimeout(() => {
      window.location.href = href;
    }, 120);
  }

  // Check if page was opened via navigation transition
  function handlePageEntry() {
    let wasNavigating = false;
    try {
      wasNavigating = sessionStorage.getItem("mart_page_navigating") === "1";
      sessionStorage.removeItem("mart_page_navigating");
    } catch (_) {
      wasNavigating = false;
    }

    if (wasNavigating) {
      // Keep loader visible smoothly while page initializes
      showPageLoader();
      setTimeout(() => {
        hidePageLoader();
      }, 220);
    }
  }

  // Handle menu item clicks
  window.handleSidebarClick = function (event, href, itemId) {
    if (event) event.preventDefault();
    const activePage = (document.body.dataset.page || "").toLowerCase();

    if (itemId && itemId.toLowerCase() === activePage) {
      // Prevent reload on the active page - prevents flickering!
      const el = event?.currentTarget;
      if (el) {
        el.classList.add("pulse");
        setTimeout(() => el.classList.remove("pulse"), 400);
      }
      if (window.innerWidth <= 768) {
        window.closeSidebar();
      }
      return;
    }

    const el = event?.currentTarget;
    if (el) el.classList.add("navigating");
    navigateToPage(href);
  };

  function renderSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    const activePage = (document.body.dataset.page || "").toLowerCase();
    let currentUser = null;
    try {
      currentUser = JSON.parse(localStorage.getItem("martUser") || "null");
    } catch {
      currentUser = null;
    }

    let currentBranch = "Main Branch";
    try {
      currentBranch = localStorage.getItem("martCurrentBranch") || "Main Branch";
    } catch {
      currentBranch = "Main Branch";
    }

    const isAdmin = String(currentUser?.role || "User").toLowerCase() === "admin";
    const visibleItems = items.filter((item) => {
      if (!isAdmin && (item.id === "staff" || item.id === "account")) {
        return false;
      }
      return true;
    });

    const menuHtml = visibleItems.map((item) => {
      const isActive = item.id.toLowerCase() === activePage;
      const activeClass = isActive ? ' class="active"' : "";
      return `<li${activeClass} data-id="${item.id}" onclick="handleSidebarClick(event, '${item.href}', '${item.id}')"><i class="${item.icon}"></i> <span>${item.label}</span></li>`;
    }).join("");

    sidebar.innerHTML = `
      <div class="logo">
        <i class="fas fa-store"></i>
        <span>Mart Dashboard</span>
        <button class="sidebar-close" type="button" onclick="closeSidebar()" aria-label="Close sidebar">&times;</button>
      </div>
      <div class="sidebar-branch-info" onclick="handleSidebarClick(event, 'Branch.html', 'branch')" title="Current Branch: ${currentBranch}">
        <i class="fas fa-code-branch"></i>
        <span>${currentBranch}</span>
      </div>
      <ul class="sidebar-menu">
        ${menuHtml}
        <li class="sidebar-logout" onclick="handleSidebarLogout(event)"><i class="fas fa-sign-out-alt"></i> <span>Logout</span></li>
      </ul>
      <div class="sidebar-footer">
        <div class="sidebar-footer-card">
          <div class="footer-brand-row">
            <div class="footer-logo-badge">
              <i class="fas fa-store"></i>
            </div>
            <div class="footer-text-group">
              <div class="footer-title">Mart POS</div>
              <div class="footer-version-row">
                <span class="status-indicator"></span>
                <span class="footer-version">v1.0.0 • Online</span>
              </div>
            </div>
            <span class="footer-pro-badge">PRO</span>
          </div>
        </div>
      </div>
    `;
  }

  window.handleSidebarLogout = function (event) {
    if (event) event.preventDefault();
    try {
      localStorage.removeItem("martUser");
      localStorage.removeItem("martLastActivity");
    } catch (_) {}
    navigateToPage("login.html", "Logging out...");
  };

  window.closeSidebar = function () {
    const sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.remove("open");
  };

  window.toggleSidebar = function () {
    const sidebar = document.getElementById("sidebar");
    const navbar = document.getElementById("navbar");
    const main = document.getElementById("main");
    const overlay = document.getElementById("page-loading-overlay");

    if (window.innerWidth <= 768) {
      if (sidebar) sidebar.classList.toggle("open");
      return;
    }

    if (sidebar) sidebar.classList.toggle("closed");
    if (navbar) navbar.classList.toggle("full");
    if (main) main.classList.toggle("full");
  };

  // Expose global navigation helpers
  window.renderSidebar = renderSidebar;
  window.navigateToPage = navigateToPage;
  window.showPageLoader = showPageLoader;
  window.hidePageLoader = hidePageLoader;
  window.go = function (page) {
    navigateToPage(page);
  };

  function init() {
    ensureStylesheet();
    ensureLoadingOverlay();
    renderSidebar();
    handlePageEntry();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
