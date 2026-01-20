class TaskerHeader extends HTMLElement {
  connectedCallback() {
    const active = this.getAttribute("active");
    const heading = this.getAttribute("heading") || "Trang chủ";
    this.token = localStorage.getItem("token");

    // Hàm tạo style cho link menu
    const getLinkClass = (pageName) => {
      const baseClass = "block py-2 text-base transition font-bold";
      if (active === pageName) {
        return `${baseClass} text-[#3730A3]`;
      } else {
        return `${baseClass} text-gray-600 hover:text-[#3730A3]`;
      }
    };

    this.innerHTML = `
      <nav class="sticky top-0 z-[100] bg-white shadow-sm font-montserrat">

        <header style="background-color: #A5B4FC;" class="flex items-center justify-between px-4 py-3 shadow-md relative z-[50]">
            <div class="flex items-center gap-3">
                <div class="logo-icon flex-shrink-0 w-9 h-9 bg-white rounded-full p-1 flex items-center justify-center shadow-sm">
                    <img src="../../public/images/taskgo-logo.png" onerror="this.src='https://placehold.co/40x40?text=T'" alt="TaskGo icon" class="object-contain">
                </div>
                <h1 class="text-[#111827] font-bold text-lg uppercase tracking-wide">${heading}</h1>
            </div>

            <div class="flex items-center gap-2">
                <button id="notification-btn" class="w-9 h-9 flex items-center justify-center bg-white/20 rounded-full hover:bg-white/40 transition relative">
                    <span class="material-symbols-outlined text-[#111827]">notifications</span>
                    ${active === 'notification' ? '<span class="absolute top-2 right-2.5 w-2 h-2 bg-red-600 rounded-full border border-[#A5B4FC]"></span>' : ''}
                </button>
                <button id="menu-btn" class="p-2 focus:outline-none flex items-center bg-white/20 rounded-lg hover:bg-white/40 transition text-[#111827]">
                    <span id="menu-icon" class="material-symbols-outlined">menu</span>
                </button>
            </div>
        </header>

        <div id="menu-overlay" class="menu-hamburger absolute top-full left-0 w-full bg-white shadow-xl transition-all duration-300 -translate-y-[150%] z-40 border-t border-gray-100 opacity-0 pointer-events-none">
            <nav class="flex flex-col p-6 space-y-6 text-[#111827] font-bold max-w-7xl mx-auto">

                <div class="flex items-center gap-3 pb-4 border-b border-gray-100">
                    <div class="w-12 h-12 rounded-full overflow-hidden border border-[#A5B4FC] bg-[#E0E7FF]">
                        <img
                            id="header-avatar"
                            src="https://api.dicebear.com/9.x/bottts/svg?seed=Tasker"
                            alt="User avatar"
                            class="w-full h-full object-cover"
                        />
                    </div>
                    <div>
                        <p id="header-username" class="text-lg">Đang tải...</p>
                        <p id="header-userid" class="text-xs font-medium text-gray-500">...</p>
                    </div>
                </div>

                <a href="./tasker_home.html" class="${getLinkClass('home')}">Trang chủ</a>
                <a href="./profile.html" class="${getLinkClass('profile')}">Profile cá nhân</a>
                <a href="./tasker_activity.html" class="${getLinkClass('activity')}">Hoạt động</a>
                <a href="./tasker_earnings.html" class="${getLinkClass('earnings')}">Thu nhập</a>
                <a href="./work_schedule.html" class="${getLinkClass('schedule')}">Lịch làm việc</a>
                <a href="./tasker_chat.html" class="${getLinkClass('chat')}">Tin nhắn</a>

                <a href="#" id="logout-btn" class="pb-4 text-red-600 flex items-center gap-3 hover:bg-red-50 rounded-lg px-2 -ml-2 transition">
                    <span class="material-symbols-outlined">logout</span> Đăng xuất
                </a>
            </nav>
        </div>
      </nav>
    `;

    this.setupLogic();
    this.loadUserInfo();
  }

  setupLogic() {
    const menuBtn = this.querySelector('#menu-btn');
    const menuOverlay = this.querySelector('#menu-overlay');

    if(menuBtn && menuOverlay) {
        menuBtn.addEventListener('click', () => {
            const isOpened = menuOverlay.classList.contains('translate-y-0');
            if (isOpened) {
                menuOverlay.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
                menuOverlay.classList.add('-translate-y-[150%]', 'opacity-0', 'pointer-events-none');
            } else {
                menuOverlay.classList.remove('-translate-y-[150%]', 'opacity-0', 'pointer-events-none');
                menuOverlay.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
            }
        });
    }

    const logoutBtn = this.querySelector("#logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();
            try {
                await fetch("http://localhost:3000/api/auth/logout", {
                    method: "POST", headers: { Authorization: `Bearer ${this.token}` }
                });
            } catch (err) {}
            localStorage.removeItem("token");
            localStorage.removeItem("user_id");
            localStorage.removeItem("system_role");
            window.location.href = "../auth/login-signup.html";
        });
    }

    const notiBtn = this.querySelector("#notification-btn");
    if (notiBtn) notiBtn.addEventListener("click", () => window.location.href = "notification.html");
  }

  async loadUserInfo() {
    if (!this.token) return;
    try {
        const res = await fetch("http://localhost:3000/api/user/profile", {
            headers: { Authorization: `Bearer ${this.token}` }
        });
        const data = await res.json();
        if (data.success && data.user) {
            const avatarEl = this.querySelector("#header-avatar");
            const nameEl = this.querySelector("#header-username");
            const idEl = this.querySelector("#header-userid");
            if(avatarEl) avatarEl.src = data.user.avatar_url || "https://api.dicebear.com/9.x/bottts/svg?seed=Default";
            if(nameEl) nameEl.innerText = data.user.full_name;
            if(idEl) idEl.innerText = `ID: #${data.user._id.slice(-6).toUpperCase()}`;
        }
    } catch (err) { console.error(err); }
  }
}

customElements.define("tasker-header", TaskerHeader);