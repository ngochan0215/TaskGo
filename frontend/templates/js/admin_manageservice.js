const sidebarMobile = document.getElementById("sidebarMobile");
const backdrop = document.getElementById("backdrop");

function openSidebar() {
  sidebarMobile.classList.remove("-translate-x-full");
  backdrop.classList.remove("hidden");
}

function closeSidebar() {
  sidebarMobile.classList.add("-translate-x-full");
  backdrop.classList.add("hidden");
}

function logout() {
  localStorage.removeItem("token");
  localStorage.removeItem("accessToken");
  showToast("logout", "Đã đăng xuất", "Bạn đã đăng xuất khỏi hệ thống.");
}

function getApiBase() {
  const isSameBackend = window.location.port === "3000";
  return isSameBackend ? "" : "http://localhost:3000";
}

function getAuthHeaders() {
  const token =
    localStorage.getItem("token") || localStorage.getItem("accessToken");
  const headers = { "Content-Type": "application/json" };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

async function apiFetch(path, options = {}) {
  const base = getApiBase();
  const res = await fetch(base + path, {
    credentials: "include",
    ...options,
    headers: { ...getAuthHeaders(), ...(options.headers || {}) },
  });

  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch (_) {
    data = { raw: text };
  }

  if (!res.ok) {
    const msg =
      data && (data.message || data.error || data.err)
        ? data.message || data.error || data.err
        : `HTTP ${res.status}`;
    throw new Error(typeof msg === "string" ? msg : JSON.stringify(msg));
  }

  return data;
}

const servicesTbody = document.getElementById("servicesTbody");
const searchInput = document.getElementById("searchInput");
const statusFilter = document.getElementById("statusFilter");
const statTotal = document.getElementById("statTotal");
const statActive = document.getElementById("statActive");
const statInactive = document.getElementById("statInactive");
const resultHint = document.getElementById("resultHint");
const pageRange = document.getElementById("pageRange");
const pageTotal = document.getElementById("pageTotal");
const pageButtons = document.getElementById("pageButtons");
const btnPrev = document.getElementById("btnPrev");
const btnNext = document.getElementById("btnNext");

const toast = document.getElementById("toast");
const toastIcon = document.getElementById("toastIcon");
const toastTitle = document.getElementById("toastTitle");
const toastMsg = document.getElementById("toastMsg");
let toastTimer = null;

function showToast(type, title, msg) {
  clearTimeout(toastTimer);
  toast.classList.remove("hidden");

  const map = {
    ok: { icon: "check_circle", title: title || "Thành công" },
    err: { icon: "error", title: title || "Lỗi" },
    info: { icon: "info", title: title || "Thông báo" },
    logout: { icon: "logout", title: title || "Đăng xuất" },
  };

  const t = map[type] || map.info;
  toastIcon.textContent = t.icon;
  toastTitle.textContent = t.title;
  toastMsg.textContent = msg || "";

  toastTimer = setTimeout(() => hideToast(), 3500);
}

function hideToast() {
  toast.classList.add("hidden");
}

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function badge(status) {
  const s = (status || "").toLowerCase();
  if (s === "active") {
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">Active</span>`;
  }
  if (s === "inactive") {
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-600 border border-gray-200">Inactive</span>`;
  }
  if (s === "launching") {
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">Launching</span>`;
  }
  return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">${escapeHtml(
    status || "-"
  )}</span>`;
}

let currentPage = 1;
let totalItems = 0;
let pageSize = 10;
let totalPages = 1;

function renderRow(service) {
  const id = service._id;
  const name = service.category_name || "-";
  const desc = service.description || "";
  const status = service.status || "launching";
  const tasksCount = Array.isArray(service.tasks) ? service.tasks.length : 0;

  const toggleBtn =
    String(status).toLowerCase() === "active"
      ? `<button class="px-2 py-1 text-xs rounded-md border border-gray-200 hover:bg-gray-50 text-gray-600" onclick="unactivateService('${id}')">Unactivate</button>`
      : `<button class="px-2 py-1 text-xs rounded-md bg-primary-500 text-white hover:bg-primary-600" onclick="activateService('${id}')">Activate</button>`;

  const safeName = escapeHtml(name).replaceAll("&#039;", "\\'");
  const safeDesc = escapeHtml(desc).replaceAll("&#039;", "\\'");

  return `
    <tr class="hover:bg-gray-50 transition-colors">
      <td class="px-4 py-3">
        <div class="font-semibold text-gray-800">${escapeHtml(name)}</div>
        <div class="text-xs text-gray-500 break-all">${escapeHtml(id)}</div>
      </td>
      <td class="px-4 py-3">
        <div class="text-sm text-gray-700 leading-snug">
          ${escapeHtml(desc).slice(0, 140)}${desc.length > 140 ? "..." : ""}
        </div>
      </td>
      <td class="px-4 py-3 text-center">${badge(status)}</td>
      <td class="px-4 py-3 text-center font-bold">${tasksCount}</td>
      <td class="px-4 py-3">
        <div class="flex items-center justify-center gap-2 flex-wrap">
          <button class="px-2 py-1 text-xs rounded-md border border-gray-200 hover:bg-gray-50 text-gray-600" onclick="openDetail('${id}')">Xem chi tiết</button>
          <button class="px-2 py-1 text-xs rounded-md border border-gray-200 hover:bg-gray-50 text-gray-600" onclick="openEditModal('${id}', '${safeName}', '${safeDesc}')">Sửa</button>
          ${toggleBtn}
          <button class="px-2 py-1 text-xs rounded-md border border-red-200 hover:bg-red-50 text-red-600" onclick="openDeleteModal('${id}', '${safeName}')">Xóa</button>
        </div>
      </td>
    </tr>
  `;
}

function renderPagination() {
  pageButtons.innerHTML = "";

  const maxBtns = 5;
  let start = Math.max(1, currentPage - Math.floor(maxBtns / 2));
  let end = Math.min(totalPages, start + maxBtns - 1);
  start = Math.max(1, end - maxBtns + 1);

  for (let p = start; p <= end; p++) {
    const active = p === currentPage;
    const cls = active
      ? "w-8 h-8 flex items-center justify-center rounded bg-primary-500 text-white font-bold text-sm"
      : "w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 text-gray-600 text-sm";
    pageButtons.innerHTML += `<button class="${cls}" onclick="loadServices(${p})">${p}</button>`;
  }

  btnPrev.disabled = currentPage <= 1;
  btnNext.disabled = currentPage >= totalPages;
}

function updateRange() {
  const start = totalItems === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const end = Math.min(currentPage * pageSize, totalItems);
  pageRange.textContent = `${start}-${end}`;
  pageTotal.textContent = `${totalItems}`;
}

function goPrev() {
  if (currentPage > 1) loadServices(currentPage - 1);
}

function goNext() {
  if (currentPage < totalPages) loadServices(currentPage + 1);
}

function resetFilters() {
  searchInput.value = "";
  statusFilter.value = "";
  loadServices(1);
}

async function loadServices(page = 1) {
  currentPage = page;

  const qSearch = searchInput.value.trim();
  const qStatus = statusFilter.value.trim();

  const params = new URLSearchParams();
  params.set("page", String(currentPage));
  params.set("limit", String(pageSize));
  if (qSearch) params.set("search", qSearch);
  if (qStatus) params.set("status", qStatus);

  resultHint.textContent = "Đang tải dữ liệu...";
  servicesTbody.innerHTML = `<tr><td colspan="5" class="px-4 py-10 text-center text-gray-500">Đang tải...</td></tr>`;

  try {
    const data = await apiFetch(`/api/task/service/all?${params.toString()}`, {
      method: "GET",
    });
    const services = Array.isArray(data.services) ? data.services : [];

    totalItems = Number(data.total || services.length || 0);
    totalPages = Math.max(1, Math.ceil(totalItems / pageSize));

    const activeCount = services.filter(
      (s) => String(s.status || "").toLowerCase() === "active"
    ).length;
    const inactiveCount = services.filter(
      (s) => String(s.status || "").toLowerCase() === "inactive"
    ).length;

    statTotal.textContent = String(totalItems);
    statActive.textContent = String(activeCount);
    statInactive.textContent = String(inactiveCount);

    if (!services.length) {
      servicesTbody.innerHTML = `<tr><td colspan="5" class="px-4 py-10 text-center text-gray-500">Không có dữ liệu phù hợp.</td></tr>`;
      resultHint.textContent = "Không có dữ liệu.";
    } else {
      servicesTbody.innerHTML = services.map(renderRow).join("");
      resultHint.textContent = `Đã tải ${services.length} bản ghi (trang ${currentPage}/${totalPages}).`;
    }

    updateRange();
    renderPagination();
  } catch (err) {
    servicesTbody.innerHTML = `<tr><td colspan="5" class="px-4 py-10 text-center text-red-600">Lỗi tải dữ liệu: ${escapeHtml(
      err.message
    )}</td></tr>`;
    resultHint.textContent = "Lỗi tải dữ liệu.";
    showToast("err", "Không tải được", err.message);
  }
}

const serviceModal = document.getElementById("serviceModal");
const serviceModalTitle = document.getElementById("serviceModalTitle");
const serviceId = document.getElementById("serviceId");
const categoryNameInput = document.getElementById("categoryNameInput");
const descriptionInput = document.getElementById("descriptionInput");

function openCreateModal() {
  serviceModalTitle.textContent = "Thêm dịch vụ";
  serviceId.value = "";
  categoryNameInput.value = "";
  descriptionInput.value = "";
  serviceModal.classList.remove("modal-hidden");
}

function openEditModal(id, name, desc) {
  serviceModalTitle.textContent = "Sửa dịch vụ";
  serviceId.value = id;
  categoryNameInput.value = name || "";
  descriptionInput.value = desc || "";
  serviceModal.classList.remove("modal-hidden");
}

function closeServiceModal() {
  serviceModal.classList.add("modal-hidden");
}

async function saveService() {
  const id = serviceId.value.trim();
  const category_name = categoryNameInput.value.trim();
  const description = descriptionInput.value.trim();

  if (!category_name || !description) {
    showToast(
      "err",
      "Thiếu dữ liệu",
      "Vui lòng nhập đầy đủ Tên danh mục và Mô tả."
    );
    return;
  }

  try {
    if (!id) {
      await apiFetch("/api/task/service/new", {
        method: "POST",
        body: JSON.stringify({ category_name, description }),
      });
      showToast("ok", "Đã tạo", "Tạo dịch vụ thành công.");
    } else {
      await apiFetch(`/api/task/service/update/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ category_name, description }),
      });
      showToast("ok", "Đã cập nhật", "Cập nhật dịch vụ thành công.");
    }

    closeServiceModal();
    loadServices(1);
  } catch (err) {
    showToast("err", "Thất bại", err.message);
  }
}

