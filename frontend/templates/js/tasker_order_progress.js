const token = localStorage.getItem("token");
const role = localStorage.getItem("system_role");
const taskerUserId = localStorage.getItem("user_id");

if (!token) {
  alert("Vui lòng đăng nhập");
  location.href = "../auth/login-signup.html";
}

if (role !== "tasker") {
  alert("Bạn không phải là Tasker. Vui lòng đăng nhập lại.");
  location.href = "../auth/login-signup.html";
}

// Get order ID from URL or localStorage
const urlParams = new URLSearchParams(window.location.search);
let orderId = urlParams.get("orderId") || localStorage.getItem("currentOrderId");
// If still no orderId, try to get from pathname (e.g., /tasker/order/12345)
if (!orderId) {
  const pathMatch = window.location.pathname.match(/order[\/\-_]?(\w+)/i);
  if (pathMatch) {
    orderId = pathMatch[1];
  }
}

if (!orderId) {
  alert("Không tìm thấy đơn hàng");
  location.href = "./tasker_home.html";
}

// Store orderId for reference
localStorage.setItem("currentOrderId", orderId);

let currentOrder = null;
let currentState = -1; // -1 = not loaded, 0 = assigned, 1 = accepted, 2 = departed, 3 = arrived, 4 = in_progress, 5 = completed

const btnText = document.getElementById('btn-text');
const mainBtn = document.getElementById('main-action-btn');
const btnIcon = document.getElementById('btn-icon');
const cancelBtn = document.getElementById('cancel-btn');

// Status to state mapping
const statusToState = {
  "assigned": 0,
  "accepted": 1,
  "departed": 2,
  "arrived": 3,
  "in_progress": 4,
  "completed": 5
};

// State to step mapping
const stateToStep = {
  0: "step-0", // Accept step (new) - for assigned status
  1: "step-1", // Depart step - for accepted status
  2: "step-1", // Already departed - for departed status
  3: "step-2", // Arrive step - for arrived status
  4: "step-3", // Start step - for in_progress status
  5: "step-4"  // Complete step - for completed status
};

// Format currency
function formatCurrency(v) {
  return Number(v || 0).toLocaleString("vi-VN") + "đ";
}

// Format currency with VND
const formatCurrencyVND = (v) => Number(v || 0).toLocaleString("vi-VN") + " VND";

