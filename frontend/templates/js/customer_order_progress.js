const token = localStorage.getItem("token");
const role = localStorage.getItem("system_role");
const customerUserId = localStorage.getItem("user_id");

if (!token) {
  alert("Vui lòng đăng nhập");
  location.href = "../auth/login-signup.html";
}

if (role !== "customer") {
  alert("Bạn không phải là Customer. Vui lòng đăng nhập lại.");
  location.href = "../auth/login-signup.html";
}

// Get order ID from URL
const urlParams = new URLSearchParams(window.location.search);
let orderId = urlParams.get("orderId") || localStorage.getItem("currentOrderId");

if (!orderId) {
  alert("Không tìm thấy đơn hàng");
  location.href = "./customer_activity.html";
}

// Store orderId for reference
localStorage.setItem("currentOrderId", orderId);

let currentOrder = null;
let currentReview = null;
let selectedRating = 0;
let canCancel = false;
let penaltyAmount = 0;

// DOM Elements
const statusBadge = document.getElementById('statusBadge');
const mainBtn = document.getElementById('main-action-btn');
const cancelBtn = document.getElementById('cancel-btn');
const reviewReminderSection = document.getElementById('reviewReminderSection');
const reviewDisplaySection = document.getElementById('reviewDisplaySection');
const reviewModal = document.getElementById('reviewModal');
const taskerInfoCard = document.getElementById('taskerInfoCard');

// Status to step mapping for customer timeline
const statusToStep = {
  "pending": "step-pending",
  "assigned": "step-assigned",
  "accepted": "step-accepted",
  "departed": "step-departed",
  "arrived": "step-arrived",
  "in_progress": "step-in-progress",
  "completed": "step-completed",
  "cancelled": null
};

// Format currency
function formatCurrency(v) {
  return Number(v || 0).toLocaleString("vi-VN") + "đ";
}

// Format currency with VND
const formatCurrencyVND = (v) => Number(v || 0).toLocaleString("vi-VN") + " VND";

// Service renderers (same as tasker version)
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
      `http://localhost:3000/api/order/${orderId}/details`,
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

  const receiptCreateDate = receipt?.created_at 
    ? formatDate(receipt.created_at)
    : "—";

  const receiptCreateTime = receipt?.created_at 
    ? formatTimeOnly(receipt.created_at)
    : "—";

  const paymentTime = receipt?.paid_at
    ? formatDateTime(receipt.paid_at)
    : "Chưa thanh toán";

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
        <span>Ngày tạo hóa đơn</span>
        <span>${receiptCreateDate}</span>
      </div>
      <div class="flex justify-between items-center text-sm text-gray-600">
        <span>Thời gian tạo hóa đơn</span>
        <span>${receiptCreateTime}</span>
      </div>
      <div class="flex justify-between items-center text-sm text-gray-600">
        <span>Thời điểm thanh toán</span>
        <span>${paymentTime}</span>
      </div>
    </div>
  `;
}

// Update tasker information in UI
function updateTaskerInfo(order) {
  if (!order.tasker_id) {
    if (taskerInfoCard) {
      taskerInfoCard.classList.add("hidden");
    }
    return;
  }

  if (taskerInfoCard) {
    taskerInfoCard.classList.remove("hidden");
  }

  const tasker = order.tasker_id;
  const taskerName = tasker.full_name || "Tasker";
  const taskerPhone = tasker.phone_number || "";
  const taskerAvatar = tasker.avatar_url;

  const maskedPhone = taskerPhone ? taskerPhone.slice(0, 4) + " *** " + taskerPhone.slice(-3) : "";

  const taskerNameEl = document.getElementById('taskerName');
  if (taskerNameEl) {
    taskerNameEl.textContent = taskerName;
  }

  const taskerPhoneEl = document.getElementById('taskerPhone');
  if (taskerPhoneEl) {
    taskerPhoneEl.textContent = maskedPhone;
  }

  // Update avatar
  const avatarImg = document.getElementById('taskerAvatar');
  if (avatarImg) {
    avatarImg.src = taskerAvatar || `https://ui-avatars.com/api/?name=${encodeURIComponent(taskerName)}&background=A5B4FC&color=3730A3`;
  }

  // Update phone links
  const phoneLink = document.getElementById('phoneLink');
  if (phoneLink && taskerPhone) {
    phoneLink.href = `tel:${taskerPhone}`;
  }
  const headerPhoneLink = document.getElementById('headerPhoneLink');
  if (headerPhoneLink && taskerPhone) {
    headerPhoneLink.href = `tel:${taskerPhone}`;
  }
}

