const API_BASE = (typeof window.CONFIG !== "undefined" && window.CONFIG.API_BASE_URL) ? window.CONFIG.API_BASE_URL : "http://localhost:3000";
// validate authorization
let token = localStorage.getItem("token");
if (!token) {
  alert("Chưa đăng nhập! Vui lòng đăng nhập để truy cập.");
  window.location.href = "../auth/login-signup.html";
}

const role = localStorage.getItem("system_role");
const _id = localStorage.getItem("user_id");
console.log("USER: ", role + " " + _id);
console.log("TOKEN: ", token);

if (role !== "customer") {
  alert("Bạn không phải Khách hàng. Không có quyền truy cập.");
  window.location.href = "../auth/login-signup.html";
}

let currentOrder = null;
let currentReceipt = null;
let orderPollingInterval = null;
let redirectCountdown = null;
let isRedirecting = false;

const formatCurrency = (v) => Number(v || 0).toLocaleString("vi-VN") + " VND";

// Import serviceRenderers from payment.js structure
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

// Load order details from API
async function loadOrderDetails() {
  const token = localStorage.getItem("token");
  if (!token) {
    console.error("No token found");
    return false;
  }

  // Get order ID from URL parameter
  const urlParams = new URLSearchParams(window.location.search);
  const orderId = urlParams.get("orderId");
  console.log("order_id: ", orderId);

  if (!orderId) {
    console.error("No orderId found in URL parameters");
    // Fallback: try to get from localStorage (for backward compatibility)
    const orderRaw = localStorage.getItem("orderCreated");
    if (orderRaw) {
      try {
        const orderStored = JSON.parse(orderRaw);
        if (orderStored._id) {
          // Redirect to include orderId in URL
          window.location.href = `./ordering_success.html?orderId=${orderStored._id}`;
          return false;
        }
      } catch (e) {
        console.error("Error parsing orderCreated from localStorage:", e);
      }
    }
    return false;
  }

  try {
    // Fetch order details from API
    const res = await fetch(
      `${API_BASE}/api/order/${orderId}/details`,
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
      return false;
    }

    const result = await res.json();
    if (result.success) {
      currentOrder = result.order;
      currentReceipt = result.receipt;
      console.log("ORDER LOADED: ", currentOrder);
      console.log("RECEIPT LOADED: ", currentReceipt);
      return true;
    }

    console.error("Failed to load order:", result.message);
    return false;
  } catch (error) {
    console.error("Error loading order details:", error);
    return false;
  }
}

function formatDate(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleDateString("vi-VN", {
    year: "numeric",
    month: "long",
    day: "numeric"
  });
}

function formatTime(dateString) {
  if (!dateString) return "N/A";
  const date = new Date(dateString);
  return date.toLocaleTimeString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit"
  });
}

function renderServiceDetails() {
  const el = document.getElementById("serviceDetails");
  if (!el || !currentOrder) return;

  const serviceCode = currentOrder.task_snapshot?.code || "DEFAULT";
  const renderer = serviceRenderers[serviceCode] || serviceRenderers.DEFAULT;
  const payload = currentOrder.task_payload || {};

  const scheduledInfo = currentOrder.scheduled_at && currentOrder.type === "scheduled"
    ? `<div class="bg-blue-50 p-3 rounded-lg mt-3 border border-blue-200">
        <p class="text-sm font-semibold text-blue-700 flex items-center">
          <span class="material-symbols-outlined text-sm mr-1">schedule</span>
          Đã lên lịch
        </p>
        <p class="text-sm text-blue-600 mt-1">
          ${formatDate(currentOrder.scheduled_at)} lúc ${formatTime(currentOrder.scheduled_at)}
        </p>
      </div>`
    : "";

  el.innerHTML = `
    <div class="space-y-2">
      <h4 class="font-bold text-dark-900 text-lg mb-2">
        ${currentOrder.task_snapshot?.name || "Dịch vụ"}
      </h4>
      <div class="text-base text-dark-500 space-y-1">
        ${renderer(payload)}
      </div>
      ${scheduledInfo}
      ${
        currentOrder.note
          ? `<div class="bg-gray-50 p-3 rounded-lg mt-3">
              <p class="text-sm"><strong class="text-primary-500">📝 Ghi chú:</strong></p>
              <p class="text-sm text-gray-700 mt-1">${currentOrder.note}</p>
            </div>`
          : ""
      }
    </div>
  `;
}

