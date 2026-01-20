const sidebarMobile = document.getElementById("sidebarMobile");
const backdrop = document.getElementById("backdrop");

if (sidebarMobile) {
  window.openSidebar = function () {
    sidebarMobile.classList.remove("-translate-x-full");
    if (backdrop) backdrop.classList.remove("hidden");
  };
}
if (backdrop) {
  window.closeSidebar = function () {
    if (sidebarMobile) sidebarMobile.classList.add("-translate-x-full");
    backdrop.classList.add("hidden");
  };
}

const $ = (id) => document.getElementById(id);

// Check authentication
const token = localStorage.getItem("token");
const role = localStorage.getItem("system_role");

if (!token || role !== "admin") {
  alert("Bạn không có quyền truy cập trang này. Vui lòng đăng nhập lại.");
  window.location.href = "../auth/login-signup.html";
}

const API_BASE_URL = "http://localhost:3000/api/admin";

const formatCurrency = (amount) => {
  return new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
  }).format(amount);
};

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
  toast._t = setTimeout(() => $("toast").classList.add("hidden"), 3000);
}

function getStatusBadge(status, type = "account") {
  const statusMap = {
    account: {
      active:
        '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">ACTIVE</span>',
      inactive:
        '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">INACTIVE</span>',
      banned:
        '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">BANNED</span>',
    },
    working: {
      pending:
        '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">ĐANG CHỜ</span>',
      available:
        '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">ĐANG RẢNH</span>',
      busy: '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-orange-100 text-orange-700 border border-orange-200">ĐANG BẬN</span>',
      offline:
        '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">OFFLINE</span>',
      paused:
        '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-700 border border-blue-200">TẠM DỪNG</span>',
      inactive:
        '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-red-100 text-red-700 border border-red-200">KHÔNG HOẠT ĐỘNG</span>',
    },
    main: {
      pending:
        '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">ĐANG CHỜ DUYỆT</span>',
      working:
        '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">ĐANG LÀM VIỆC</span>',
      resign:
        '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">ĐÃ NGHỈ VIỆC</span>',
    },
  };

  const map = statusMap[type] || statusMap.account;
  return (
    map[status] ||
    map.inactive ||
    '<span class="text-xs text-gray-500">—</span>'
  );
}

async function apiCall(endpoint, method = "GET", body = null) {
  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  const config = { method, headers };
  if (body) config.body = JSON.stringify(body);

  try {
    const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
    const data = await response.json();

    if (response.status === 401) {
      localStorage.removeItem("token");
      alert("Phiên đăng nhập hết hạn");
      window.location.href = "../auth/login-signup.html";
      return null;
    }

    if (!response.ok) {
      throw new Error(data.message || "Có lỗi xảy ra");
    }
    return data;
  } catch (error) {
    console.error("API Error:", error);
    toast(error.message || "Có lỗi xảy ra");
    return null;
  }
}

// State management
let currentTaskerId = null;
let currentTaskerData = null;
let pendingAction = null;
let currentPage = 1;
let itemsPerPage = 10;
let totalItems = 0;
let bankData = null;

// Load bank data
async function loadBankData() {
  try {
    const response = await fetch("http://localhost:3000/api/momo/bankcodes");
    if (response.ok) {
      bankData = await response.json();
    }
  } catch (error) {
    console.error("Error loading bank data:", error);
  }
}

function getBankName(bankShortName) {
  if (!bankShortName || !bankData) return "—";
  const bank = bankData[bankShortName];
  return bank ? `${bank.shortName} - ${bank.name}` : "—";
}

