const sidebarMobile = document.getElementById("sidebarMobile");
const backdrop = document.getElementById("backdrop");

function openSidebar() {
  sidebarMobile.classList.remove("closed");
  backdrop.classList.add("show");
}

function closeSidebar() {
  sidebarMobile.classList.add("closed");
  backdrop.classList.remove("show");
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

let currentVoucherId = null;
let deleteVoucherId = null;
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

function getSelectedApplicableModels() {
  const selected = [];
  
  // Get selected services
  document.querySelectorAll(".service-checkbox:checked").forEach(checkbox => {
    selected.push(checkbox.getAttribute("data-id"));
  });
  
  // Get selected tasks
  document.querySelectorAll(".task-checkbox:checked").forEach(checkbox => {
    const serviceId = checkbox.getAttribute("data-service-id");
    const serviceCheckbox = document.querySelector(`.service-checkbox[data-id="${serviceId}"]`);
    
    // Only add task if its service is not already selected
    if (!serviceCheckbox || !serviceCheckbox.checked) {
      selected.push(checkbox.getAttribute("data-id"));
    }
  });
  
  return selected;
}

function setSelectedApplicableModels(selectedIds) {
  if (!selectedIds || selectedIds.length === 0) return;
  
  // Uncheck all first
  document.querySelectorAll(".service-checkbox, .task-checkbox").forEach(cb => {
    cb.checked = false;
  });
  
  selectedIds.forEach(id => {
    // Try to find as service
    const serviceCheckbox = document.querySelector(`.service-checkbox[data-id="${id}"]`);
    if (serviceCheckbox) {
      serviceCheckbox.checked = true;
      handleServiceCheckboxChange(serviceCheckbox, id);
      return;
    }
    
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

function getStatusBadge(status) {
  const statusMap = {
    upcoming: '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-yellow-100 text-yellow-700 border border-yellow-200">Sắp diễn ra</span>',
    ongoing: '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-green-100 text-green-700 border border-green-200">Đang hoạt động</span>',
    finished: '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">Đã kết thúc</span>'
  };
  return statusMap[status] || statusMap.finished;
}

function getDiscountDisplay(discount) {
  if (!discount) return "—";
  if (discount.type === "PERCENT") {
    return `${discount.value}%${discount.max_discount ? ` (tối đa ${discount.max_discount.toLocaleString("vi-VN")}đ)` : ""}`;
  }
  return `${discount.value.toLocaleString("vi-VN")}đ`;
}

function getApplicableDisplay(applicable_model) {
  if (!applicable_model || applicable_model.length === 0) {
    return "Tất cả dịch vụ";
  }
  
  // Try to find service/task names from allServices
  const names = [];
  applicable_model.forEach(id => {
    // Check if it's a service
    const service = allServices.find(s => s._id === id);
    if (service) {
      names.push(service.category_name);
      return;
    }
    
    // Check if it's a task
    for (const s of allServices) {
      const task = s.tasks?.find(t => t._id === id);
      if (task) {
        names.push(`${s.category_name} - ${task.task_name}`);
        return;
      }
    }
    
    // Fallback to ID if not found
    names.push(id);
  });
  
  return names.length > 0 ? names.join(", ") : applicable_model.join(", ");
}

async function loadVouchers() {
  try {
    const res = await fetch(`${API_BASE}/voucher/all`, {
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
    console.log("vouchers: ", data);
    const tbody = $("data-table-body");
    
    if (!data.data || data.data.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="6" class="px-4 py-8 text-center text-gray-500">Không có dữ liệu</td>
        </tr>
      `;
      return;
    }

    tbody.innerHTML = data.data.map(voucher => {
      const discountDisplay = getDiscountDisplay(voucher.discount);
      const applicableDisplay = getApplicableDisplay(voucher.applicable_model);
      const beginDate = formatDate(voucher.begin_date);
      const endDate = formatDate(voucher.end_date);
      const statusBadge = getStatusBadge(voucher.status);
      
      return `
        <tr class="border-b border-gray-50 hover:bg-slate-50 transition-colors">
          <td class="p-4 font-medium text-slate-800">${voucher.code || ""}</td>
          <td class="p-4 text-slate-600 text-sm truncate max-w-[200px]" title="${voucher.description || ""}">
            ${voucher.description || voucher.name || ""}
          </td>
          <td class="p-4">
            <span class="bg-green-100 text-green-700 px-2 py-1 rounded text-sm font-bold">${discountDisplay}</span>
          </td>
          <td class="p-4 text-sm text-slate-600">${applicableDisplay}</td>
          <td class="p-4 text-sm text-slate-500">
            <div>Bắt đầu: ${beginDate}</div>
            <div>Kết thúc: ${endDate}</div>
          </td>
          <td class="p-4 text-center">
            <div class="flex justify-center space-x-2">
              <button title="Xem chi tiết" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors" onclick="openVoucherModal('view', '${voucher._id}')">
                <span class="material-symbols-outlined">visibility</span>
              </button>
              <button title="Sửa" class="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors" onclick="openVoucherModal('edit', '${voucher._id}')">
                <span class="material-symbols-outlined">edit</span>
              </button>
              <button title="Xóa" class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors" onclick="askDeleteVoucher('${voucher._id}', '${voucher.code || ""}')">
                <span class="material-symbols-outlined">delete</span>
              </button>
            </div>
          </td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    console.error("Error loading vouchers:", err);
    toast("Không thể tải danh sách voucher");
  }
}

async function openVoucherModal(mode, id) {
  currentVoucherId = id || null;
  const isViewMode = mode === "view";
  const isEditMode = mode === "edit";
  
  $("voucherModalTitle").textContent = 
    mode === "add" ? "Thêm voucher" : 
    mode === "view" ? "Chi tiết voucher" : 
    "Sửa voucher";

  // Disable/enable fields based on mode
  const fields = ["voucherCode", "voucherName", "voucherDescription", "voucherBeginDate", 
    "voucherEndDate", "discountType", "discountValue", "maxDiscount", "totalQuantity", 
    "perUserLimit", "ruleType", "minOrderValue", "applicableModel"];
  
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

  $("btnSaveVoucher").style.display = isViewMode ? "none" : "block";

  // Load services first
  await loadServices();

  // Enable/disable checkboxes based on mode
  setTimeout(() => {
    const checkboxes = document.querySelectorAll(".service-checkbox, .task-checkbox");
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

  if (isEditMode || isViewMode) {
    // Load voucher data
    fetch(`${API_BASE}/voucher/${id}`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    })
      .then(res => res.json())
      .then(data => {
        if (data.success && data.voucher) {
          const v = data.voucher;
          $("voucherCode").value = v.code || "";
          $("voucherName").value = v.name || "";
          $("voucherDescription").value = v.description || "";
          $("voucherBeginDate").value = formatDateForInput(v.begin_date);
          $("voucherEndDate").value = formatDateForInput(v.end_date);
          $("discountType").value = v.discount?.type || "PERCENT";
          $("discountValue").value = v.discount?.value || "";
          $("maxDiscount").value = v.discount?.max_discount || "";
          $("totalQuantity").value = v.total_quantity || "";
          $("perUserLimit").value = v.per_user_limit || "1";
          $("ruleType").value = v.conditions?.rule_type || "GENERAL";
          $("minOrderValue").value = v.conditions?.min_order_value || "0";
          //$("applicableModel").value = Array.isArray(v.applicable_model) ? v.applicable_model.join(", ") : "";
          
          setSelectedApplicableModels(v.applicable_model || []);
          updateMaxDiscountVisibility();
        }
      })
      .catch(err => {
        console.error("Error loading voucher:", err);
        toast("Không thể tải thông tin voucher");
      });
  } else {
    // Reset form for add mode
    $("voucherCode").value = "";
    $("voucherName").value = "";
    $("voucherDescription").value = "";
    $("voucherBeginDate").value = "";
    $("voucherEndDate").value = "";
    $("discountType").value = "PERCENT";
    $("discountValue").value = "";
    $("maxDiscount").value = "";
    $("totalQuantity").value = "";
    $("perUserLimit").value = "1";
    $("ruleType").value = "GENERAL";
    $("minOrderValue").value = "0";
    //$("applicableModel").value = "";

    //setSelectedApplicableModels(v.applicable_model || []);
    updateMaxDiscountVisibility();
  }

  openModal("modalVoucher");
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

async function saveVoucher() {
  const code = $("voucherCode").value.trim().toUpperCase();
  const name = $("voucherName").value.trim();
  const description = $("voucherDescription").value.trim();
  const begin_date = $("voucherBeginDate").value;
  const end_date = $("voucherEndDate").value;
  const discountType = $("discountType").value;
  const discountValue = Number($("discountValue").value);
  const maxDiscount = $("maxDiscount").value ? Number($("maxDiscount").value) : undefined;
  const total_quantity = Number($("totalQuantity").value);
  const per_user_limit = Number($("perUserLimit").value);
  const rule_type = $("ruleType").value;
  const min_order_value = Number($("minOrderValue").value) || 0;
  const applicableModel = getSelectedApplicableModels();

  // Validation
  if (!code || !name || !description || !begin_date || !end_date) {
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
    toast("Vui lòng nhập số tiền giảm tối đa cho voucher phần trăm");
    return;
  }

  if (!total_quantity || total_quantity < 1) {
    toast("Tổng số lượng voucher phải lớn hơn 0");
    return;
  }

  if (!per_user_limit || per_user_limit < 1) {
    toast("Giới hạn mỗi người phải lớn hơn 0");
    return;
  }

  const discount = {
    type: discountType,
    value: discountValue
  };
  if (discountType === "PERCENT" && maxDiscount) {
    discount.max_discount = maxDiscount;
  }

  const conditions = {
    rule_type: rule_type,
    min_order_value: min_order_value
  };

  const applicable_model = applicableModel.length > 0
    ? applicableModel
    : [];

  const payload = {
    code,
    name,
    description,
    begin_date,
    end_date,
    discount,
    total_quantity,
    per_user_limit,
    conditions,
    applicable_model: applicable_model.length > 0 ? applicable_model : undefined
  };

  try {
    let res;
    if (currentVoucherId) {
      // Update
      res = await fetch(`${API_BASE}/voucher/${currentVoucherId}`, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });
    } else {
      // Create
      res = await fetch(`${API_BASE}/voucher`, {
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
      toast(currentVoucherId ? "Đã cập nhật voucher" : "Đã tạo voucher");
      closeModal("modalVoucher");
      await loadVouchers();
    } else {
      toast(data.message || "Thất bại");
    }
  } catch (err) {
    console.error("Error saving voucher:", err);
    toast("Có lỗi xảy ra khi lưu voucher");
  }
}

function askDeleteVoucher(id, code) {
  deleteVoucherId = id;
  $("confirmText").textContent = `Xóa voucher "${code}"?`;
  openModal("modalConfirm");
}

async function confirmDeleteVoucher() {
  if (!deleteVoucherId) return;

  try {
    const res = await fetch(`${API_BASE}/voucher/${deleteVoucherId}`, {
      method: "DELETE",
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    const data = await res.json();
    if (res.ok && data.success) {
      toast("Đã xóa voucher");
      closeModal("modalConfirm");
      await loadVouchers();
    } else {
      toast(data.message || "Xóa voucher thất bại");
    }
  } catch (err) {
    console.error("Error deleting voucher:", err);
    toast("Có lỗi xảy ra khi xóa voucher");
  } finally {
    deleteVoucherId = null;
  }
}

// Event listeners
$("discountType").addEventListener("change", updateMaxDiscountVisibility);

// Expose functions to window
window.openVoucherModal = openVoucherModal;
window.askDeleteVoucher = askDeleteVoucher;
window.confirmDeleteVoucher = confirmDeleteVoucher;
window.saveVoucher = saveVoucher;
window.closeModal = closeModal;
window.openSidebar = openSidebar;
window.closeSidebar = closeSidebar;
window.handleServiceCheckboxChange = handleServiceCheckboxChange;
window.handleTaskCheckboxChange = handleTaskCheckboxChange;

// Load services and vouchers on page load
loadServices().then(() => {
  loadVouchers();
});