// Update order information in UI
function updateOrderInfo(order, receipt, review) {
  // Update tasker info
  updateTaskerInfo(order);

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

  // Update review section
  const reviewSection = document.getElementById('reviewSection');
  if (reviewSection) {
    if (review) {
      reviewSection.classList.remove('hidden');
      reviewSection.innerHTML = `
        <h3 class="font-bold text-dark-900 text-lg flex items-center mb-3">
          <span class="material-symbols-outlined text-primary-500 mr-2">star</span>
          Đánh giá của bạn
        </h3>
        <div class="bg-white border border-primary-300 rounded-2xl p-4">
          <div class="flex items-center gap-2 mb-2">
            ${Array.from({ length: 5 }, (_, i) => `
              <span class="text-xl ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}">★</span>
            `).join("")}
          </div>
          ${review.comment ? `<p class="text-sm text-gray-700 mt-2">${escapeHtml(review.comment)}</p>` : ""}
        </div>
      `;
    } else if (order.status === "completed") {
      reviewSection.classList.remove('hidden');
      reviewSection.innerHTML = `
        <h3 class="font-bold text-dark-900 text-lg flex items-center mb-3">
          <span class="material-symbols-outlined text-primary-500 mr-2">star</span>
          Đánh giá
        </h3>
        <div class="bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
          <p class="text-sm text-gray-600">Bạn chưa đánh giá tasker này</p>
        </div>
      `;
    } else {
      reviewSection.classList.add('hidden');
    }
  }
}

// Update timeline based on status logs
function updateTimeline(statusLogs) {
  // Reset all steps
  document.querySelectorAll('.step-item').forEach(step => {
    step.classList.remove('step-active', 'step-completed');
  });

  // Set pending step time from order creation
  if (currentOrder && currentOrder.created_at) {
    const pendingTimeEl = document.getElementById("time-step-pending");
    if (pendingTimeEl) {
      pendingTimeEl.textContent = formatTime(currentOrder.created_at);
    }
  }

  // Find status transitions
  const statusMap = {
    "pending": { step: "step-pending", time: "time-step-pending" },
    "assigned": { step: "step-assigned", time: "time-step-assigned" },
    "accepted": { step: "step-accepted", time: "time-step-accepted" },
    "departed": { step: "step-departed", time: "time-step-departed" },
    "arrived": { step: "step-arrived", time: "time-step-arrived" },
    "in_progress": { step: "step-in-progress", time: "time-step-in-progress" },
    "completed": { step: "step-completed", time: "time-step-completed" }
  };

  // Mark completed steps from status logs
  statusLogs.forEach(log => {
    const config = statusMap[log.to_status];
    if (config) {
      const stepEl = document.getElementById(config.step);
      const timeEl = document.getElementById(config.time);
      
      if (stepEl) {
        stepEl.classList.add('step-completed');
        stepEl.classList.remove('hidden');
      }
      if (timeEl) {
        timeEl.textContent = formatTime(log.created_at);
      }
    }
  });

  // Mark current step as active
  if (currentOrder) {
    const status = currentOrder.status;
    
    // Mark pending as completed if order has moved past pending
    if (status !== "pending") {
      const pendingStep = document.getElementById("step-pending");
      if (pendingStep) {
        pendingStep.classList.add('step-completed');
      }
    }
    
    const currentStepId = statusToStep[status];
    if (currentStepId) {
      const currentStepEl = document.getElementById(currentStepId);
      if (currentStepEl) {
        currentStepEl.classList.add('step-active');
        currentStepEl.classList.remove('hidden');
      }
    } else if (status === "pending") {
      // Show pending step as active if order is still pending
      const pendingStep = document.getElementById("step-pending");
      if (pendingStep) {
        pendingStep.classList.add('step-active');
      }
    }
  }
}

