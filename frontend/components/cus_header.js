class AppHeader extends HTMLElement {
    connectedCallback() {
        this.innerHTML = `
        <header class="bg-primary-200 py-4 sticky top-0 z-50 shadow-md">
            <div class="flex items-center justify-between px-4 relative">
                <div class="text-primary-500 w-10 h-10 rounded-full bg-white flex items-center justify-center opacity-70">
                    <a href="#"><img src="../public/images/taskgo-logo.png" alt="Logo"></a>
                </div>

                <h1 class="md:hidden font-bold text-xl text-dark-900 absolute left-1/2 -translate-x-1/2">Trang chủ</h1>

                <nav class="hidden md:flex items-center space-x-6 lg:space-x-10">
                    <a href="#" class="text-dark-900 font-bold border-b-2 border-primary-500">Trang chủ</a>
                    <a href="#" class="text-primary-500 hover:text-dark-900 font-medium transition-colors">Hoạt động</a>
                    <a href="#" class="text-primary-500 hover:text-dark-900 font-medium transition-colors">Tin nhắn</a>
                    <a href="#" class="text-primary-500 hover:text-dark-900 font-medium transition-colors">Thông báo</a>
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

customElements.define('app-header', AppHeader);