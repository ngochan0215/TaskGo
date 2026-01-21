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

// logic đăng xuất
  const logoutBtn = document.querySelectorAll(".logout-btn");
  logoutBtn.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();

      try {
        const res = await fetch("http://localhost:3000/api/auth/logout", {
          method: "POST",
          credentials: "include",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await res.json();

        if (data.success) {
          localStorage.removeItem("token");
          localStorage.removeItem("user_id");
          localStorage.removeItem("system_role");

          alert("Đăng xuất thành công. Bạn sẽ được chuyển về trang Đăng nhập.");
          window.location.href = "../auth/login-signup.html";
        } else {
          alert("Đăng xuất thất bại. Vui lòng thử lại.");
        }
      } catch (err) {
        console.error("LOGOUT ERROR:", err);
        alert("Có lỗi xảy ra khi đăng xuất.");
      }
    });
  });

const $ = (id) => document.getElementById(id);

// Check authentication
const token = localStorage.getItem("token");
const role = localStorage.getItem("system_role");

if (!token || role !== "admin") {
  alert("Bạn không có quyền truy cập trang này");
  window.location.href = "../auth/login-signup.html";
}

const API_BASE = "http://localhost:3000/api/task";

const state = {
  tab: "categories",
  search: "",
  filterCategory: "all",
  filterStatus: "all",
  catMode: "add",
  srvMode: "add",
  editingCatId: null,
  editingSrvId: null,
  deleteCtx: null,
  categories: [],
  services: [],
};

function fmtMoney(v) {
  const n = Number(v || 0);
  return n.toLocaleString("vi-VN") + "đ";
}

function statusChip(status) {
  if (status === "active") {
    return `
      <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">
        Active
      </span>`;
  }
  return `
    <span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">
      Inactive
    </span>`;
}

function unitLabel(unit) {
  if (unit === "hour") return "Giờ";
  if (unit === "job") return "Gói";
  return "Lần";
}

function openModal(id) {
  $(id).classList.remove("hidden");
}

function closeModal(id) {
  $(id).classList.add("hidden");
}

function toast(msg) {
  $("toastText").textContent = msg;
  $("toast").classList.remove("hidden");
  clearTimeout(toast._t);
  toast._t = setTimeout(() => $("toast").classList.add("hidden"), 1600);
}

function applyRole() {
  const role = (localStorage.getItem("role") || "admin").toLowerCase();
  document.querySelectorAll("[data-admin-only]").forEach((el) => {
    if (role !== "admin") el.classList.add("hidden");
    else el.classList.remove("hidden");
  });
}

function switchTab(tab) {
  state.tab = tab;
  if (tab === "categories") {
    $("panelCategories").classList.remove("hidden");
    $("panelServices").classList.add("hidden");
    $("tabCategories").classList.add(
      "bg-white",
      "shadow-sm",
      "text-gray-900",
      "font-semibold"
    );
    $("tabServices").classList.remove(
      "bg-white",
      "shadow-sm",
      "text-gray-900",
      "font-semibold"
    );
    $("tabServices").classList.add("text-gray-700");
    $("hintText").textContent = "Quản lý danh mục (loại) dịch vụ";
    $("btnAddCategory").classList.remove("hidden");
    $("btnAddService").classList.add("hidden");
    $("serviceFilters").classList.add("hidden");
  } else {
    $("panelCategories").classList.add("hidden");
    $("panelServices").classList.remove("hidden");
    $("tabServices").classList.add(
      "bg-white",
      "shadow-sm",
      "text-gray-900",
      "font-semibold"
    );
    $("tabCategories").classList.remove(
      "bg-white",
      "shadow-sm",
      "text-gray-900",
      "font-semibold"
    );
    $("tabCategories").classList.add("text-gray-700");
    $("hintText").textContent = "Quản lý dịch vụ (task) trong hệ thống";
    $("btnAddCategory").classList.add("hidden");
    $("btnAddService").classList.remove("hidden");
    $("serviceFilters").classList.remove("hidden");
  }
  render();
}

function resetUI() {
  state.search = "";
  state.filterCategory = "all";
  state.filterStatus = "all";
  $("searchInput").value = "";
  $("filterCategory").value = "all";
  $("filterStatus").value = "all";
  render();
  toast("Đã reset bộ lọc");
}

