// frontend/templates/js/ui/shared-layout.js
export function initLayout(options = {}) {
  const role = options.role || "customer";
  const title = options.title || "TaskGo";
  const active = options.active || "";

  const headerMount = document.getElementById("app-header");
  const footerMount = document.getElementById("app-footer");

  // ====== Resolve base paths (works for nested pages like payment_pages/...) ======
  const pathname = window.location.pathname.replace(/\\/g, "/");
  const idx = pathname.indexOf("/frontend/templates/");
  const afterTemplates =
    idx >= 0 ? pathname.slice(idx + "/frontend/templates/".length) : pathname;

  const seg = afterTemplates.split("/").filter(Boolean);

  // from current file -> /frontend/public
  const publicBase = "../".repeat(Math.max(seg.length, 2)) + "public";

  const buildCustomerLinks = () => {
    const roleIndex = seg.indexOf("customer");
    const rest = roleIndex >= 0 ? seg.slice(roleIndex + 1) : seg;

    // from current file to /frontend/templates/customer/
    const upToRoleRoot = "../".repeat(Math.max(rest.length - 1, 0));

    return {
      upToRoleRoot,
      home: `${upToRoleRoot}customer_home.html`,
      activity: `${upToRoleRoot}customer_activity.html`,
      chat: `${upToRoleRoot}../chat.html`,
      notifications: `${upToRoleRoot}../notification.html`,
      profile: `${upToRoleRoot}profile.html`,
      login: `${upToRoleRoot}../auth/login-signup.html`,
    };
  };

  const links =
    role === "customer" ? buildCustomerLinks() : buildCustomerLinks();

  const navItems = [
    { key: "home", label: "Trang chủ", icon: "house", href: links.home },
    { key: "activity", label: "Hoạt động", icon: "news", href: links.activity },
    { key: "chat", label: "Tin nhắn", icon: "chat", href: links.chat },
    {
      key: "notifications",
      label: "Thông báo",
      icon: "lightbulb",
      href: links.notifications,
    },
  ];

  const desktopActiveClass = (key) =>
    key === active
      ? "text-dark-900 font-bold border-b-2 border-primary-500"
      : "text-primary-500 hover:text-dark-900 font-medium transition-colors";

  const headerHTML = `
  <header class="bg-primary-200 sticky top-0 z-50 shadow-md h-[72px]">
    <div class="px-6 h-full w-full grid grid-cols-[auto,1fr,auto] items-center">

      <!-- Left: Logo -->
      <div class="flex items-center">
        <a href="${links.home}"
   class="text-primary-500 w-10 h-10 rounded-full bg-white flex items-center justify-center opacity-70"
   style="transform: translateY(14px);">
  <img src="${publicBase}/images/taskgo-logo.png" alt="Logo" />
</a>
      </div>

      <!-- Center: Menu (desktop) / Title (mobile) -->
      <div class="flex items-center justify-center h-full">
        <h1 class="lg:hidden font-bold text-xl text-dark-900">${title}</h1>

        <nav class="hidden lg:flex items-center justify-center space-x-6 lg:space-x-10 whitespace-nowrap">
          ${navItems
            .map(
              (it) =>
                `<a href="${it.href}" class="${desktopActiveClass(it.key)} h-full flex items-center">
                  ${it.label}
                </a>`,
            )
            .join("")}
        </nav>
      </div>

      <!-- Right: Logout (desktop) / Hamburger (mobile) -->
      <div class="flex items-center justify-end h-full gap-2">
        <button
          id="menu-btn"
          type="button"
          class="lg:hidden w-10 h-10 flex items-center justify-center cursor-pointer"
          aria-label="Menu"
          title="Menu"
        >
          <span class="material-symbols-outlined text-primary-500 text-4xl">menu</span>
        </button>

        <button
        id="logout-btn-desktop"
        type="button"
        class="hidden lg:flex h-10 items-center gap-2 px-3 py-0 rounded-xl bg-white/60 hover:bg-white transition border border-primary-300 text-primary-600 font-bold whitespace-nowrap"
        style="transform: translateY(-50px);"
        title="Đăng xuất"
>

          <span class="material-symbols-outlined text-[20px]">logout</span>
          <span class="text-sm">Đăng xuất</span>
        </button>
      </div>

    </div>
  </header>

  <!-- Mobile dropdown menu -->
  <div id="mobile-menu" class="hidden fixed top-[72px] left-0 w-full bg-primary-200 shadow-xl z-40 border-b border-primary-300 lg:hidden">
    <nav class="flex flex-col p-4 space-y-4">
      ${navItems
        .map(
          (it) => `
        <a href="${it.href}" class="flex items-center space-x-3 text-primary-500 font-medium">
          <span class="material-symbols-outlined">${it.icon}</span>
          <span>${it.label}</span>
        </a>
      `,
        )
        .join("")}

      <div class="h-px bg-primary-300/80 my-1"></div>

      <button
        id="logout-btn-mobile"
        type="button"
        class="flex items-center space-x-3 text-red-600 font-bold text-left"
      >
        <span class="material-symbols-outlined">logout</span>
        <span>Đăng xuất</span>
      </button>
    </nav>
  </div>
`;

  // ====== FOOTER (match template) ======
  const footerHTML = `
    <footer class="bg-primary-200 border-t border-primary-300 py-8 mt-auto">
      <div class="max-w-5xl mx-auto px-6">
        <div class="grid grid-cols-1 md:grid-cols-3 gap-8 items-stretch">

          <div class="flex flex-col justify-center space-y-3">
            <div class="space-y-1">
              <h4 class="text-[10px] font-bold text-dark-900/40 uppercase tracking-tighter">Frontend</h4>
              <div class="flex gap-1.5">
                <span class="px-2 py-0.5 bg-white/50 text-[10px] font-bold rounded border border-primary-300 text-primary-600">#ReactJS</span>
                <span class="px-2 py-0.5 bg-white/50 text-[10px] font-bold rounded border border-primary-300 text-primary-600">#TailwindCSS</span>
              </div>
            </div>

            <div class="space-y-1">
              <h4 class="text-[10px] font-bold text-dark-900/40 uppercase tracking-tighter">Backend & Database</h4>
              <div class="flex flex-wrap gap-1.5">
                <span class="px-2 py-0.5 bg-green-50 text-[10px] font-bold rounded border border-green-200 text-green-600">#NodeJS</span>
                <span class="px-2 py-0.5 bg-green-50 text-[10px] font-bold rounded border border-green-200 text-green-600">#MongoDB</span>
              </div>
            </div>
          </div>

          <div class="md:border-x border-primary-300 px-8 text-center flex flex-col justify-center space-y-2">
            <div class="flex justify-center items-center space-x-2">
              <img src="${publicBase}/images/taskgo-logo.png" alt="Logo" class="w-6 h-6 opacity-60">
              <span class="text-lg font-black tracking-tighter text-dark-900">TaskGo</span>
            </div>
            <p class="text-xs font-bold text-dark-900 uppercase">Công nghệ Web và ứng dụng</p>
            <p class="text-[11px] font-medium text-primary-600">SE347.Q14 - NHÓM 8</p>
          </div>

          <div class="flex flex-col justify-between md:items-end text-center md:text-right py-1">
            <div class="space-y-1">
              <h4 class="text-[10px] font-bold text-dark-900/40 uppercase tracking-tighter">Giảng viên hướng dẫn</h4>
              <p class="text-sm font-bold text-dark-900">ThS. Trần Thị Hồng Yến</p>
              <p class="text-[10px] text-gray-500 font-medium">Đại học Công nghệ Thông tin - ĐHQG TP.HCM</p>
            </div>

            <div class="mt-4 md:mt-0">
              <p class="text-[10px] text-gray-400 font-bold uppercase tracking-widest">© 2025 NHÓM 8 • UIT</p>
            </div>
          </div>

        </div>
      </div>
    </footer>
  `;

  // ====== Inject ======
  if (headerMount) headerMount.innerHTML = headerHTML;
  if (footerMount) footerMount.innerHTML = footerHTML;

  // ====== Mobile menu toggle ======
  const menuBtn = document.getElementById("menu-btn");
  const mobileMenu = document.getElementById("mobile-menu");

  if (menuBtn && mobileMenu) {
    menuBtn.addEventListener("click", () => {
      mobileMenu.classList.toggle("hidden");
    });

    document.addEventListener("click", (e) => {
      const t = e.target;
      if (!t) return;
      const insideMenu = mobileMenu.contains(t);
      const insideBtn = menuBtn.contains(t);
      if (!insideMenu && !insideBtn) mobileMenu.classList.add("hidden");
    });

    mobileMenu.querySelectorAll("a").forEach((a) => {
      a.addEventListener("click", () => mobileMenu.classList.add("hidden"));
    });
  }

  // ====== LOGOUT handler (desktop + mobile) ======
  const doLogout = () => {
    const ok = confirm("Bạn chắc chắn muốn đăng xuất?");
    if (!ok) return;

    [
      "token",
      "system_role",
      "user",
      "profile",
      "customer",
      "tasker",
      "bookingDraft",
    ].forEach((k) => localStorage.removeItem(k));

    window.location.href = links.login;
  };

  const logoutBtnDesktop = document.getElementById("logout-btn-desktop");
  const logoutBtnMobile = document.getElementById("logout-btn-mobile");

  if (logoutBtnDesktop) logoutBtnDesktop.addEventListener("click", doLogout);
  if (logoutBtnMobile)
    logoutBtnMobile.addEventListener("click", () => {
      if (mobileMenu) mobileMenu.classList.add("hidden");
      doLogout();
    });
}