// Service renderers (from ordering_success.js)
const serviceRenderers = {
  COOKING: (p) => `
    <p>👥 Nấu cho: ${p.people} người</p>
    <p>🍽️ Số món: ${p.dishes}</p>
    <p>⏱️ Thời gian làm việc: ${Math.floor(p.total_time / 60)}h ${p.total_time % 60}p</p>
    ${p.has_dessert ? "<p>🍎 Có tráng miệng</p>" : ""}
    ${p.do_grocery ? "<p>🛒 Có đi chợ</p>" : ""}
  `,

  CLEANING: (p) => `
    <p>🏠 Diện tích: ${p.area} m²</p>
    <p>🧹 Loại hình: ${p.cleaning_type}</p>
    <p>👥 Nhân viên: ${p.staff_count}</p>
    <p>⏱️ Thời gian: ${p.total_time} giờ</p>
  `,

  GROCERY: (p) => `
    <p>🛒 Tổng số sản phẩm: <strong>${p.items?.length || 0}</strong></p>
    <div class="mt-2 space-y-1">
      ${(p.items || []).map(item => `
        <p>🧺 ${item.name} - <span>${item.quantity} ${item.unit}</span></p>
      `).join("")}
    </div>
    ${p.estimated_budget
      ? `<p class="mt-2">💰 Ngân sách ước tính: ${Number(p.estimated_budget).toLocaleString()}đ</p>`
      : ""
    }
    <p><strong>Lưu ý tổng tiền cần thanh toán sẽ là tổng phí dịch vụ + số tiền ước tính</strong></p>
  `,

  HOUSE_CLEANING: (p) => {
    const extrasArr = p.extras ? Object.values(p.extras) : [];

    return `
      <div class="space-y-1">
        <p>⏱️ Thời gian combo dọn dẹp gốc: 
          <strong>${p.base_time} giờ</strong>
        </p>
        ${
          p.total_time && p.total_time > p.base_time
            ? `<p>⏱️ Thời gian thực hiện tổng: 
                <strong>${p.total_time} giờ</strong>
              </p>`
            : ""
        }
        ${
          p.house_type
            ? `<p>🏠 Loại nhà: 
                <strong>${p.house_type}</strong>
              </p>`
            : ""
        }
        ${
          extrasArr.length
            ? `
              <div class="mt-2">
                <p>🧩 Dịch vụ thêm:</p>
                <ul class="ml-4 list-disc space-y-1">
                  ${extrasArr.map(e => `
                    <span class="pl-30 text-m text-dark-300">${e.name}
                        (+${Number(e.price).toLocaleString()}đ/giờ)
                      </span>
                  `).join("")}
                </ul>
              </div>
            `
            : `<p>🧩 Dịch vụ thêm: <span class="text-gray-500">Không có</span></p>`
        }
      </div>
    `;
  },

  CHILDCARE: (p) => `
    <p>👶 Số lượng trẻ: ${p.child_count} bé</p>
    <p>⏱️ Thời gian làm việc: ${Math.floor(p.total_time / 60)}h ${p.total_time % 60}p</p>
    <p>📋 Độ tuổi các bé:</p>
    <ul class="pl-5 list-disc">
      ${(p.child_ages || [])
        .map(
          (age, index) =>
            `<li>🧒 Bé ${index + 1}: ${
              age === "1-6" ? "12 tháng – 6 tuổi" : "7 – 11 tuổi"
            }</li>`
        )
        .join("")}
    </ul>
  `,

  ELDERLY: (p) => `
    <p>⏱️ Thời gian làm việc: ${Math.floor(p.total_time / 60)}h ${p.total_time % 60}p</p>
    <p class="mt-2 font-semibold">🧾 Tổng cộng: ${(p.final_amount || 0).toLocaleString()}đ</p>
  `,

  SICK: (p) => `
    <p>⏱️ Thời gian làm việc: ${Math.floor(p.total_time / 60)}h ${p.total_time % 60}p</p>
    <p class="mt-2 font-semibold">🧾 Tổng cộng: ${(p.final_amount || 0).toLocaleString()}đ</p>
  `,

  AIRCONDITIONER: (p) => `
    ${(p.devices || []).map((d, i) => `
      <div class="ml-3 mt-2">
        <p>🔧 <strong>Thiết bị ${i + 1}: ${d.label}</strong></p>
        <p>⚡ Công suất: ${d.hp === "below_2" ? "Dưới 2 HP" : "Từ 2 HP trở lên"}</p>
        <p>🛢️ Bơm gas: ${d.has_gas ? "Có" : "Không"}</p>
        <p>💰 Giá: ${(d.amount || 0).toLocaleString()}đ</p>
      </div>
    `).join("")}

    <p class="mt-2 font-semibold">🧾 Tổng cộng: ${(p.final_amount || 0).toLocaleString()}đ</p>
  `,

  WASHING_MACHINE: (p) => `
    ${(p.devices || []).map((d, i) => `
      <div class="ml-3 mt-2">
        <p>🔧 <strong>Thiết bị ${i + 1}: ${d.label}</strong></p>
        <p>⚡ Khối lượng lồng giặt: ${d.capacity === "below_9" ? "Dưới 9 Kg" : "Từ 9 Kg trở lên"}</p>
        <p>🛢️ Tháo lồng giặt: ${d.remove ? "Có" : "Không"}</p>
        <p>💰 Giá: ${(d.amount || 0).toLocaleString()}đ</p>
      </div>
    `).join("")}

    <p class="mt-2 font-semibold">🧾 Tổng cộng: ${(p.final_amount || 0).toLocaleString()}đ</p>
  `,

  DEFAULT: () =>
    `<p class="text-gray-400">Không có chi tiết dịch vụ</p>`
};

