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
  alert("Bạn không có quyền truy cập trang này");
  window.location.href = "../auth/login-signup.html";
}

const API_BASE = "http://localhost:3000/api/discount";
const TASK_API_BASE = "http://localhost:3000/api/task";

let currentDiscountId = null;
let deleteDiscountId = null;
let allServices = [];

async function loadServices() {
  try {
    const res = await fetch(`${TASK_API_BASE}/service/all?status=active&task_status=active&limit=100`, {
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
    if (data.success && data.services) {
      allServices = data.services.filter(service => 
        service.status === "active" && 
        service.tasks && 
        service.tasks.length > 0
      );
      renderServicesCheckboxes();
    }
  } catch (err) {
    console.error("Error loading services:", err);
    $("applicableModelContainer").innerHTML = `
      <div class="text-sm text-red-500 text-center py-4">Lỗi khi tải danh sách dịch vụ</div>
    `;
  }
}

function renderServicesCheckboxes() {
  const container = $("applicableModelContainer");
  
  if (!allServices || allServices.length === 0) {
    container.innerHTML = `
      <div class="text-sm text-gray-500 text-center py-4">Không có dịch vụ nào</div>
    `;
    return;
  }

  let html = '<div class="space-y-3">';
  
  allServices.forEach(service => {
    const serviceId = service._id;
    const activeTasks = service.tasks.filter(task => task.status === "active");
    
    if (activeTasks.length === 0) return;
    
    html += `
      <div class="border border-gray-200 rounded-lg p-3 bg-white">
        <label class="flex items-center gap-2 cursor-pointer">
          <input 
            type="checkbox" 
            class="service-checkbox rounded border-gray-300 text-primary-500 focus:ring-primary-500" 
            data-type="service" 
            data-id="${serviceId}"
            onchange="handleServiceCheckboxChange(this, '${serviceId}')"
          />
          <span class="font-semibold text-sm text-gray-800">${service.category_name}</span>
        </label>
        <div class="ml-6 mt-2 space-y-1">
    `;
    
    activeTasks.forEach(task => {
      const taskId = task._id;
      html += `
        <label class="flex items-center gap-2 cursor-pointer text-sm text-gray-600">
          <input 
            type="checkbox" 
            class="task-checkbox rounded border-gray-300 text-primary-500 focus:ring-primary-500" 
            data-type="task" 
            data-id="${taskId}"
            data-service-id="${serviceId}"
            onchange="handleTaskCheckboxChange(this)"
          />
          <span>${task.task_name}</span>
        </label>
      `;
    });
    
    html += `
        </div>
      </div>
    `;
  });
  
  html += '</div>';
  container.innerHTML = html;
}

function handleServiceCheckboxChange(checkbox, serviceId) {
  const isChecked = checkbox.checked;
  const serviceTasks = document.querySelectorAll(`.task-checkbox[data-service-id="${serviceId}"]`);
  
  serviceTasks.forEach(taskCheckbox => {
    taskCheckbox.checked = isChecked;
  });
}

function handleTaskCheckboxChange(checkbox) {
  const serviceId = checkbox.getAttribute("data-service-id");
  const serviceCheckbox = document.querySelector(`.service-checkbox[data-id="${serviceId}"]`);
  const serviceTasks = document.querySelectorAll(`.task-checkbox[data-service-id="${serviceId}"]`);
  const allTasksChecked = Array.from(serviceTasks).every(cb => cb.checked);
  
  if (serviceCheckbox) {
    serviceCheckbox.checked = allTasksChecked;
  }
}

function getSelectedTaskIds() {
  const selected = [];
  
  // Get selected tasks only (not services, as discount uses task_ids)
  document.querySelectorAll(".task-checkbox:checked").forEach(checkbox => {
    selected.push(checkbox.getAttribute("data-id"));
  });
  
  return selected;
}

function setSelectedTaskIds(selectedIds) {
  if (!selectedIds || selectedIds.length === 0) return;
  
  // Uncheck all first
  document.querySelectorAll(".service-checkbox, .task-checkbox").forEach(cb => {
    cb.checked = false;
  });
  
  selectedIds.forEach(id => {
    // Try to find as task
    const taskCheckbox = document.querySelector(`.task-checkbox[data-id="${id}"]`);
    if (taskCheckbox) {
      taskCheckbox.checked = true;
      handleTaskCheckboxChange(taskCheckbox);
    }
  });
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
  toast._t = setTimeout(() => $("toast").classList.add("hidden"), 3000);
}

function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit"
  });
}