async function loadTaskers() {
  const tableBody = $("data-table-body");

  tableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-500">Đang tải dữ liệu...</td></tr>`;

  try {
    const accountStatus = $("filterAccountStatus").value;
    const mainStatus = $("filterMainStatus").value;
    const search = $("searchInput").value.trim();

    const params = new URLSearchParams({
      page: currentPage,
      limit: itemsPerPage,
      sort_by: "created_at",
      sort_dir: "desc",
    });

    if (mainStatus) params.append("status", mainStatus);
    if (accountStatus) params.append("account_status", accountStatus);
    if (search) params.append("search", search);

    const response = await fetch(
      `${API_BASE_URL}/taskers/all?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (response.status === 401) {
      localStorage.removeItem("token");
      alert("Phiên đăng nhập hết hạn");
      window.location.href = "../auth/login-signup.html";
      return;
    }

    const result = await response.json();

    if (!result.success || !result.data || result.data.length === 0) {
      tableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-gray-500">Không có dữ liệu</td></tr>`;
      totalItems = 0;
      updatePagination();
      return;
    }

    totalItems = result.total;
    tableBody.innerHTML = "";

    result.data.forEach((tasker) => {
      const user = tasker.user_id || {};
      const account = user.account_id || {};

      const name = user.full_name || account.email || "Không xác định";
      const avatar =
        user.avatar_url || "https://api.dicebear.com/9.x/bottts/svg?seed=Eve";
      const experience = `${tasker.working_year || 0} năm`;
      const rate = formatCurrency(tasker.hourly_rate || 0) + "/giờ";

      const accStatus = account.status || "inactive";
      const workStatus = tasker.working_status || "pending";
      const mainStatus = tasker.status || "pending";

      const accStatusBadge = getStatusBadge(accStatus, "account");
      const workStatusBadge = getStatusBadge(workStatus, "working");
      const mainStatusBadge = getStatusBadge(mainStatus, "main");

      let actionButtons = "";

      if (mainStatus === "pending") {
        actionButtons = `
          <button onclick="openTaskerModal('view', '${tasker._id}')" title="Xem chi tiết" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <span class="material-symbols-outlined">visibility</span>
          </button>
          <button onclick="openTaskerModal('approve', '${tasker._id}')" title="Chấp nhận" class="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
            <span class="material-symbols-outlined">verified</span>
          </button>
          <button onclick="openTaskerModal('reject', '${tasker._id}')" title="Từ chối" class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
            <span class="material-symbols-outlined">verified_off</span>
          </button>
        `;
      } else {
        actionButtons = `
          <button onclick="openTaskerModal('view', '${tasker._id}')" title="Xem chi tiết" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
            <span class="material-symbols-outlined">visibility</span>
          </button>
          <button onclick="openTaskerModal('edit', '${tasker._id}')" title="Sửa" class="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors">
            <span class="material-symbols-outlined">edit</span>
          </button>
        `;
      }

      const tr = document.createElement("tr");
      tr.className =
        "border-b border-gray-50 hover:bg-slate-50 transition-colors";

      tr.innerHTML = `
        <td class="p-4">
          <div class="flex items-center gap-3">
            <img src="${avatar}" alt="${name}" class="w-10 h-10 rounded-full object-cover border border-gray-200" onerror="this.src='https://api.dicebear.com/9.x/bottts/svg?seed=${name}'" />
            <span class="font-medium text-slate-800">${name}</span>
          </div>
        </td>
        <td class="p-4 max-w-[100px] font-medium text-slate-800">${experience}</td>
        <td class="p-4 font-medium text-slate-800">${rate}</td>
        <td class="p-4">${accStatusBadge}</td>
        <td class="p-4">${workStatusBadge}</td>
        <td class="p-4 text-center">
          <div class="flex justify-center space-x-2">
            ${actionButtons}
          </div>
        </td>
      `;

      tableBody.appendChild(tr);
    });

    updatePagination();
  } catch (error) {
    console.error("Error loading taskers:", error);
    toast("Không thể tải danh sách tasker");
    tableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center text-red-500">Lỗi khi tải dữ liệu</td></tr>`;
  }
}

function updatePagination() {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  const startIndex = totalItems > 0 ? (currentPage - 1) * itemsPerPage + 1 : 0;
  const endIndex = Math.min(currentPage * itemsPerPage, totalItems);

  $("paginationInfo").innerHTML =
    `Hiển thị <span class="font-bold">${startIndex}-${endIndex}</span> trên <span class="font-bold">${totalItems}</span> tasker`;

  const buttonsHTML = `
    <button onclick="previousPage()" ${currentPage === 1 ? "disabled" : ""} class="w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed">
      <span class="material-symbols-outlined text-sm">chevron_left</span>
    </button>
    ${Array.from({ length: totalPages }, (_, i) => i + 1)
      .filter(
        (page) =>
          page === 1 ||
          page === totalPages ||
          Math.abs(page - currentPage) <= 1,
      )
      .map(
        (page) => `
        <button onclick="goToPage(${page})" class="w-8 h-8 flex items-center justify-center rounded ${page === currentPage ? "bg-primary-500 text-white" : "border border-gray-200 hover:bg-gray-50 text-gray-600"} font-bold text-sm">
          ${page}
        </button>
      `,
      )
      .join("")}
    <button onclick="nextPage()" ${currentPage === totalPages || totalPages === 0 ? "disabled" : ""} class="w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed">
      <span class="material-symbols-outlined text-sm">chevron_right</span>
    </button>
  `;

  $("paginationButtons").innerHTML = buttonsHTML;
}