async function activateService(id) {
  try {
    await apiFetch(`/api/task/service/activate/${id}`, { method: "PATCH" });
    showToast("ok", "Đã kích hoạt", "Dịch vụ đã chuyển sang Active.");
    loadServices(currentPage);
  } catch (err) {
    showToast("err", "Không thể kích hoạt", err.message);
  }
}

async function unactivateService(id) {
  try {
    await apiFetch(`/api/task/service/unactivate/${id}`, { method: "PATCH" });
    showToast("ok", "Đã ngưng", "Dịch vụ đã chuyển sang Inactive.");
    loadServices(currentPage);
  } catch (err) {
    showToast("err", "Không thể ngưng", err.message);
  }
}

const detailModal = document.getElementById("detailModal");
const detailSubtitle = document.getElementById("detailSubtitle");
const detailStatus = document.getElementById("detailStatus");
const detailTaskCount = document.getElementById("detailTaskCount");
const detailId = document.getElementById("detailId");
const detailDesc = document.getElementById("detailDesc");
const detailTasksTbody = document.getElementById("detailTasksTbody");

function closeDetailModal() {
  detailModal.classList.add("modal-hidden");
}

async function openDetail(id) {
  detailModal.classList.remove("modal-hidden");
  detailSubtitle.textContent = "Đang tải chi tiết...";
  detailStatus.textContent = "-";
  detailTaskCount.textContent = "-";
  detailId.textContent = id;
  detailDesc.textContent = "-";
  detailTasksTbody.innerHTML = `<tr><td colspan="4" class="px-4 py-10 text-center text-gray-500">Đang tải...</td></tr>`;

  try {
    const data = await apiFetch(`/api/task/service/${id}`, { method: "GET" });
    const svc =
      data && (data.data || data.service || data)
        ? data.data || data.service || data
        : null;
    if (!svc) throw new Error("Không có dữ liệu chi tiết.");

    detailSubtitle.textContent = svc.category_name || "";
    detailStatus.textContent = String(svc.status || "launching");
    const tasks = Array.isArray(svc.tasks) ? svc.tasks : [];
    detailTaskCount.textContent = String(tasks.length);
    detailId.textContent = svc._id || id;
    detailDesc.textContent = svc.description || "-";

    if (!tasks.length) {
      detailTasksTbody.innerHTML = `<tr><td colspan="4" class="px-4 py-10 text-center text-gray-500">Không có task thuộc dịch vụ này.</td></tr>`;
    } else {
      detailTasksTbody.innerHTML = tasks
        .map((t) => {
          const price =
            t.pricing !== undefined && t.pricing !== null
              ? String(t.pricing)
              : "-";
          const tStatus = t.status || "-";
          return `
          <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-4 py-3 font-semibold text-gray-800">${escapeHtml(
              t.task_name || "-"
            )}</td>
            <td class="px-4 py-3 text-gray-600">${escapeHtml(
              (t.description || "").slice(0, 120)
            )}${(t.description || "").length > 120 ? "..." : ""}</td>
            <td class="px-4 py-3 text-right font-bold">${escapeHtml(price)}</td>
            <td class="px-4 py-3 text-center">${badge(tStatus)}</td>
          </tr>
        `;
        })
        .join("");
    }
  } catch (err) {
    detailTasksTbody.innerHTML = `<tr><td colspan="4" class="px-4 py-10 text-center text-red-600">Lỗi: ${escapeHtml(
      err.message
    )}</td></tr>`;
    showToast("err", "Không tải được chi tiết", err.message);
  }
}

const deleteModal = document.getElementById("deleteModal");
const deleteServiceId = document.getElementById("deleteServiceId");
const deleteServiceName = document.getElementById("deleteServiceName");
const forceDelete = document.getElementById("forceDelete");

function openDeleteModal(id, name) {
  deleteServiceId.value = id;
  deleteServiceName.textContent = name || "";
  forceDelete.checked = false;
  deleteModal.classList.remove("modal-hidden");
}

function closeDeleteModal() {
  deleteModal.classList.add("modal-hidden");
}

async function confirmDelete() {
  const id = deleteServiceId.value.trim();
  const isForce = forceDelete.checked;

  try {
    const url = isForce
      ? `/api/task/service/delete/${id}?force=true`
      : `/api/task/service/delete/${id}`;
    await apiFetch(url, { method: "DELETE" });
    showToast("ok", "Đã xóa", "Xóa dịch vụ thành công.");
    closeDeleteModal();
    loadServices(1);
  } catch (err) {
    showToast("err", "Xóa thất bại", err.message);
  }
}

searchInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") loadServices(1);
});

loadServices(1);