function formatDateForInput(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function getStatusBadge(status, is_active) {
  if (is_active && status === "ongoing") {
    return '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">Đang hoạt động</span>';
  }
  if (status === "upcoming") {
    return '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">Sắp diễn ra</span>';
  }
  return '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">Đã kết thúc</span>';
}

function getDiscountDisplay(discount) {
  if (!discount) return "—";
  if (discount.type === "PERCENT") {
    return `${discount.value}%${discount.max_discount ? ` (tối đa ${discount.max_discount.toLocaleString("vi-VN")}đ)` : ""}`;
  }
  return `${discount.value.toLocaleString("vi-VN")}đ`;
}

function getConditionsDisplay(conditions) {
  if (!conditions) return "Tất cả";
  
  const parts = [];
  
  if (conditions.min_order_value) {
    parts.push(`Đơn tối thiểu: ${conditions.min_order_value.toLocaleString("vi-VN")}đ`);
  }
  
  if (conditions.customer_tiers && conditions.customer_tiers.length > 0) {
    parts.push(`Hạng: ${conditions.customer_tiers.join(", ")}`);
  }
  
  if (conditions.days_of_week && conditions.days_of_week.length > 0) {
    const dayNames = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];
    const days = conditions.days_of_week.map(d => dayNames[d] || d).join(", ");
    parts.push(`Ngày: ${days}`);
  }
  
  if (conditions.hours_range) {
    parts.push(`Giờ: ${conditions.hours_range.from}:00 - ${conditions.hours_range.to}:00`);
  }
  
  if (conditions.task_ids && conditions.task_ids.length > 0) {
    parts.push(`${conditions.task_ids.length} dịch vụ`);
  }
  
  return parts.length > 0 ? parts.join(" | ") : "Tất cả";
}