async function loadCategories() {
  try {
    const res = await fetch(`${API_BASE}/service/all`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (res.status === 401) {
      localStorage.removeItem("token");
      alert("Phiên đăng nhập hết hạn");
      window.location.href = "../auth/login-signup.html";
      return;
    }

    const data = await res.json();
    if (data.success) {
      state.categories = data.services || [];
      render();
    }
  } catch (err) {
    console.error("Error loading categories:", err);
    toast("Không thể tải danh sách loại dịch vụ");
  }
}

async function loadServices() {
  try {
    const res = await fetch(`${API_BASE}/all`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (res.status === 401) {
      localStorage.removeItem("token");
      alert("Phiên đăng nhập hết hạn");
      window.location.href = "../auth/login-signup.html";
      return;
    }

    const data = await res.json();
    if (data.success) {
      state.services = data.tasks || [];
      render();
    }
  } catch (err) {
    console.error("Error loading services:", err);
    toast("Không thể tải danh sách dịch vụ");
  }
}

function openCategoryModal(mode, id) {
  state.catMode = mode;
  state.editingCatId = id || null;
  $("catModalTitle").textContent =
    mode === "add" ? "Thêm loại dịch vụ" : "Sửa loại dịch vụ";

  const cat =
    mode === "edit" ? state.categories.find((c) => c._id === id || c.id === id) : null;
  $("catName").value = cat ? cat.category_name : "";
  $("catDesc").value = cat ? cat.description : "";
  $("catStatus").value = cat ? cat.status : "active";
  $("catAvatarUrl").value = cat ? (cat.avatar_url || "") : "";

  // Reset file input and preview
  $("catAvatarFile").value = "";
  $("catAvatarFileName").textContent = "";
  $("catAvatarPreview").classList.add("hidden");
  $("catAvatarPreview").src = "";
  if (cat && cat.avatar_url) {
    $("catAvatarPreview").src = cat.avatar_url;
    $("catAvatarPreview").classList.remove("hidden");
  }

  openModal("modalCategory");
}

async function handleCategoryAvatarChange(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 3 * 1024 * 1024) {
    toast("File quá lớn. Vui lòng chọn file nhỏ hơn 3MB");
    return;
  }

  $("catAvatarFileName").textContent = file.name;
  
  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    $("catAvatarPreview").src = e.target.result;
    $("catAvatarPreview").classList.remove("hidden");
  };
  reader.readAsDataURL(file);
}