function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function formatTimeOnly(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Format date time
function formatDateTime(dateString) {
  if (!dateString) return "—";
  const date = new Date(dateString);
  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  }).replace(",", " -");
}

// Format time from status log
function formatTime(dateString) {
  if (!dateString) return "--:--";
  const date = new Date(dateString);
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

// Fetch order details
async function fetchOrderDetails() {
  try {
    const res = await fetch(
      `http://localhost:3000/api/tasker/order/${orderId}`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (res.status === 401) {
      localStorage.removeItem("token");
      alert("Phiên đăng nhập hết hạn");
      location.href = "../auth/login-signup.html";
      return null;
    }

    const result = await res.json();
    if (result.success) {
      return result;
    }
    return null;
  } catch (error) {
    console.error("Error fetching order details:", error);
    return null;
  }
}

// Render service details
function renderServiceDetails(order) {
  const el = document.getElementById("serviceDetails");
  if (!el || !order) return;

  const serviceCode = order.task_snapshot?.code || "DEFAULT";
  const renderer = serviceRenderers[serviceCode] || serviceRenderers.DEFAULT;
  const payload = order.task_payload || {};

  const scheduledInfo = order.scheduled_at && order.type === "scheduled"
    ? `<div class="bg-blue-50 p-3 rounded-lg mt-3 border border-blue-200">
        <p class="text-sm font-semibold text-blue-700 flex items-center">
          <span class="material-symbols-outlined text-sm mr-1">schedule</span>
          Đã lên lịch
        </p>
        <p class="text-sm text-blue-600 mt-1">
          ${formatDate(order.scheduled_at)} lúc ${formatTimeOnly(order.scheduled_at)}
        </p>
      </div>`
    : `<div class="bg-orange-50 p-3 rounded-lg mt-3 border border-orange-200">
        <p class="text-sm font-semibold text-orange-700 flex items-center">
          <span class="material-symbols-outlined text-sm mr-1">bolt</span>
          Ngay lập tức
        </p>
      </div>`;

  el.innerHTML = `
    <div class="space-y-2">
      <h4 class="font-bold text-dark-900 text-lg mb-2">
        ${order.task_snapshot?.name || "Dịch vụ"}
      </h4>
      <div class="text-base text-dark-500 space-y-1">
        ${renderer(payload)}
      </div>
      ${scheduledInfo}
    </div>
  `;
}

// Render address details
function renderAddressDetails(order) {
  const el = document.getElementById("addressDetails");
  if (!el || !order) return;

  const address = order.address_snapshot;
  if (!address || !address.full_address) {
    el.innerHTML = `<p class="text-gray-500">Không có thông tin địa chỉ</p>`;
    return;
  }

  el.innerHTML = `
    <div class="space-y-1">
      <p class="text-base text-dark-900">
        <span class="material-symbols-outlined align-middle text-primary-500">location_on</span>
        ${address.full_address}
      </p>
    </div>
  `;
}

// Render payment details
function renderPaymentDetails(order, receipt) {
  const el = document.getElementById("paymentDetails");
  if (!el || !order) return;

  const paymentMap = {
    cash: "Tiền mặt",
    credit_card: "Thẻ tín dụng",
    bank_transfer: "Chuyển khoản",
    ewallet: "Ví TaskGo"
  };

  const paymentMethod = receipt?.payment_method 
    ? paymentMap[receipt.payment_method] || receipt.payment_method
    : "Chưa thanh toán";

  const paymentDate = receipt?.created_at 
    ? formatDate(receipt.created_at)
    : "—";

  const paymentTime = receipt?.created_at
    ? formatTimeOnly(receipt.created_at)
    : "—";

  el.innerHTML = `
    <div class="space-y-3">
      <div class="flex justify-between items-center">
        <span class="text-gray-600">Tổng tiền dịch vụ</span>
        <span class="font-semibold text-dark-900">${formatCurrencyVND(order.base_amount || order.final_amount)}</span>
      </div>
      ${
        order.voucher_snapshot
          ? `<div class="flex justify-between items-center">
              <span class="text-gray-600">Mã giảm giá</span>
              <span class="font-semibold text-green-600">-${formatCurrencyVND(order.voucher_snapshot.discount_amount || 0)}</span>
            </div>`
          : ""
      }
      <div class="border-t border-gray-300 pt-3 flex justify-between items-center">
        <span class="font-bold text-dark-900 text-lg">Tổng tiền</span>
        <span class="font-bold text-primary-500 text-xl">${formatCurrencyVND(order.final_amount)}</span>
      </div>
      <div class="flex justify-between items-center text-sm text-gray-600 pt-2">
        <span>Phương thức thanh toán</span>
        <span>${paymentMethod}</span>
      </div>
      <div class="flex justify-between items-center text-sm text-gray-600">
        <span>Ngày thanh toán</span>
        <span>${paymentDate}</span>
      </div>
      <div class="flex justify-between items-center text-sm text-gray-600">
        <span>Giờ thanh toán</span>
        <span>${paymentTime}</span>
      </div>
    </div>
  `;
}

// Update order information in UI
function updateOrderInfo(order, receipt) {
  // Update customer info
  if (order.customer_id) {
    const customerName = order.customer_id.full_name || "Khách hàng";
    const customerPhone = order.customer_id.phone_number || "";
    const maskedPhone = customerPhone ? customerPhone.slice(0, 4) + " *** " + customerPhone.slice(-3) : "";

    const customerNameEl = document.getElementById('customerName');
    if (customerNameEl) {
      customerNameEl.textContent = customerName;
    }

    const customerPhoneEl = document.getElementById('customerPhone');
    if (customerPhoneEl) {
      customerPhoneEl.textContent = maskedPhone;
    }

    // Update avatar
    const avatarImg = document.getElementById('customerAvatar');
    if (avatarImg) {
      avatarImg.src = `https://ui-avatars.com/api/?name=${encodeURIComponent(customerName)}&background=A5B4FC&color=3730A3`;
    }

    // Update phone links
    const phoneLink = document.getElementById('phoneLink');
    if (phoneLink && customerPhone) {
      phoneLink.href = `tel:${customerPhone}`;
    }
    const headerPhoneLink = document.getElementById('headerPhoneLink');
    if (headerPhoneLink && customerPhone) {
      headerPhoneLink.href = `tel:${customerPhone}`;
    }
  }

  // Render service details
  renderServiceDetails(order);

  // Render address details
  renderAddressDetails(order);

  // Render payment details
  renderPaymentDetails(order, receipt);

  // Update note
  const noteEl = document.getElementById('orderNote');
  const noteSection = document.getElementById('noteSection');
  if (noteEl && noteSection) {
    if (order.note) {
      noteEl.textContent = `"${order.note}"`;
      noteSection.classList.remove('hidden');
    } else {
      noteSection.classList.add('hidden');
    }
  }
}

// Update timeline based on status logs
function updateTimeline(statusLogs) {
  // Reset all steps
  document.querySelectorAll('.step-item').forEach(step => {
    step.classList.remove('step-active', 'step-completed');
  });

  // Find status transitions
  const statusMap = {
    "accepted": { step: "step-0", time: "time-step-0" },
    "departed": { step: "step-1", time: "time-step-1" },
    "arrived": { step: "step-2", time: "time-step-2" },
    "in_progress": { step: "step-3", time: "time-step-3" },
    "completed": { step: "step-4", time: "time-step-4" }
  };

  statusLogs.forEach(log => {
    const config = statusMap[log.to_status];
    if (config) {
      const stepEl = document.getElementById(config.step);
      const timeEl = document.getElementById(config.time);
      
      if (stepEl) {
        stepEl.classList.add('step-completed');
        // Show accept step if it was accepted
        if (log.to_status === "accepted") {
          stepEl.classList.remove('hidden');
        }
      }
      if (timeEl) {
        timeEl.textContent = formatTime(log.created_at);
      }
    }
  });

  // Mark current step as active
  if (currentState >= 0 && currentState <= 4) {
    const currentStepId = stateToStep[currentState];
    if (currentStepId) {
      const currentStepEl = document.getElementById(currentStepId);
      if (currentStepEl) {
        currentStepEl.classList.add('step-active');
        // Show accept step if assigned
        if (currentState === 0) {
          currentStepEl.classList.remove('hidden');
        }
      }
    }
  }
}

// Update UI based on current state
function updateUI() {
  if (!currentOrder) return;

  const status = currentOrder.status;
  currentState = statusToState[status] ?? -1;

  // Update status badge
  const statusBadge = document.getElementById('statusBadge');
  if (statusBadge) {
    const statusText = {
      "assigned": "Đã được gán",
      "accepted": "Đã nhận đơn",
      "departed": "Đang di chuyển",
      "arrived": "Đã đến nơi",
      "in_progress": "Đang làm việc",
      "completed": "Hoàn thành"
    };
    statusBadge.textContent = statusText[status] || status;
    statusBadge.className = status === "completed" 
      ? "px-2.5 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase tracking-wide"
      : status === "assigned"
      ? "px-2.5 py-1 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded-full uppercase tracking-wide"
      : "px-2.5 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full uppercase tracking-wide";
  }

  // Configure button based on state
  let buttonConfig = null;

  if (status === "assigned") {
    // Show accept button
    buttonConfig = {
      btnText: "Nhận đơn hàng",
      icon: "check_circle",
      color: "#10B981",
      action: "accept"
    };
    cancelBtn.style.display = "block";
    cancelBtn.textContent = "Từ chối đơn hàng";
    // Show accept step in timeline
    const acceptStep = document.getElementById("step-0");
    if (acceptStep) {
      acceptStep.classList.remove('hidden');
    }
  } else if (status === "accepted") {
    buttonConfig = {
      btnText: "Xác nhận khởi hành",
      icon: "near_me",
      color: "#3730A3",
      action: "depart"
    };
    cancelBtn.style.display = "block";
    cancelBtn.textContent = "Hủy nhận đơn này";
  } else if (status === "departed") {
    buttonConfig = {
      btnText: "Xác nhận đã đến nơi",
      icon: "location_on",
      color: "#F59E0B",
      action: "arrive"
    };
    cancelBtn.style.display = "none";
  } else if (status === "arrived") {
    buttonConfig = {
      btnText: "Bắt đầu làm việc",
      icon: "play_circle",
      color: "#10B981",
      action: "start"
    };
    cancelBtn.style.display = "none";
  } else if (status === "in_progress") {
    buttonConfig = {
      btnText: "Hoàn thành & Thu tiền",
      icon: "check_circle",
      color: "#3730A3",
      action: "complete"
    };
    cancelBtn.style.display = "none";
  } else if (status === "completed") {
    mainBtn.style.display = "none";
    cancelBtn.style.display = "none";
    return;
  }

  if (buttonConfig) {
    btnText.innerText = buttonConfig.btnText;
    btnIcon.innerText = buttonConfig.icon;
    mainBtn.style.backgroundColor = buttonConfig.color;
    mainBtn.dataset.action = buttonConfig.action;
    mainBtn.disabled = false;
    mainBtn.style.opacity = "1";
    mainBtn.classList.add('btn-pulse');
  }
}

// Call API for tasker actions
async function callTaskerAction(action) {
  const actionMap = {
    "accept": { method: "PUT", endpoint: `/accept/${orderId}` },
    "deny": { method: "PUT", endpoint: `/deny/${orderId}`, body: { reason: "Tasker từ chối đơn hàng" } },
    "depart": { method: "PUT", endpoint: `/confirm/depart/${orderId}` },
    "arrive": { method: "PUT", endpoint: `/confirm/arrive/${orderId}` },
    "start": { method: "PUT", endpoint: `/confirm/start/${orderId}` },
    "complete": { method: "PUT", endpoint: `/confirm/complete/${orderId}` }
  };

  const config = actionMap[action];
  if (!config) {
    console.error("Unknown action:", action);
    return false;
  }

  try {
    const options = {
      method: config.method,
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`
      }
    };

    if (config.body) {
      options.body = JSON.stringify(config.body);
    }

    const res = await fetch(
      `http://localhost:3000/api/tasker${config.endpoint}`,
      options
    );

    if (res.status === 401) {
      localStorage.removeItem("token");
      alert("Phiên đăng nhập hết hạn");
      location.href = "../auth/login-signup.html";
      return false;
    }

    const result = await res.json();

    if (res.ok && result.success) {
      return true;
    } else {
      alert(result.message || result.error || "Có lỗi xảy ra");
      return false;
    }
  } catch (error) {
    console.error("Error calling tasker action:", error);
    alert("Không thể kết nối đến server");
    return false;
  }
}

// Handle main action button click
mainBtn.addEventListener('click', async () => {
  const action = mainBtn.dataset.action;
  if (!action) return;

  const originalText = btnText.innerText;
  btnText.innerText = "Đang xử lý...";
  mainBtn.disabled = true;
  mainBtn.classList.remove('btn-pulse');
  mainBtn.style.opacity = "0.7";

  const success = await callTaskerAction(action);

  if (success) {
    // Reload order details
    const details = await fetchOrderDetails();
    if (details) {
      currentOrder = details.order;
      updateOrderInfo(currentOrder);
      updateTimeline(details.statusLogs || []);
      updateUI();
    }
  } else {
    // Restore button state
    btnText.innerText = originalText;
    mainBtn.disabled = false;
    mainBtn.style.opacity = "1";
    mainBtn.classList.add('btn-pulse');
  }
});

// Handle cancel/deny button click
cancelBtn.addEventListener('click', async () => {
  if (currentOrder?.status === "assigned") {
    // Deny action
    if (!confirm("Bạn có chắc chắn muốn từ chối đơn hàng này?")) {
      return;
    }

    cancelBtn.disabled = true;
    cancelBtn.textContent = "Đang xử lý...";

    const success = await callTaskerAction("deny");

    if (success) {
      alert("Đã từ chối đơn hàng. Hệ thống đang tìm tasker khác.");
      window.location.href = "./tasker_home.html";
    } else {
      cancelBtn.disabled = false;
      cancelBtn.textContent = "Từ chối đơn hàng";
    }
  } else if (currentOrder?.status === "accepted") {
    // Cancel action (similar to deny but might have different logic)
    if (!confirm("Bạn có chắc chắn muốn hủy nhận đơn hàng này?")) {
      return;
    }

    cancelBtn.disabled = true;
    cancelBtn.textContent = "Đang xử lý...";

    const success = await callTaskerAction("deny");

    if (success) {
      alert("Đã hủy nhận đơn hàng.");
      window.location.href = "./tasker_home.html";
    } else {
      cancelBtn.disabled = false;
      cancelBtn.textContent = "Hủy nhận đơn này";
    }
  }
});

// Initialize page
async function init() {
  const details = await fetchOrderDetails();
  
  if (!details) {
    alert("Không thể tải thông tin đơn hàng");
    window.location.href = "./tasker_home.html";
    return;
  }

  currentOrder = details.order;
  updateOrderInfo(currentOrder, details.receipt);
  updateTimeline(details.statusLogs || []);
  updateUI();
}

// Run initialization
init();
