const API_BASE = (typeof window.CONFIG !== "undefined" && window.CONFIG.API_BASE_URL) ? window.CONFIG.API_BASE_URL : "http://localhost:3000";
class AppHeader extends HTMLElement {
  connectedCallback() {
    const active = this.getAttribute("active");
    const heading = this.getAttribute("heading") || "TaskGo";

    this.token = localStorage.getItem("token");

    // ====== resolve /frontend/ base for any nested page ======
    const pathname = window.location.pathname.replace(/\\/g, "/");
    const idx = pathname.indexOf("/frontend/");
    const FE_BASE =
      idx >= 0 ? pathname.slice(0, idx + "/frontend/".length) : "/";

    const link = (pathAfterFrontend) => `${FE_BASE}${pathAfterFrontend}`; // e.g. "public/...", "templates/..."

    const getLinkClass = (pageName) => {
      const baseClass = "block py-2 text-base transition font-bold";
      if (active === pageName) return `${baseClass} text-green-700`;
      return `${baseClass} text-gray-600 hover:text-green-700`;
    };

    this.innerHTML = `
      <nav class="sticky top-0 z-[100] bg-white shadow-sm font-montserrat">
        <header class="bg-primary-200 flex items-center justify-between px-4 py-3 shadow-md relative z-[50]">
          <div class="flex items-center gap-3">
            <a href="${link("index.html")}" class="logo-icon flex-shrink-0 w-9 h-9 bg-white rounded-full p-1 flex items-center justify-center shadow-sm opacity-70 hover:opacity-100 transition">
              <img
                src="${link("public/images/taskgo-logo.png")}"
                onerror="this.src='https://placehold.co/40x40?text=T'"
                alt="TaskGo"
                class="object-contain"
              >
            </a>

            <h1 class="text-[#111827] font-bold text-lg uppercase tracking-wide">${heading}</h1>
          </div>

          <div class="flex items-center gap-2">
            <button id="notification-btn" class="w-9 h-9 flex items-center justify-center bg-white/40 rounded-full hover:bg-white/60 transition relative">
              <span class="material-symbols-outlined text-[#111827]">notifications</span>
              ${active === "notification" ? '<span class="absolute top-2 right-2.5 w-2 h-2"></span>' : ""}
            </button>

            <button id="menu-btn" class="p-2 focus:outline-none flex items-center bg-white/40 rounded-lg hover:bg-white/60 transition text-[#111827]">
              <span id="menu-icon" class="material-symbols-outlined">menu</span>
            </button>
          </div>
        </header>

        <div id="menu-overlay"
          class="menu-hamburger absolute top-full left-0 w-full bg-white shadow-xl transition-all duration-300 -translate-y-[150%] z-40 border-t border-gray-100 opacity-0 pointer-events-none">
          <nav class="flex flex-col p-6 space-y-6 text-[#111827] font-bold max-w-7xl mx-auto">
            <div class="flex items-center gap-3 pb-4 border-b border-gray-100">
              <div class="w-12 h-12 rounded-full overflow-hidden border border-green-300 bg-green-50">
                <img id="header-avatar" src="https://api.dicebear.com/9.x/bottts/svg?seed=Guest" class="w-full h-full object-cover" />
              </div>
              <div>
                <p id="header-username" class="text-lg">Đang tải...</p>
                <p id="header-userid" class="text-xs font-medium text-gray-500">...</p>
              </div>
            </div>

            <a href="${link("templates/customer/customer_home.html")}" class="${getLinkClass("home")}">Trang chủ</a>
            <a href="${link("templates/customer/customer_activity.html")}" class="${getLinkClass("activity")}">Hoạt động</a>
            <a href="${link("templates/chat.html")}" class="${getLinkClass("chat")}">Tin nhắn</a>
            <a href="${link("templates/customer/profile.html")}" class="${getLinkClass("profile")}">Tài khoản</a>

            <a href="#" id="logout-btn" class="pb-4 text-red-600 flex items-center gap-3 hover:bg-red-50 rounded-lg px-2 -ml-2 transition">
              <span class="material-symbols-outlined">logout</span> Đăng xuất
            </a>
          </nav>
        </div>
      </nav>
    `;

    this._FE_BASE = FE_BASE;
    this.setupMenuLogic();
    this.loadUserInfo();
  }

  async loadUserInfo() {
    if (!this.token) return;
    try {
      const res = await fetch(`${API_BASE}/api/user/profile`, {
        headers: { Authorization: `Bearer ${this.token}` },
      });
      const data = await res.json();
      if (data.success && data.user) {
        const avatarEl = this.querySelector("#header-avatar");
        const nameEl = this.querySelector("#header-username");
        const idEl = this.querySelector("#header-userid");
        if (avatarEl)
          avatarEl.src =
            data.user.avatar_url ||
            "https://api.dicebear.com/9.x/bottts/svg?seed=Default";
        if (nameEl) nameEl.innerText = data.user.full_name;
        if (idEl)
          idEl.innerText = `ID: #${data.user._id.slice(-6).toUpperCase()}`;
      }
    } catch (err) {
      console.error(err);
    }
  }

  setupMenuLogic() {
    const menuBtn = this.querySelector("#menu-btn");
    const menuOverlay = this.querySelector("#menu-overlay");
    if (!menuBtn || !menuOverlay) return;

    const setMenuOpen = (open) => {
      menuOverlay.dataset.open = open ? "1" : "0";

      // keep original classes
      if (open) {
        menuOverlay.classList.remove(
          "-translate-y-[150%]",
          "opacity-0",
          "pointer-events-none",
        );
        menuOverlay.classList.add(
          "translate-y-0",
          "opacity-100",
          "pointer-events-auto",
        );
      } else {
        menuOverlay.classList.remove(
          "translate-y-0",
          "opacity-100",
          "pointer-events-auto",
        );
        menuOverlay.classList.add(
          "-translate-y-[150%]",
          "opacity-0",
          "pointer-events-none",
        );
      }

      // fallback (no UI change, just ensure it works)
      menuOverlay.style.transform = open
        ? "translateY(0)"
        : "translateY(-150%)";
      menuOverlay.style.opacity = open ? "1" : "0";
      menuOverlay.style.pointerEvents = open ? "auto" : "none";
    };

    setMenuOpen(false);

    menuBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = menuOverlay.dataset.open === "1";
      setMenuOpen(!isOpen);
    });

    document.addEventListener(
      "click",
      (e) => {
        if (menuOverlay.dataset.open !== "1") return;
        const t = e.target;
        if (menuOverlay.contains(t) || menuBtn.contains(t)) return;
        setMenuOpen(false);
      },
      true,
    );

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") setMenuOpen(false);
    });

    const logoutBtn = this.querySelector("#logout-btn");
    if (logoutBtn) {
      logoutBtn.addEventListener("click", async (e) => {
        e.preventDefault();
        try {
          await fetch(`${API_BASE}/api/auth/logout`, {
            method: "POST",
            headers: { Authorization: `Bearer ${this.token}` },
          });
        } catch (err) {}
        localStorage.removeItem("token");
        window.location.href = `${this._FE_BASE}templates/auth/login-signup.html`;
      });
    }

    const notiBtn = this.querySelector("#notification-btn");
    if (notiBtn) {
      notiBtn.addEventListener("click", () => {
        window.location.href = `${this._FE_BASE}templates/notification.html`;
      });
    }
  }
}

customElements.define("app-header", AppHeader);