// Update UI based on current state
function updateUI() {
  if (!currentOrder) return;

  const status = currentOrder.status;

  // Update status badge
  if (statusBadge) {
    const statusText = {
      "pending": "Chờ xử lý",
      "assigned": "Đã gán tasker",
      "accepted": "Tasker đã nhận",
      "departed": "Đang di chuyển",
      "arrived": "Đã đến nơi",
      "in_progress": "Đang làm việc",
      "completed": "Hoàn thành",
      "cancelled": "Đã hủy"
    };
    statusBadge.textContent = statusText[status] || status;
    
    const badgeClasses = {
      "pending": "px-2.5 py-1 bg-yellow-100 text-yellow-700 text-[10px] font-bold rounded-full uppercase tracking-wide",
      "assigned": "px-2.5 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full uppercase tracking-wide",
      "accepted": "px-2.5 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase tracking-wide",
      "departed": "px-2.5 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full uppercase tracking-wide",
      "arrived": "px-2.5 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase tracking-wide",
      "in_progress": "px-2.5 py-1 bg-indigo-100 text-indigo-700 text-[10px] font-bold rounded-full uppercase tracking-wide",
      "completed": "px-2.5 py-1 bg-green-100 text-green-700 text-[10px] font-bold rounded-full uppercase tracking-wide",
      "cancelled": "px-2.5 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-full uppercase tracking-wide"
    };
    statusBadge.className = badgeClasses[status] || badgeClasses.pending;
  }

  // Configure buttons based on state
  if (status === "completed") {
    if (mainBtn) mainBtn.style.display = "none";
    if (cancelBtn) cancelBtn.style.display = "none";
    // Check review status when order is completed
    checkReview();
    return;
  } else if (status === "cancelled") {
    if (mainBtn) mainBtn.style.display = "none";
    if (cancelBtn) cancelBtn.style.display = "none";
    // Hide review sections if order is cancelled
    if (reviewReminderSection) {
      reviewReminderSection.classList.add("hidden");
    }
    if (reviewDisplaySection) {
      reviewDisplaySection.classList.add("hidden");
    }
    return;
  } else {
    // Hide review sections if order is not completed
    if (reviewReminderSection) {
      reviewReminderSection.classList.add("hidden");
    }
    if (reviewDisplaySection) {
      reviewDisplaySection.classList.add("hidden");
    }
  }

  // Show cancel button if can cancel
  if (cancelBtn) {
    if (canCancel) {
      cancelBtn.style.display = "block";
      cancelBtn.textContent = penaltyAmount > 0 
        ? `Huỷ đơn (Phí phạt: ${formatCurrency(penaltyAmount)})`
        : "Huỷ đơn";
    } else {
      cancelBtn.style.display = "none";
    }
  }

  // Hide main action button for customer (they don't have actions like tasker)
  if (mainBtn) {
    mainBtn.style.display = "none";
  }
}

// Check if customer has reviewed tasker
async function checkReview() {
  // Only check if order is completed
  if (!currentOrder || currentOrder.status !== "completed") {
    if (reviewReminderSection) {
      reviewReminderSection.classList.add("hidden");
    }
    if (reviewDisplaySection) {
      reviewDisplaySection.classList.add("hidden");
    }
    return;
  }

  try {
    const res = await fetch(
      `http://localhost:3000/api/order/reviews/${orderId}`,
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
      return;
    }

    const data = await res.json();
    
    if (data.can_review === false && data.data) {
      // Already reviewed
      currentReview = data.data;
      showReviewDisplay();
    } else {
      // Not reviewed yet
      currentReview = null;
      showReviewReminder();
    }
  } catch (error) {
    console.error("Error checking review:", error);
    // On error, hide both sections
    if (reviewReminderSection) {
      reviewReminderSection.classList.add("hidden");
    }
    if (reviewDisplaySection) {
      reviewDisplaySection.classList.add("hidden");
    }
  }
}