function renderAddressDetails() {
  const el = document.getElementById("addressDetails");
  if (!el || !currentOrder) return;

  const address = currentOrder.address_snapshot;
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

function renderPaymentDetails() {
  const el = document.getElementById("paymentDetails");
  if (!el || !currentOrder) return;

  // Use receipt payment date/time if available, otherwise use current time
  let paymentDate, paymentTime;
  if (currentReceipt && currentReceipt.created_at) {
    paymentDate = formatDate(currentReceipt.created_at);
    paymentTime = formatTime(currentReceipt.created_at);
  } else {
    const now = new Date();
    paymentDate = formatDate(now.toISOString());
    paymentTime = formatTime(now.toISOString());
  }

  const paymentMethodMap = {
    cash: "Tiền mặt",
    credit_card: "Thẻ tín dụng",
    bank_transfer: "Chuyển khoản",
    ewallet: "Ví TaskGo"
  };

  const paymentMethod = currentReceipt?.payment_method 
    ? paymentMethodMap[currentReceipt.payment_method] || currentReceipt.payment_method
    : "Chưa thanh toán";

  el.innerHTML = `
    <div class="space-y-3">
      <div class="flex justify-between items-center">
        <span class="text-gray-600">Tổng tiền dịch vụ</span>
        <span class="font-semibold text-dark-900">${formatCurrency(currentOrder.base_amount || currentOrder.final_amount)}</span>
      </div>
      ${
        currentOrder.voucher_snapshot
          ? `<div class="flex justify-between items-center">
              <span class="text-gray-600">Mã giảm giá</span>
              <span class="font-semibold text-green-600">-${formatCurrency(currentOrder.voucher_snapshot.discount_amount || 0)}</span>
            </div>`
          : ""
      }
      <div class="border-t border-gray-300 pt-3 flex justify-between items-center">
        <span class="font-bold text-dark-900 text-lg">Tổng tiền</span>
        <span class="font-bold text-primary-500 text-xl">${formatCurrency(currentOrder.final_amount)}</span>
      </div>
      <div class="flex justify-between items-center text-sm text-gray-600 pt-2">
        <span>Phương thức thanh toán</span>
        <span>${paymentMethod}</span>
      </div>
      <div class="flex justify-between items-center text-sm text-gray-600 pt-2">
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

function renderTaskerSearchStatus(status = "searching", assignedTasker = null, showRedirectMessage = false, countdown = 10) {
  const el = document.getElementById("taskerSearchStatus");
  if (!el) return;

  if (status === "accepted" && showRedirectMessage) {
    el.innerHTML = `
      <div class="flex items-center space-x-4 p-4 bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl border border-blue-200">
        <div class="flex-shrink-0">
          <div class="w-16 h-16 rounded-full bg-blue-500 flex items-center justify-center">
            <span class="material-symbols-outlined text-white text-3xl">check_circle</span>
          </div>
        </div>
        <div class="flex-1">
          <h3 class="font-bold text-dark-900 text-lg mb-1">Tasker đã nhận đơn!</h3>
          <p class="text-sm text-gray-600 mb-2">Tasker đã xác nhận nhận đơn hàng của bạn.</p>
          <p class="text-sm font-semibold text-blue-700" id="redirectCountdown">
            Tự động chuyển đến trang chi tiết đơn hàng sau <span id="countdownNumber">${countdown}</span> giây...
          </p>
        </div>
      </div>
    `;
  } else if (status === "assigned" && assignedTasker) {
    el.innerHTML = `
      <div class="flex items-center space-x-4 p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-xl border border-green-200">
        <div class="flex-shrink-0">
          <div class="w-16 h-16 rounded-full bg-green-500 flex items-center justify-center">
            <span class="material-symbols-outlined text-white text-3xl">check_circle</span>
          </div>
        </div>
        <div class="flex-1">
          <h3 class="font-bold text-dark-900 text-lg mb-1">Đã tìm thấy Tasker</h3>
          <p class="text-sm text-gray-600">Tasker đã được gán cho đơn hàng của bạn. Bạn sẽ nhận được thông báo khi Tasker xác nhận.</p>
        </div>
      </div>
    `;
  } else if (status === "error") {
    el.innerHTML = `
      <div class="flex items-center space-x-4 p-4 bg-gradient-to-r from-yellow-50 to-yellow-100 rounded-xl border border-yellow-200">
        <div class="flex-shrink-0">
          <div class="w-16 h-16 rounded-full bg-yellow-500 flex items-center justify-center">
            <span class="material-symbols-outlined text-white text-3xl">warning</span>
          </div>
        </div>
        <div class="flex-1">
          <h3 class="font-bold text-dark-900 text-lg mb-1">Đang tìm kiếm Tasker</h3>
          <p class="text-sm text-gray-600">Hiện tại chưa tìm thấy Tasker phù hợp. Hệ thống sẽ tiếp tục tìm kiếm và thông báo cho bạn khi có Tasker nhận đơn.</p>
        </div>
      </div>
    `;
  } else {
    el.innerHTML = `
      <div class="flex items-center space-x-4 p-4 bg-gradient-to-r from-primary-50 to-primary-100 rounded-xl border border-primary-200">
        <div class="flex-shrink-0">
          <div class="w-16 h-16 rounded-full bg-primary-500 flex items-center justify-center animate-pulse">
            <span class="material-symbols-outlined text-white text-3xl">search</span>
          </div>
        </div>
        <div class="flex-1">
          <h3 class="font-bold text-dark-900 text-lg mb-1">Đang tìm kiếm Tasker phù hợp</h3>
          <p class="text-sm text-gray-600">Hệ thống đang tìm kiếm Tasker phù hợp với yêu cầu của bạn. Bạn sẽ nhận được thông báo khi có Tasker nhận đơn.</p>
        </div>
      </div>
    `;
  }
}

async function findTaskerForOrder(orderId) {
  const token = localStorage.getItem("token");
  if (!token) {
    console.error("No token found");
    return;
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/order/${orderId}/find-tasker`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        }
      }
    );

    const result = await response.json();

    if (response.ok && result.success) {
      console.log("Tasker found:", result.assignedTasker);
      renderTaskerSearchStatus("assigned", result.assignedTasker);
      
      // Reload order details to get updated order with tasker
      await loadOrderDetails();
      
      // Start polling for order status changes (to detect when tasker accepts)
      startOrderStatusPolling();
    } else {
      console.warn("Could not find tasker:", result.message);
      renderTaskerSearchStatus("error");
    }
  } catch (error) {
    console.error("Error finding tasker:", error);
    renderTaskerSearchStatus("error");
  }
}

