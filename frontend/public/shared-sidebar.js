(function () {
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

  function renderSidebar() {
    const sidebar = document.getElementById("sidebar");
    if (!sidebar) return;

    const activePage = document.body.dataset.page || "";
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
      const activeClass = item.id === activePage ? " class=\"active\"" : "";
      return `<li${activeClass} onclick="window.location.href='${item.href}'"><i class="${item.icon}"></i> <span>${item.label}</span></li>`;
    }).join("");

    sidebar.innerHTML = `
      <div class="logo">
        <i class="fas fa-store"></i>
        <span>Mart Dashboard</span>
        <button class="sidebar-close" type="button" onclick="closeSidebar()" aria-label="Close sidebar">&times;</button>
      </div>
      <div class="sidebar-branch-info" onclick="window.location.href='Branch.html'" title="Current Branch: ${currentBranch}">
        <i class="fas fa-code-branch"></i>
        <span>${currentBranch}</span>
      </div>
      <ul class="sidebar-menu">
        ${menuHtml}
        <li class="sidebar-logout" onclick="window.location.href='login.html'"><i class="fas fa-sign-out-alt"></i> <span>Logout</span></li>
      </ul>
      <div class="sidebar-footer">
        <div class="footer-title">Mart Dashboard</div>
        <div class="footer-version">Version 1.0</div>
      </div>
    `;
  }

  window.renderSidebar = renderSidebar;

  window.closeSidebar = function () {
    const sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.remove("open");
  };

  if (!document.getElementById("shared-sidebar-styles")) {
    const style = document.createElement("style");
    style.id = "shared-sidebar-styles";
    style.textContent = `
      .sidebar {
        position: fixed !important;
        top: 0 !important;
        left: 0 !important;
        width: 300px !important;
        height: 100vh !important;
        background: #ffffff !important;
        border-right: 1px solid #e2e8f0 !important;
        transition: transform 0.3s ease !important;
        z-index: 1000 !important;
        box-shadow: 2px 0 10px rgba(0, 0, 0, 0.03) !important;
        display: flex !important;
        flex-direction: column !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        font-family: Arial, sans-serif !important;
      }
      .sidebar.closed {
        transform: translateX(-100%) !important;
      }
      .sidebar .logo {
        height: 70px !important;
        min-height: 70px !important;
        background: #1b2632 !important;
        color: #ffffff !important;
        padding: 0 24px !important;
        font-size: 24px !important;
        font-weight: 700 !important;
        display: flex !important;
        align-items: center !important;
        gap: 12px !important;
        box-sizing: border-box !important;
        position: relative !important;
        flex-shrink: 0 !important;
        font-family: Arial, sans-serif !important;
      }
      .sidebar .logo i {
        font-size: 26px !important;
        color: #3b82f6 !important;
      }
      .sidebar .sidebar-branch-info {
        background: #22303e !important;
        color: #94a3b8 !important;
        padding: 8px 24px !important;
        font-size: 14px !important;
        font-family: Arial, sans-serif !important;
        display: flex !important;
        align-items: center !important;
        gap: 10px !important;
        cursor: pointer !important;
        transition: all 0.2s ease !important;
        border-bottom: 1px solid rgba(255,255,255,0.08) !important;
        flex-shrink: 0 !important;
        box-sizing: border-box !important;
      }
      .sidebar .sidebar-branch-info:hover {
        background: #2b3b4c !important;
        color: #ffffff !important;
      }
      .sidebar .sidebar-branch-info i {
        color: #38bdf8 !important;
        font-size: 15px !important;
        width: 18px !important;
        text-align: center !important;
      }
      .sidebar .sidebar-branch-info span {
        color: #e2e8f0 !important;
        font-weight: 600 !important;
        white-space: nowrap !important;
        overflow: hidden !important;
        text-overflow: ellipsis !important;
      }
      .sidebar .sidebar-menu {
        list-style: none !important;
        padding: 14px 0 90px 0 !important;
        margin: 0 !important;
        overflow-y: auto !important;
        flex: 1 1 auto !important;
        box-sizing: border-box !important;
      }
      .sidebar .sidebar-menu li {
        padding: 14px 24px !important;
        border-bottom: 1px dashed #e5e7eb !important;
        cursor: pointer !important;
        display: flex !important;
        gap: 14px !important;
        align-items: center !important;
        font-size: 19px !important;
        font-family: Arial, sans-serif !important;
        color: #334155 !important;
        transition: all 0.2s ease !important;
        box-sizing: border-box !important;
        min-height: 52px !important;
        line-height: 1.3 !important;
      }
      .sidebar .sidebar-menu li:hover {
        background: #f1f5f9 !important;
        color: #2563eb !important;
      }
      .sidebar .sidebar-menu li.active {
        background: #eff6ff !important;
        color: #2563eb !important;
        font-weight: 700 !important;
        border-left: 4px solid #2563eb !important;
      }
      .sidebar .sidebar-menu li i {
        width: 26px !important;
        min-width: 26px !important;
        text-align: center !important;
        font-size: 21px !important;
        display: inline-flex !important;
        align-items: center !important;
        justify-content: center !important;
        flex-shrink: 0 !important;
      }
      .sidebar .sidebar-footer {
        position: absolute !important;
        left: 0 !important;
        right: 0 !important;
        bottom: 0 !important;
        padding: 14px 24px !important;
        border-top: 1px solid #e5e7eb !important;
        background: #ffffff !important;
        color: #6b7280 !important;
        font-size: 13px !important;
        line-height: 1.5 !important;
        box-sizing: border-box !important;
        font-family: Arial, sans-serif !important;
      }
      .sidebar .sidebar-footer .footer-title {
        font-weight: 700 !important;
        color: #1f2937 !important;
        font-size: 15px !important;
      }
      .sidebar .sidebar-footer .footer-version {
        color: #6b7280 !important;
        font-size: 13px !important;
      }
      .sidebar-close {
        display: none;
        margin-left: auto;
        width: 34px;
        height: 34px;
        border: 0;
        border-radius: 8px;
        background: rgba(255,255,255,.14);
        color: #fff;
        font-size: 1.6rem;
        line-height: 1;
        cursor: pointer;
      }
      .sidebar-close:hover { background: rgba(255,255,255,.25); }
      @media (max-width: 768px) {
        .sidebar {
          transform: translateX(-100%) !important;
        }
        .sidebar.open {
          transform: translateX(0) !important;
        }
        .sidebar-close { display: grid; place-items: center; }
      }
    `;
    document.head.appendChild(style);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", renderSidebar);
  } else {
    renderSidebar();
  }
})();