function showReviewReminder() {
  if (reviewReminderSection) {
    reviewReminderSection.classList.remove("hidden");
  }
  if (reviewDisplaySection) {
    reviewDisplaySection.classList.add("hidden");
  }
}

function showReviewDisplay() {
  if (reviewReminderSection) {
    reviewReminderSection.classList.add("hidden");
  }
  if (reviewDisplaySection && currentReview) {
    reviewDisplaySection.classList.remove("hidden");
    const content = document.getElementById("reviewDisplayContent");
    if (content) {
      const stars = Array.from({ length: 5 }, (_, i) => 
        i < currentReview.rating ? "★" : "☆"
      ).join("");
      content.innerHTML = `
        <div class="flex items-center gap-1 mb-2">
          ${Array.from({ length: 5 }, (_, i) => 
            `<span class="text-lg ${i < currentReview.rating ? 'text-yellow-400' : 'text-gray-300'}">★</span>`
          ).join("")}
        </div>
        ${currentReview.comment ? `<p class="text-sm text-green-800">${escapeHtml(currentReview.comment)}</p>` : ""}
      `;
    }
  }
}

function openReviewModal() {
  if (!currentOrder || currentOrder.status !== "completed") {
    alert("Chỉ có thể đánh giá đơn hàng đã hoàn thành");
    return;
  }
  
  if (!currentOrder.tasker_id) {
    alert("Đơn hàng chưa có tasker");
    return;
  }
  
  selectedRating = 0;
  updateRatingStars(0);
  document.getElementById("reviewComment").value = "";
  
  if (reviewModal) {
    reviewModal.classList.remove("hidden");
  }
}

function closeReviewModal() {
  if (reviewModal) {
    reviewModal.classList.add("hidden");
  }
  selectedRating = 0;
}

function updateRatingStars(rating) {
  const stars = document.querySelectorAll(".rating-star");
  const ratingText = document.getElementById("ratingText");
  
  stars.forEach((star, index) => {
    const starRating = index + 1;
    if (starRating <= rating) {
      star.classList.remove("text-gray-300");
      star.classList.add("text-yellow-400");
    } else {
      star.classList.remove("text-yellow-400");
      star.classList.add("text-gray-300");
    }
  });
  
  if (ratingText) {
    const texts = {
      0: "Chọn số sao đánh giá",
      1: "Rất không hài lòng",
      2: "Không hài lòng",
      3: "Bình thường",
      4: "Hài lòng",
      5: "Rất hài lòng"
    };
    ratingText.textContent = texts[rating] || texts[0];
  }
}

async function submitReview() {
  if (selectedRating === 0) {
    alert("Vui lòng chọn số sao đánh giá");
    return;
  }

  if (!currentOrder || !currentOrder.tasker_id) {
    alert("Không tìm thấy thông tin tasker");
    return;
  }

  const comment = document.getElementById("reviewComment").value.trim();
  const taskerId = typeof currentOrder.tasker_id === "object" 
    ? currentOrder.tasker_id._id || currentOrder.tasker_id
    : currentOrder.tasker_id;

  const submitBtn = document.getElementById("submitReviewBtn");
  const originalText = submitBtn.textContent;
  submitBtn.disabled = true;
  submitBtn.textContent = "Đang gửi...";

  try {
    const res = await fetch(
      "http://localhost:3000/api/order/reviews/add",
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({
          order_id: orderId,
          reviewee_id: taskerId,
          reviewee_role: "tasker",
          rating: selectedRating,
          comment: comment || ""
        })
      }
    );

    if (res.status === 401) {
      localStorage.removeItem("token");
      alert("Phiên đăng nhập hết hạn");
      location.href = "../auth/login-signup.html";
      return;
    }

    const data = await res.json();

    if (res.ok && data.message) {
      alert(data.message || "Đánh giá thành công");
      closeReviewModal();
      // Reload review status
      await checkReview();
      // Reload order details to update review section
      const details = await fetchOrderDetails();
      if (details) {
        currentOrder = details.order;
        updateOrderInfo(currentOrder, details.receipt, details.review);
      }
    } else {
      alert(data.message || "Gửi đánh giá thất bại");
    }
  } catch (error) {
    console.error("Error submitting review:", error);
    alert("Có lỗi xảy ra khi gửi đánh giá");
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = originalText;
  }
}

