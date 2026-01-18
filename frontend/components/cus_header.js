class AppHeader extends HTMLElement {
  connectedCallback() {
    const active = this.getAttribute("active");

    this.innerHTML = `
      <header class="bg-primary-200 py-4 sticky top-0 z-50 shadow-md">
        <div class="flex items-center justify-between px-4 relative">
          <div class="text-primary-500 w-10 h-10 rounded-full bg-white flex items-center justify-center opacity-70">
            <a href="#"><img src="../public/images/taskgo-logo.png" alt="Logo"></a>
          </div>

          <h1 class="md:hidden font-bold text-xl text-dark-900 absolute left-1/2 -translate-x-1/2">
            ${active === "chat" ? "Tin nhắn" : active === "notification" ? "Thông báo" : "Trang chủ"}
          </h1>

          <nav class="hidden md:flex items-center space-x-6 lg:space-x-10">
            <a href="customer/customer_home.html"
              class="${active === "home"
                ? "text-dark-900 font-bold border-b-2 border-primary-500"
                : "text-primary-500 hover:text-dark-900"}">
              Trang chủ
            </a>

            <a href="customer/customer_activity.html"
              class="${active === "activity"
                ? "text-dark-900 font-bold border-b-2 border-primary-500"
                : "text-primary-500 hover:text-dark-900"}">
              Hoạt động
            </a>

            <a href="chat.html"
              class="${active === "chat"
                ? "text-dark-900 font-bold border-b-2 border-primary-500"
                : "text-primary-500 hover:text-dark-900"}">
              Tin nhắn
            </a>

            <a href="notification.html"
              class="${active === "notification"
                ? "text-dark-900 font-bold border-b-2 border-primary-500"
                : "text-primary-500 hover:text-dark-900"}">
              Thông báo
            </a>
          </nav>

          <div id="menu-btn" class="md:hidden w-10 h-10 flex items-center justify-center cursor-pointer">
            <span class="material-symbols-outlined text-primary-500 text-4xl">menu</span>
          </div>

          <div class="hidden md:block w-10"></div>
        </div>
      </header>
    `;
  }
}

customElements.define("app-header", AppHeader);