async function saveCategory() {
  const category_name = $("catName").value.trim();
  const description = $("catDesc").value.trim();
  const status = $("catStatus").value;
  let avatar_url = $("catAvatarUrl").value.trim();

  if (!category_name) {
    toast("Vui lòng nhập Tên loại dịch vụ");
    return;
  }

  try {
    // Upload avatar if file is selected
    const avatarFile = $("catAvatarFile").files[0];
    if (avatarFile) {
      const formData = new FormData();
      formData.append("avatar", avatarFile);
      
      const serviceId = state.catMode === "edit" ? state.editingCatId : null;
      if (serviceId) {
        // Update existing service avatar
        const uploadRes = await fetch(`${API_BASE}/service/update-avatar/${serviceId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        });

        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.success) {
          avatar_url = uploadData.avatar_url;
        } else {
          toast(uploadData.message || "Tải ảnh lên thất bại");
          return;
        }
      } else {
        // For new service, we'll upload after creation
        // For now, skip avatar upload on create (can be added later)
        toast("Vui lòng tải ảnh sau khi tạo loại dịch vụ");
      }
    }

    if (state.catMode === "add") {
      const res = await fetch(`${API_BASE}/service/new`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ category_name, description, avatar_url, status })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Upload avatar after creation if file was selected
        if (avatarFile && data.service && data.service._id) {
          const formData = new FormData();
          formData.append("avatar", avatarFile);
          
          const uploadRes = await fetch(`${API_BASE}/service/update-avatar/${data.service._id}`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`
            },
            body: formData
          });

          if (uploadRes.ok) {
            await loadCategories();
          }
        } else {
          await loadCategories();
        }
        toast("Đã thêm loại dịch vụ");
      } else {
        toast(data.message || "Thêm loại dịch vụ thất bại");
      }
    } else {
      const serviceId = state.editingCatId;
      const res = await fetch(`${API_BASE}/service/update/${serviceId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ category_name, description, avatar_url, status })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast("Đã cập nhật loại dịch vụ");
        await loadCategories();
      } else {
        toast(data.message || "Cập nhật loại dịch vụ thất bại");
      }
    }

    closeModal("modalCategory");
  } catch (err) {
    console.error("Error saving category:", err);
    toast("Có lỗi xảy ra khi lưu loại dịch vụ");
  }
}

function openServiceModal(mode, id) {
  state.srvMode = mode;
  state.editingSrvId = id || null;
  $("srvModalTitle").textContent =
    mode === "add" ? "Thêm dịch vụ" : "Sửa dịch vụ";

  rebuildCategorySelects();

  const srv =
    mode === "edit" ? state.services.find((s) => s._id === id || s.id === id) : null;
  $("srvName").value = srv ? srv.task_name : "";
  $("srvCategory").value = srv && srv.service_id
    ? String(srv.service_id._id || srv.service_id)
    : state.categories[0]
    ? String(state.categories[0]._id || state.categories[0].id)
    : "";
  $("srvUnit").value = srv ? srv.unit : "hour";
  $("srvPrice").value = srv ? String(srv.pricing || srv.price) : "";
  $("srvDesc").value = srv ? srv.description : "";
  $("srvStatus").value = srv ? srv.status : "active";
  $("srvAvatarUrl").value = srv ? (srv.avatar_url || "") : "";
  
  // Reset file input and preview
  $("srvAvatarFile").value = "";
  $("srvAvatarFileName").textContent = "";
  $("srvAvatarPreview").classList.add("hidden");
  $("srvAvatarPreview").src = "";
  if (srv && srv.avatar_url) {
    $("srvAvatarPreview").src = srv.avatar_url;
    $("srvAvatarPreview").classList.remove("hidden");
  }

  openModal("modalService");
}

async function handleServiceAvatarChange(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 3 * 1024 * 1024) {
    toast("File quá lớn. Vui lòng chọn file nhỏ hơn 3MB");
    return;
  }

  $("srvAvatarFileName").textContent = file.name;
  
  // Show preview
  const reader = new FileReader();
  reader.onload = (e) => {
    $("srvAvatarPreview").src = e.target.result;
    $("srvAvatarPreview").classList.remove("hidden");
  };
  reader.readAsDataURL(file);
}

async function saveService() {
  const task_name = $("srvName").value.trim();
  const service_id = $("srvCategory").value;
  const unit = $("srvUnit").value;
  const pricing = Number($("srvPrice").value || 0);
  const description = $("srvDesc").value.trim();
  const status = $("srvStatus").value;
  let avatar_url = $("srvAvatarUrl").value.trim();

  if (!task_name || !service_id) {
    toast("Vui lòng nhập Tên + Loại dịch vụ");
    return;
  }

  try {
    // Upload avatar if file is selected
    const avatarFile = $("srvAvatarFile").files[0];
    if (avatarFile) {
      const formData = new FormData();
      formData.append("avatar", avatarFile);
      
      const taskId = state.srvMode === "edit" ? state.editingSrvId : null;
      if (taskId) {
        // Update existing task avatar
        const uploadRes = await fetch(`${API_BASE}/update-avatar/${taskId}`, {
          method: "PUT",
          headers: {
            Authorization: `Bearer ${token}`
          },
          body: formData
        });

        const uploadData = await uploadRes.json();
        if (uploadRes.ok && uploadData.success) {
          avatar_url = uploadData.avatar_url;
        } else {
          toast(uploadData.message || "Tải ảnh lên thất bại");
          return;
        }
      }
    }

    if (state.srvMode === "add") {
      const res = await fetch(`${API_BASE}/new`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ service_id, task_name, description, pricing, unit, avatar_url })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        // Upload avatar after creation if file was selected
        if (avatarFile && data.task && data.task._id) {
          const formData = new FormData();
          formData.append("avatar", avatarFile);
          
          const uploadRes = await fetch(`${API_BASE}/update-avatar/${data.task._id}`, {
            method: "PUT",
            headers: {
              Authorization: `Bearer ${token}`
            },
            body: formData
          });

          if (uploadRes.ok) {
            await loadServices();
          }
        } else {
          await loadServices();
        }
        toast("Đã thêm dịch vụ");
      } else {
        toast(data.message || "Thêm dịch vụ thất bại");
      }
    } else {
      const taskId = state.editingSrvId;
      console.log("task status: ", status);
      const res = await fetch(`${API_BASE}/update/${taskId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ task_name, description, pricing, unit, avatar_url, status })
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast("Đã cập nhật dịch vụ");
        await loadServices();
      } else {
        toast(data.message || "Cập nhật dịch vụ thất bại");
      }
    }

    closeModal("modalService");
  } catch (err) {
    console.error("Error saving service:", err);
    toast("Có lỗi xảy ra khi lưu dịch vụ");
  }
}