async function loadDiscounts() {
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
    console.log("discounts: ", data);
    const tbody = $("data-table-body");
    
    if (!data.discounts || data.discounts.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="px-4 py-8 text-center text-gray-500">Không có dữ liệu</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = data.discounts.map(discount => {
      const discountDisplay = getDiscountDisplay(discount.discount);
      const conditionsDisplay = getConditionsDisplay(discount.conditions);
      const beginDate = formatDate(discount.begin_date);
      const endDate = formatDate(discount.end_date);
      const statusBadge = getStatusBadge(discount.status, discount.is_active);
      
      return `
        <tr class="border-b border-gray-50 hover:bg-slate-50 transition-colors">
          <td class="p-4 font-medium text-slate-800">${discount.code || ""}</td>
          <td class="p-4 font-medium text-slate-800">${discount.name || ""}</td>
          <td class="p-4">
            <span class="bg-green-100 text-green-700 px-2 py-1 rounded text-sm font-bold">${discountDisplay}</span>
          </td>
          <td class="p-4 text-sm text-slate-600" title="${conditionsDisplay}">
            <div class="truncate max-w-[250px]">${conditionsDisplay}</div>
          </td>
          <td class="p-4 text-sm text-slate-500">
            <div>Bắt đầu: ${beginDate}</div>
            <div>Kết thúc: ${endDate}</div>
          </td>
          <td class="p-4">${statusBadge}</td>
          <td class="p-4 text-center">
            <div class="flex justify-center space-x-2">
              <button title="Xem chi tiết" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" onclick="openDiscountModal('view', '${discount._id}')">
                <span class="material-symbols-outlined">visibility</span>
              </button>
              <button title="Sửa" class="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors" onclick="openDiscountModal('edit', '${discount._id}')">
                <span class="material-symbols-outlined">edit</span>
              </button>
              <button title="Xóa" class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" onclick="askDeleteDiscount('${discount._id}', '${discount.code || discount.name || ""}')">
                <span class="material-symbols-outlined">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    console.error("Error loading discounts:", err);
    toast("Không thể tải danh sách khuyến mãi");
  }
}

async function openDiscountModal(mode, id) {
  currentDiscountId = id || null;
  const isViewMode = mode === "view";
  const isEditMode = mode === "edit";
  
  $("discountModalTitle").textContent = 
    mode === "add" ? "Thêm khuyến mãi" : 
    mode === "view" ? "Chi tiết khuyến mãi" : 
    "Sửa khuyến mãi";

  // Disable/enable fields based on mode
  const fields = ["discountCode", "discountName", "discountDescription", "discountBeginDate", 
    "discountEndDate", "discountPriority", "discountType", "discountValue", "maxDiscount", 
    "minOrderValue", "hoursFrom", "hoursTo"];
  
  fields.forEach(fieldId => {
    const field = $(fieldId);
    if (field) {
      field.disabled = isViewMode;
      if (isViewMode) {
        field.classList.add("bg-gray-100");
      } else {
        field.classList.remove("bg-gray-100");
      }
    }
  });

  // Disable checkboxes
  setTimeout(() => {
    const checkboxes = document.querySelectorAll(".service-checkbox, .task-checkbox, .tier-checkbox, .day-checkbox");
    checkboxes.forEach(cb => {
      cb.disabled = isViewMode;
      if (isViewMode) {
        cb.parentElement.style.opacity = "0.6";
        cb.parentElement.style.cursor = "not-allowed";
      } else {
        cb.parentElement.style.opacity = "1";
        cb.parentElement.style.cursor = "pointer";
      }
    });
  }, 150);

  $("btnSaveDiscount").style.display = isViewMode ? "none" : "block";

  // Load services first
  await loadServices();

  if (isEditMode || isViewMode) {
    // Load discount data
    fetch(`${API_BASE}/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.data) {
          const d = data.data;
          $("discountCode").value = d.code || "";
          $("discountName").value = d.name || "";
          $("discountDescription").value = d.description || "";
          $("discountBeginDate").value = formatDateForInput(d.begin_date);
          $("discountEndDate").value = formatDateForInput(d.end_date);
          $("discountPriority").value = d.priority || 1;
          $("discountType").value = d.discount?.type || "PERCENT";
          $("discountValue").value = d.discount?.value || "";
          $("maxDiscount").value = d.discount?.max_discount || "";
          $("minOrderValue").value = d.conditions?.min_order_value || "";
          $("hoursFrom").value = d.conditions?.hours_range?.from || "";
          $("hoursTo").value = d.conditions?.hours_range?.to || "";
          
          // Set customer tiers
          const tiers = d.conditions?.customer_tiers || [];
          $("tierNew").checked = tiers.includes("NEW");
          $("tierLoyal").checked = tiers.includes("LOYAL");
          $("tierVip").checked = tiers.includes("VIP");
          
          // Set days of week
          const days = d.conditions?.days_of_week || [];
          document.querySelectorAll(".day-checkbox").forEach(cb => {
            cb.checked = days.includes(Number(cb.value));
          });
          
          // Set task IDs
          setSelectedTaskIds(d.conditions?.task_ids || []);
          updateMaxDiscountVisibility();
        }
      })
      .catch(err => {
        console.error("Error loading discount:", err);
        toast("Không thể tải thông tin khuyến mãi");
      });
  } else {
    // Reset form for add mode
    $("discountCode").value = "";
    $("discountName").value = "";
    $("discountDescription").value = "";
    $("discountBeginDate").value = "";
    $("discountEndDate").value = "";
    $("discountPriority").value = "1";
    $("discountType").value = "PERCENT";
    $("discountValue").value = "";
    $("maxDiscount").value = "";
    $("minOrderValue").value = "";
    $("hoursFrom").value = "";
    $("hoursTo").value = "";
    
    // Reset checkboxes
    $("tierNew").checked = false;
    $("tierLoyal").checked = false;
    $("tierVip").checked = false;
    document.querySelectorAll(".day-checkbox").forEach(cb => cb.checked = false);
    setSelectedTaskIds([]);
    updateMaxDiscountVisibility();
  }

  openModal("modalDiscount");
}

function updateMaxDiscountVisibility() {
  const discountType = $("discountType").value;
  const maxDiscountContainer = $("maxDiscountContainer");
  if (discountType === "PERCENT") {
    maxDiscountContainer.style.display = "block";
  } else {
    maxDiscountContainer.style.display = "none";
  }
}