function previousPage() {
  if (currentPage > 1) {
    currentPage--;
    loadTaskers();
  }
}

function nextPage() {
  const totalPages = Math.ceil(totalItems / itemsPerPage);
  if (currentPage < totalPages) {
    currentPage++;
    loadTaskers();
  }
}

function goToPage(page) {
  currentPage = page;
  loadTaskers();
}

function clearFilters() {
  $("filterAccountStatus").value = "";
  $("filterMainStatus").value = "";
  $("searchInput").value = "";
  currentPage = 1;
  loadTaskers();
}

async function openTaskerModal(mode, taskerId) {
  currentTaskerId = taskerId;
  pendingAction = null;

  const isViewMode = mode === "view";
  const isEditMode = mode === "edit";
  const isApproveMode = mode === "approve";
  const isRejectMode = mode === "reject";

  // Set modal title
  if (isApproveMode) {
    $("taskerModalTitle").textContent = "Duyệt Tasker";
  } else if (isRejectMode) {
    $("taskerModalTitle").textContent = "Từ chối Tasker";
  } else if (isViewMode) {
    $("taskerModalTitle").textContent = "Chi tiết Tasker";
  } else if (isEditMode) {
    $("taskerModalTitle").textContent = "Sửa thông tin Tasker";
  }

  // Show/hide buttons
  $("btnApproveTasker").classList.add("hidden");
  $("btnRejectTasker").classList.add("hidden");
  $("btnSaveTasker").classList.add("hidden");

  if (isApproveMode) {
    $("btnApproveTasker").classList.remove("hidden");
    pendingAction = "approve";
  } else if (isRejectMode) {
    $("btnRejectTasker").classList.remove("hidden");
    pendingAction = "reject";
  } else if (isEditMode) {
    $("btnSaveTasker").classList.remove("hidden");
  }

  // Enable/disable fields
  const hourlyRateField = $("taskerHourlyRate");
  const accountStatusField = $("taskerAccountStatus");
  const workingStatusField = $("taskerWorkingStatus");

  if (isEditMode) {
    console.log("Enabling fields for edit mode");
    hourlyRateField.disabled = false;
    hourlyRateField.readOnly = false;
    hourlyRateField.classList.remove("bg-gray-100");
    hourlyRateField.classList.add("bg-white");

    accountStatusField.disabled = false;
    accountStatusField.classList.remove("bg-gray-100");
    accountStatusField.classList.add("bg-white");

    workingStatusField.disabled = false;
    workingStatusField.classList.remove("bg-gray-100");
    workingStatusField.classList.add("bg-white");
  } else {
    hourlyRateField.disabled = true;
    hourlyRateField.classList.add("bg-gray-100");
    hourlyRateField.classList.remove("bg-white");

    accountStatusField.disabled = true;
    accountStatusField.classList.add("bg-gray-100");
    accountStatusField.classList.remove("bg-white");

    workingStatusField.disabled = true;
    workingStatusField.classList.add("bg-gray-100");
    workingStatusField.classList.remove("bg-white");
  }

  // Load tasker data
  try {
    const params = new URLSearchParams({ limit: 1000 });
    const response = await fetch(
      `${API_BASE_URL}/taskers/all?${params.toString()}`,
      {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    if (response.status === 401) {
      localStorage.removeItem("token");
      alert("Phiên đăng nhập hết hạn");
      window.location.href = "../auth/login-signup.html";
      return;
    }

    const result = await response.json();

    const taskersList = result.success ? result.data : [];

    if (!taskersList || taskersList.length === 0) {
      toast("Không thể tải thông tin tasker");
      return;
    }

    const tasker = taskersList.find(
      (t) => t._id === taskerId || String(t._id) === String(taskerId),
    );
    if (!tasker) {
      toast("Không tìm thấy tasker");
      return;
    }

    currentTaskerData = tasker;
    const user = tasker.user_id || {};
    const account = user.account_id || {};

    // Fill form
    const avatar =
      user.avatar_url ||
      "https://api.dicebear.com/9.x/bottts/svg?seed=" +
        (user.full_name || "Tasker");
    $("taskerAvatar").src = avatar;
    $("taskerAvatar").onerror = function () {
      this.src = "https://api.dicebear.com/9.x/bottts/svg?seed=Tasker";
    };
    $("taskerFullName").textContent = user.full_name || "—";
    $("taskerEmail").textContent = account.email || "—";
    $("taskerPhone").textContent = user.phone_number || "—";
    $("taskerCCCD").textContent = user.identification || "—";
    $("taskerWorkingYear").value = tasker.working_year || 0;
    $("taskerHourlyRate").value = tasker.hourly_rate || 0;
    $("taskerIntroduction").value = tasker.introduction || "";
    $("taskerAccountStatus").value = account.status || "inactive";
    $("taskerWorkingStatus").value = tasker.working_status || "pending";
    $("taskerMainStatus").innerHTML = getStatusBadge(
      tasker.status || "pending",
      "main",
    );
    $("taskerCompletedOrders").textContent = tasker.total_completed_orders || 0;
    $("taskerBIN").textContent = tasker.BIN || "—";
    $("taskerAccountNumber").textContent = tasker.account_number || "—";
    $("taskerBankName").textContent = getBankName(tasker.bank_shortName);
  } catch (error) {
    console.error("Error loading tasker:", error);
    toast("Không thể tải thông tin tasker");
  }

  openModal("modalTasker");
}

async function saveTasker() {
  if (!currentTaskerId) return;

  const hourlyRate = Number($("taskerHourlyRate").value);
  const accountStatus = $("taskerAccountStatus").value;
  const taskerStatus = $("taskerWorkingStatus").value;

  if (hourlyRate < 0) {
    toast("Thu nhập/giờ không được âm");
    return;
  }

  const body = {
    hourly_rate: hourlyRate,
    account_status: accountStatus,
    tasker_status: taskerStatus,
  };

  const result = await apiCall(
    `/taskers/update/${currentTaskerId}`,
    "PATCH",
    body,
  );
  if (result && result.success !== false) {
    toast("Cập nhật thành công!");
    closeModal("modalTasker");
    await loadTaskers();
  }
}

function approveTasker() {
  if (!currentTaskerId) return;

  $("confirmText").textContent = "Bạn có chắc chắn muốn duyệt Tasker này?";
  $("btnConfirmAction").textContent = "Duyệt";
  $("btnConfirmAction").className =
    "px-4 py-2 bg-green-500 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-green-600 transition";
  pendingAction = "approve";
  closeModal("modalTasker");
  openModal("modalConfirm");
}

function rejectTasker() {
  if (!currentTaskerId) return;

  $("confirmText").textContent = "Bạn có chắc chắn muốn từ chối Tasker này?";
  $("btnConfirmAction").textContent = "Từ chối";
  $("btnConfirmAction").className =
    "px-4 py-2 bg-red-500 text-white text-sm font-semibold rounded-lg shadow-sm hover:bg-red-600 transition";
  pendingAction = "reject";
  closeModal("modalTasker");
  openModal("modalConfirm");
}

async function confirmAction() {
  if (!currentTaskerId || !pendingAction) return;

  let endpoint;
  if (pendingAction === "approve") {
    endpoint = `/taskers/approve/${currentTaskerId}`;
  } else if (pendingAction === "reject") {
    endpoint = `/taskers/reject/${currentTaskerId}`;
  } else {
    return;
  }

  const result = await apiCall(endpoint, "PATCH");
  if (result && result.message) {
    toast(
      pendingAction === "approve" ? "Duyệt thành công!" : "Đã từ chối Tasker!",
    );
    closeModal("modalConfirm");
    await loadTaskers();
  } else if (result) {
    toast(
      pendingAction === "approve" ? "Duyệt thành công!" : "Đã từ chối Tasker!",
    );
    closeModal("modalConfirm");
    await loadTaskers();
  }

  pendingAction = null;
  currentTaskerId = null;
}

// Event listeners
$("filterAccountStatus").addEventListener("change", () => {
  currentPage = 1;
  loadTaskers();
});

$("filterMainStatus").addEventListener("change", () => {
  currentPage = 1;
  loadTaskers();
});

$("searchInput").addEventListener(
  "input",
  debounce(() => {
    currentPage = 1;
    loadTaskers();
  }, 500),
);

function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Expose functions to window
window.openTaskerModal = openTaskerModal;
window.saveTasker = saveTasker;
window.approveTasker = approveTasker;
window.rejectTasker = rejectTasker;
window.confirmAction = confirmAction;
window.closeModal = closeModal;
window.openSidebar = openSidebar;
window.closeSidebar = closeSidebar;
window.previousPage = previousPage;
window.nextPage = nextPage;
window.goToPage = goToPage;
window.clearFilters = clearFilters;

// Load data on page load
document.addEventListener("DOMContentLoaded", async () => {
  await loadBankData();
  await loadTaskers();
});
