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

    const isAdmin = String(currentUser?.role || "User").toLowerCase() === "admin";
    const visibleItems = items.filter((item) => {
      if (!isAdmin && (item.id === "staff" || item.id === "account")) {
        return false;
      }
      return true;
    });

    const menuHtml = visibleItems.map((item) => {
      const activeClass = item.id === activePage ? " class=\"active\"" : "";
      return `<li${activeClass} onclick="window.location.href='${item.href}'"><i class="${item.icon}"></i> ${item.label}</li>`;
    }).join("");

    sidebar.innerHTML = `
      <div class="logo">
        <i class="fas fa-store"></i>
        <span>Mart Dashboard</span>
        <button class="sidebar-close" type="button" onclick="closeSidebar()" aria-label="Close sidebar">&times;</button>
      </div>
      <ul style="padding:20px 0 92px;">
        ${menuHtml}
        <li onclick="window.location.href='login.html'"><i class="fas fa-sign-out-alt"></i> Logout</li>
      </ul>
      <div style="position:absolute;left:0;right:0;bottom:0;padding:14px 18px;border-top:1px solid #e5e7eb;background:#fff;color:#6b7280;font-size:12px;line-height:1.5;">
        <div style="font-weight:700;color:#1f2937;">Mart Dashboard</div>
        <div>Version 1.0</div>
      </div>
    `;
  }

  window.closeSidebar = function () {
    const sidebar = document.getElementById("sidebar");
    if (sidebar) sidebar.classList.remove("open");
  };

  if (!document.getElementById("shared-sidebar-styles")) {
    const style = document.createElement("style");
    style.id = "shared-sidebar-styles";
    style.textContent = `
      .sidebar .logo { position: relative; }
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