async function saveDiscount() {
  const code = $("discountCode").value.trim().toUpperCase();
  const name = $("discountName").value.trim();
  const description = $("discountDescription").value.trim();
  const begin_date = $("discountBeginDate").value;
  const end_date = $("discountEndDate").value;
  const priority = Number($("discountPriority").value) || 1;
  const discountType = $("discountType").value;
  const discountValue = Number($("discountValue").value);
  const maxDiscount = $("maxDiscount").value ? Number($("maxDiscount").value) : undefined;
  const min_order_value = $("minOrderValue").value ? Number($("minOrderValue").value) : undefined;
  const hoursFrom = $("hoursFrom").value ? Number($("hoursFrom").value) : undefined;
  const hoursTo = $("hoursTo").value ? Number($("hoursTo").value) : undefined;
  const taskIds = getSelectedTaskIds();

  // Get customer tiers
  const customerTiers = [];
  if ($("tierNew").checked) customerTiers.push("NEW");
  if ($("tierLoyal").checked) customerTiers.push("LOYAL");
  if ($("tierVip").checked) customerTiers.push("VIP");

  // Get days of week
  const daysOfWeek = [];
  document.querySelectorAll(".day-checkbox:checked").forEach(cb => {
    daysOfWeek.push(Number(cb.value));
  });

  // Validation
  if (!code || !name || !begin_date || !end_date) {
    toast("Vui lòng điền đầy đủ thông tin bắt buộc");
    return;
  }

  if (!discountValue || discountValue <= 0) {
    toast("Giá trị giảm giá phải lớn hơn 0");
    return;
  }

  if (discountType === "PERCENT" && discountValue > 100) {
    toast("Phần trăm giảm giá không được vượt quá 100%");
    return;
  }

  if (discountType === "PERCENT" && (!maxDiscount || maxDiscount <= 0)) {
    toast("Vui lòng nhập số tiền giảm tối đa cho khuyến mãi phần trăm");
    return;
  }

  if (hoursFrom !== undefined && hoursTo !== undefined) {
    if (hoursFrom < 0 || hoursFrom > 23 || hoursTo < 0 || hoursTo > 23) {
      toast("Giờ phải nằm trong khoảng 0-23");
      return;
    }
    if (hoursFrom > hoursTo) {
      toast("Giờ bắt đầu phải nhỏ hơn hoặc bằng giờ kết thúc");
      return;
    }
  }

  const discount = {
    type: discountType,
    value: discountValue
  };
  if (discountType === "PERCENT" && maxDiscount) {
    discount.max_discount = maxDiscount;
  }

  const conditions = {};
  if (min_order_value !== undefined && min_order_value > 0) {
    conditions.min_order_value = min_order_value;
  }
  if (customerTiers.length > 0) {
    conditions.customer_tiers = customerTiers;
  }
  if (daysOfWeek.length > 0) {
    conditions.days_of_week = daysOfWeek;
  }
  if (hoursFrom !== undefined && hoursTo !== undefined) {
    conditions.hours_range = { from: hoursFrom, to: hoursTo };
  }
  if (taskIds.length > 0) {
    conditions.task_ids = taskIds;
  }

  const payload = {
    code,
    name,
    description,
    begin_date,
    end_date,
    priority,
    discount,
    conditions: Object.keys(conditions).length > 0 ? conditions : undefined
  };

  try {
    let res;
    if (currentDiscountId) {
      // Update
      res = await fetch(`${API_BASE}/${currentDiscountId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
    } else {
      // Create
      res = await fetch(`${API_BASE}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
    }

    const data = await res.json();
    if (res.ok && data.success) {
      toast(currentDiscountId ? "Đã cập nhật khuyến mãi" : "Đã tạo khuyến mãi");
      closeModal("modalDiscount");
      await loadDiscounts();
    } else {
      toast(data.message || "Thất bại");
    }
  } catch (err) {
    console.error("Error saving discount:", err);
    toast("Có lỗi xảy ra khi lưu khuyến mãi");
  }
}

function askDeleteDiscount(id, code) {
  deleteDiscountId = id;
  $("confirmText").textContent = `Xóa khuyến mãi "${code}"?`;
  openModal("modalConfirm");
}

async function confirmDeleteDiscount() {
  if (!deleteDiscountId) return;

  try {
    const res = await fetch(`${API_BASE}/${deleteDiscountId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (res.ok && data.success) {
      toast("Đã xóa khuyến mãi");
      closeModal("modalConfirm");
      await loadDiscounts();
    } else {
      toast(data.message || "Xóa khuyến mãi thất bại");
    }
  } catch (err) {
    console.error("Error deleting discount:", err);
    toast("Có lỗi xảy ra khi xóa khuyến mãi");
  } finally {
    deleteDiscountId = null;
  }
}

// Event listeners
$("discountType").addEventListener("change", updateMaxDiscountVisibility);

// Expose functions to window
window.openDiscountModal = openDiscountModal;
window.askDeleteDiscount = askDeleteDiscount;
window.confirmDeleteDiscount = confirmDeleteDiscount;
window.saveDiscount = saveDiscount;
window.closeModal = closeModal;
window.openSidebar = openSidebar;
window.closeSidebar = closeSidebar;
window.handleServiceCheckboxChange = handleServiceCheckboxChange;
window.handleTaskCheckboxChange = handleTaskCheckboxChange;

// Load services and discounts on page load
loadServices().then(() => {
  loadDiscounts();
});