function askDelete(type, id) {
  state.deleteCtx = { type, id };
  if (type === "category") {
    const cat = state.categories.find((c) => (c._id || c.id) === id);
    $("confirmText").textContent = `Xóa loại dịch vụ "${
      cat ? (cat.category_name || cat.name) : ""
    }"? Dịch vụ thuộc loại này sẽ bị chuyển sang "Không xác định".`;
  } else {
    const srv = state.services.find((s) => (s._id || s.id) === id);
    $("confirmText").textContent = `Xóa dịch vụ "${
      srv ? (srv.task_name || srv.name) : ""
    }"?`;
  }
  openModal("modalConfirm");
}

async function confirmDelete() {
  if (!state.deleteCtx) return;
  const { type, id } = state.deleteCtx;

  try {
    if (type === "category") {
      const res = await fetch(`${API_BASE}/service/delete/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast("Đã xóa loại dịch vụ");
        await loadCategories();
        await loadServices();
      } else {
        toast(data.message || "Xóa loại dịch vụ thất bại");
      }
    } else {
      const res = await fetch(`${API_BASE}/delete/${id}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`
        }
      });

      const data = await res.json();
      if (res.ok && data.success) {
        toast("Đã xóa dịch vụ");
        await loadServices();
      } else {
        toast(data.message || "Xóa dịch vụ thất bại");
      }
    }

    state.deleteCtx = null;
    closeModal("modalConfirm");
  } catch (err) {
    console.error("Error deleting:", err);
    toast("Có lỗi xảy ra khi xóa");
  }
}

function rebuildCategorySelects() {
  const filter = $("filterCategory");
  const srvCat = $("srvCategory");

  const cats = state.categories.slice();

  if (filter) {
    const cur = filter.value || "all";
    filter.innerHTML =
      `<option value="all">Tất cả loại</option>` +
      cats
        .map((c) => `<option value="${c._id || c.id}">${c.category_name || c.name}</option>`)
        .join("");
    if ([...filter.options].some((o) => o.value === cur))
      filter.value = cur;
    else filter.value = "all";
    state.filterCategory = filter.value;
  }

  if (srvCat) {
    const cur2 = srvCat.value;
    srvCat.innerHTML = cats.length
      ? cats
          .map((c) => `<option value="${c._id || c.id}">${c.category_name || c.name}</option>`)
          .join("")
      : `<option value="">Chưa có loại dịch vụ</option>`;
    if (cats.length && [...srvCat.options].some((o) => o.value === cur2))
      srvCat.value = cur2;
    else if (cats.length) srvCat.value = String(cats[0]._id || cats[0].id);
  }
}

function getCatName(id) {
  if (!id) return "Không xác định";
  const cat = state.categories.find((c) => (c._id || c.id) === (id._id || id) || String(c._id || c.id) === String(id));
  if (cat) return cat.category_name || cat.name;
  return "Không xác định";
}

function renderStats() {
  $("statCategories").textContent = String(state.categories.length);
  $("statServices").textContent = String(state.services.length);
  const active = state.services.filter(
    (s) => s.status === "active"
  ).length;
  const inactive = state.services.length - active;
  $("statActive").textContent = String(active);
  $("statInactive").textContent = String(inactive);
}

function renderCategories() {
  const q = state.search.toLowerCase();
  const rows = state.categories
    .filter((c) => {
      if (!q) return true;
      const name = c.category_name || c.name || "";
      const desc = c.description || c.desc || "";
      return (name + " " + desc).toLowerCase().includes(q);
    })
    .map((c) => {
      const id = c._id || c.id;
      const name = c.category_name || c.name || "";
      const desc = c.description || c.desc || "";
      return `
        <tr class="hover:bg-gray-50 transition-colors">
          <td class="px-4 py-3">
            <div class="font-medium">${name}</div>
          </td>
          <td class="px-4 py-3 text-gray-500">${id}</td>
          <td class="px-4 py-3 text-gray-600">${desc}</td>
          <td class="px-4 py-3 text-center">${statusChip(c.status)}</td>
          <td class="px-4 py-3 text-center">
            <div class="inline-flex items-center gap-1">
              <button data-admin-only="1" class="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 hover:text-primary-500 transition" title="Sửa" onclick="openCategoryModal('edit', '${id}')">
                <span class="material-symbols-outlined text-[20px]">edit</span>
              </button>
              <button data-admin-only="1" class="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 hover:text-red-500 transition" title="Xóa" onclick="askDelete('category', '${id}')">
                <span class="material-symbols-outlined text-[20px]">delete</span>
              </button>
            </div>
          </td>
        </tr>`;
    })
    .join("");

  $("categoriesBody").innerHTML =
    rows ||
    `
    <tr>
      <td class="px-4 py-8 text-center text-gray-500" colspan="5">Không có dữ liệu</td>
    </tr>`;

  const total = state.categories.filter((c) => {
    if (!q) return true;
    const name = c.category_name || c.name || "";
    const desc = c.description || c.desc || "";
    return (name + " " + desc).toLowerCase().includes(q);
  }).length;

  $("catTotal").textContent = String(total);
  $("catRange").textContent = total ? `1-${total}` : "0";
}

function renderServices() {
  const q = state.search.toLowerCase();
  const catFilter = state.filterCategory;
  const stFilter = state.filterStatus;

  const rows = state.services
    .filter((s) => {
      const serviceId = s.service_id?._id || s.service_id || s.categoryId;
      if (
        catFilter !== "all" &&
        String(serviceId) !== String(catFilter)
      )
        return false;
      if (stFilter !== "all" && s.status !== stFilter) return false;
      if (!q) return true;
      const name = s.task_name || s.name || "";
      const desc = s.description || s.desc || "";
      return (
        name +
        " " +
        getCatName(serviceId) +
        " " +
        desc
      )
        .toLowerCase()
        .includes(q);
    })
    .map((s) => {
      const id = s._id || s.id;
      const name = s.task_name || s.name || "";
      const serviceId = s.service_id?._id || s.service_id || s.categoryId;
      const unit = s.unit || "hour";
      const price = s.pricing || s.price || 0;
      const desc = s.description || s.desc || "";
      return `
        <tr class="hover:bg-gray-50 transition-colors">
          <td class="px-4 py-3">
            <div class="font-medium">${name}</div>
          </td>
          <td class="px-4 py-3 text-gray-600">${getCatName(serviceId)}</td>
          <td class="px-4 py-3 text-gray-500">${unitLabel(unit)}</td>
          <td class="px-4 py-3 text-right font-bold">${fmtMoney(price)}</td>
          <td class="px-4 py-3 text-gray-600">${desc}</td>
          <td class="px-4 py-3 text-center">${statusChip(s.status)}</td>
          <td class="px-4 py-3 text-center">
            <div class="inline-flex items-center gap-1">
              <button data-admin-only="1" class="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 hover:text-primary-500 transition" title="Sửa" onclick="openServiceModal('edit', '${id}')">
                <span class="material-symbols-outlined text-[20px]">edit</span>
              </button>
              <button data-admin-only="1" class="p-2 border border-gray-200 rounded-lg hover:bg-gray-50 text-gray-500 hover:text-red-500 transition" title="Xóa" onclick="askDelete('service', '${id}')">
                <span class="material-symbols-outlined text-[20px]">delete</span>
              </button>
            </div>
          </td>
        </tr>`;
    })
    .join("");

  $("servicesBody").innerHTML =
    rows ||
    `
    <tr>
      <td class="px-4 py-8 text-center text-gray-500" colspan="7">Không có dữ liệu</td>
    </tr>`;

  const total = state.services.filter((s) => {
    const serviceId = s.service_id?._id || s.service_id || s.categoryId;
    if (catFilter !== "all" && String(serviceId) !== String(catFilter))
      return false;
    if (stFilter !== "all" && s.status !== stFilter) return false;
    if (!q) return true;
    const name = s.task_name || s.name || "";
    const desc = s.description || s.desc || "";
    return (
      name +
      " " +
      getCatName(serviceId) +
      " " +
      desc
    )
      .toLowerCase()
      .includes(q);
  }).length;

  $("srvTotal").textContent = String(total);
  $("srvRange").textContent = total ? `1-${total}` : "0";
}

function render() {
  renderStats();
  rebuildCategorySelects();
  if (state.tab === "categories") renderCategories();
  else renderServices();
  applyRole();
}

// Event listeners
$("searchInput").addEventListener("input", (e) => {
  state.search = e.target.value || "";
  render();
});

$("filterCategory").addEventListener("change", (e) => {
  state.filterCategory = e.target.value;
  render();
});

$("filterStatus").addEventListener("change", (e) => {
  state.filterStatus = e.target.value;
  render();
});

// Expose functions to window
window.switchTab = switchTab;
window.openCategoryModal = openCategoryModal;
window.openServiceModal = openServiceModal;
window.saveCategory = saveCategory;
window.saveService = saveService;
window.askDelete = askDelete;
window.confirmDelete = confirmDelete;
window.closeModal = closeModal;
window.resetUI = resetUI;
window.handleCategoryAvatarChange = handleCategoryAvatarChange;
window.handleServiceAvatarChange = handleServiceAvatarChange;
window.openSidebar = openSidebar;
window.closeSidebar = closeSidebar;

// Load data on page load
async function init() {
  await loadCategories();
  await loadServices();
  render();
}

init();