// Poll order status to detect when tasker accepts
function startOrderStatusPolling() {
  // Clear any existing polling
  if (orderPollingInterval) {
    clearInterval(orderPollingInterval);
  }

  // Poll every 3 seconds
  orderPollingInterval = setInterval(async () => {
    if (isRedirecting) {
      clearInterval(orderPollingInterval);
      return;
    }

    const loaded = await loadOrderDetails();
    if (loaded && currentOrder) {
      // Check if order status changed to "accepted"
      if (currentOrder.status === "accepted" && currentOrder.tasker_id) {
        // Tasker has accepted! Stop polling and start redirect countdown
        clearInterval(orderPollingInterval);
        startRedirectCountdown();
      }
    }
  }, 3000);
}

// Start countdown and redirect
function startRedirectCountdown() {
  if (isRedirecting) return;
  isRedirecting = true;

  let countdown = 10;
  const orderId = currentOrder._id;

  // Show redirect message
  renderTaskerSearchStatus("accepted", null, true, countdown);

  // Update countdown every second
  redirectCountdown = setInterval(() => {
    countdown--;
    const countdownEl = document.getElementById("countdownNumber");
    if (countdownEl) {
      countdownEl.textContent = countdown;
    }

    if (countdown <= 0) {
      clearInterval(redirectCountdown);
      // Redirect to customer order progress page
      window.location.href = `../customer_order_progress.html?orderId=${orderId}`;
    }
  }, 1000);
}

// Cleanup on page unload
function cleanup() {
  if (orderPollingInterval) {
    clearInterval(orderPollingInterval);
  }
  if (redirectCountdown) {
    clearInterval(redirectCountdown);
  }
}

function renderError() {
  const containers = ["serviceDetails", "addressDetails", "paymentDetails", "taskerSearchStatus"];
  containers.forEach(id => {
    const el = document.getElementById(id);
    if (el) {
      el.innerHTML = `<p class="text-red-500 text-center py-4">Không thể tải thông tin đơn hàng. Vui lòng thử lại sau.</p>`;
    }
  });
}

async function initOrderingSuccess() {
  const loaded = await loadOrderDetails();
  
  if (!loaded || !currentOrder) {
    console.error("Failed to load order details");
    renderError();
    return;
  }

  renderServiceDetails();
  renderAddressDetails();
  renderPaymentDetails();
  
  // Check if order is already accepted
  if (currentOrder.status === "accepted" && currentOrder.tasker_id) {
    // Tasker already accepted, start redirect immediately
    startRedirectCountdown();
    return;
  }
  
  // Check if we have an order and try to find tasker
  // Fixed: Call findTaskerForOrder for both immediate AND scheduled orders when status is pending
  if (currentOrder._id && currentOrder.status === "pending") {
    // Show searching status first
    renderTaskerSearchStatus("searching");
    // Then try to find tasker
    findTaskerForOrder(currentOrder._id);
  } else if (currentOrder.tasker_id && currentOrder.status === "assigned") {
    // Tasker assigned but not yet accepted, start polling
    renderTaskerSearchStatus("assigned", currentOrder.tasker_id);
    startOrderStatusPolling();
  } else if (currentOrder.status !== "pending") {
    // Order is in other status (departed, arrived, etc.), no need to poll
    renderTaskerSearchStatus("assigned", currentOrder.tasker_id);
  } else {
    renderTaskerSearchStatus("searching");
  }
}

// Cleanup on page unload
window.addEventListener("beforeunload", cleanup);

document.addEventListener("DOMContentLoaded", initOrderingSuccess);