function escapeHtml(text) {
  if (!text) return "";
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

// Cancel order
async function cancelOrder() {
  if (!canCancel) {
    alert("Không thể hủy đơn hàng này");
    return;
  }

  const penaltyMsg = penaltyAmount > 0 
    ? `\n\nLưu ý: Bạn sẽ bị phạt ${formatCurrency(penaltyAmount)} khi hủy đơn này.`
    : "";

  if (!confirm(`Bạn có chắc chắn muốn hủy đơn hàng này?${penaltyMsg}`)) {
    return;
  }

  const reason = prompt("Vui lòng nhập lý do hủy đơn (tùy chọn):") || "Khách hàng hủy đơn";

  try {
    const res = await fetch(
      `http://localhost:3000/api/order/cancel/${orderId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason })
      }
    );

    if (res.status === 401) {
      localStorage.removeItem("token");
      alert("Phiên đăng nhập hết hạn");
      location.href = "../auth/login-signup.html";
      return;
    }

    const result = await res.json();

    if (res.ok && result.success) {
      alert("Đã hủy đơn hàng thành công");
      // Reload order details
      const details = await fetchOrderDetails();
      if (details) {
        currentOrder = details.order;
        updateOrderInfo(currentOrder, details.receipt, details.review);
        canCancel = details.canCancel;
        penaltyAmount = details.penaltyAmount || 0;
        updateUI();
      }
    } else {
      alert(result.message || "Hủy đơn hàng thất bại");
    }
  } catch (error) {
    console.error("Error cancelling order:", error);
    alert("Có lỗi xảy ra khi hủy đơn hàng");
  }
}

// Open chat function
function openChat() {
    if (!orderId) {
        alert("Không tìm thấy đơn hàng");
        return;
    }
    window.location.href = `../chat.html?orderId=${orderId}`;
}

// Setup review modal event listeners
function setupReviewModal() {
  // Rating stars click handlers
  const stars = document.querySelectorAll(".rating-star");
  stars.forEach(star => {
    star.addEventListener("click", () => {
      selectedRating = parseInt(star.getAttribute("data-rating"));
      updateRatingStars(selectedRating);
    });
    
    star.addEventListener("mouseenter", () => {
      const hoverRating = parseInt(star.getAttribute("data-rating"));
      updateRatingStars(hoverRating);
    });
  });
  
  // Reset stars on mouse leave
  const ratingContainer = document.getElementById("ratingStars");
  if (ratingContainer) {
    ratingContainer.addEventListener("mouseleave", () => {
      updateRatingStars(selectedRating);
    });
  }
  
  // Open review button
  const openReviewBtn = document.getElementById("openReviewBtn");
  if (openReviewBtn) {
    openReviewBtn.addEventListener("click", openReviewModal);
  }

  // Cancel button
  if (cancelBtn) {
    cancelBtn.addEventListener("click", cancelOrder);
  }
}

// Expose to window for onclick handlers
window.openChat = openChat;
window.openReviewModal = openReviewModal;
window.closeReviewModal = closeReviewModal;
window.submitReview = submitReview;

// Initialize page
async function init() {
  const details = await fetchOrderDetails();
  
  if (!details) {
    alert("Không thể tải thông tin đơn hàng");
    window.location.href = "./customer_activity.html";
    return;
  }

  currentOrder = details.order;
  canCancel = details.canCancel || false;
  penaltyAmount = details.penaltyAmount || 0;
  
  const statusLogs = details.statusLogs || [];
  
  updateOrderInfo(currentOrder, details.receipt, details.review);
  updateTimeline(statusLogs);
  updateUI();
  
  // Check review status
  await checkReview();
}

// Run initialization
init();
setupReviewModal();
