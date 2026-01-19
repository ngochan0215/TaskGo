// frontend/templates/js/ui/shared-layout.js
export function initLayout({
  role = "customer",
  title = "TaskGo",
  active = "",
} = {}) {
  const headerHost = document.getElementById("app-header");
  const footerHost = document.getElementById("app-footer");
  if (!headerHost || !footerHost) return;

  // ====== Compute paths safely for pages in nested folders (e.g. payment_pages/...) ======
  const pathname = (window.location.pathname || "").replace(/\\/g, "/");

  // Get path part after "/templates/"
  const tplIdx = pathname.lastIndexOf("/templates/");
  const afterTemplates =
    tplIdx !== -1 ? pathname.slice(tplIdx + "/templates/".length) : "";
  const seg = afterTemplates.split("/").filter(Boolean); // includes filename
  const publicBase = "../".repeat(seg.length || 2) + "public"; // default fallback

  // Determine relative path to role root folder: templates/{role}/
  let upToRoleRoot = "";
  if (afterTemplates.startsWith(`${role}/`)) {
    const rest = afterTemplates
      .slice(`${role}/`.length)
      .split("/")
      .filter(Boolean); // includes filename
    // current file is inside role/... => go up (rest.length - 1) folders
    upToRoleRoot = "../".repeat(Math.max(rest.length - 1, 0));
  }

  const links = {
    home: `${upToRoleRoot}${role}_home.html`,
    activity: `${upToRoleRoot}${role}_activity.html`,
    chat: "#",
    notify: "#",
  };

  const isActive = (key) => active === key;
  const navItemClass = (key) =>
    `flex flex-col items-center ${isActive(key) ? "text-white" : "text-primary-500"}`;

  // ====== HEADER (giữ đúng style logo + title + menu như các file của nhóm em) ======
  headerHost.innerHTML = `
    <header class="bg-primary-200 py-4">
      <div class="flex items-center justify-between px-4">
        <div class="text-primary-500 w-10 h-10 rounded-full bg-white flex items-center justify-center opacity-70">
          <a href="${links.home}">
            <img src="${publicBase}/images/taskgo-logo.png" alt="TaskGo" />
          </a>
        </div>

        <h1 class="font-bold text-xl text-dark-900">${title}</h1>

        <div class="w-10 h-10 flex items-center justify-center">
          <a href="#">
            <span class="material-symbols-outlined text-primary-500 text-4xl">menu</span>
          </a>
        </div>
      </div>
    </header>
  `;

  // ====== FOOTER (giữ đúng UI bottom nav như file của nhóm em) ======
  footerHost.innerHTML = `
    <footer>
      <nav class="fixed bottom-0 left-0 right-0 bg-primary-200 border-t shadow-xl">
        <div class="flex justify-around py-2 text-base">
          <a href="${links.home}" class="${navItemClass("home")}">
            <span class="material-symbols-outlined text-4xl">house</span>
            Trang chủ
          </a>

          <a href="${links.activity}" class="${navItemClass("activity")}">
            <span class="material-symbols-outlined text-4xl">news</span>
            Hoạt động
          </a>

          <a href="${links.chat}" class="${navItemClass("chat")}">
            <span class="material-symbols-outlined text-4xl">chat</span>
            Tin nhắn
          </a>

          <a href="${links.notify}" class="${navItemClass("notify")}">
            <span class="material-symbols-outlined text-4xl">lightbulb</span>
            Thông báo
          </a>
        </div>
      </nav>
    </footer>
  `;
}
