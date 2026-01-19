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

const urlParams = new URLSearchParams(window.location.search);
let orderId = urlParams.get("orderId") || localStorage.getItem("currentOrderId");
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

localStorage.setItem("currentOrderId", orderId);

let currentOrder = null;
// 0 = assigned, 1 = accepted, 2 = departed, 3 = arrived, 4 = in_progress, 5 = completed
let currentState = -1; 
let currentReview = null;
let selectedRating = 0;
let hoverRating = 0;

const btnText = document.getElementById('btn-text');
const mainBtn = document.getElementById('main-action-btn');
const btnIcon = document.getElementById('btn-icon');
const cancelBtn = document.getElementById('cancel-btn');
const reviewReminderSection = document.getElementById('reviewReminderSection');
const reviewDisplaySection = document.getElementById('reviewDisplaySection');
const reviewModal = document.getElementById('reviewModal');

const statusToState = {
  "pending": -1, // Pending orders (not yet assigned)
  "assigned": 0,
  "accepted": 1,
  "departed": 2,
  "arrived": 3,
  "in_progress": 4,
  "completed": 5,
  "cancelled": -2
};

const stateToStep = {
  0: "step-0", // Accept step (new) - for assigned status
  1: "step-1", // Depart step - for accepted status
  2: "step-1", // Already departed - for departed status
  3: "step-2", // Arrive step - for arrived status
  4: "step-3", // Start step - for in_progress status
  5: "step-4"  // Complete step - for completed status
};

const formatCurrencyVND = (v) => Number(v || 0).toLocaleString("vi-VN") + " VND";

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

  console.log("receipt: ", receipt);
  const paymentMethod = receipt?.payment_method 
    ? paymentMap[receipt.payment_method] || receipt.payment_method
    : "Chưa thanh toán";

  console.log(paymentMethod);

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

// Update order information in UI
function updateOrderInfo(order, receipt, customerReviews) {

  // Update customer info
  if (order.customer_id) {
    console.log("customer_id: ", order.customer_id);

    const customerName = order.customer_id.full_name || "Khách hàng";
    const customerPhone = order.customer_id.phone_number || "";
    const customerAvatar = order.customer_id.avatar_url;

    const maskedPhone = customerPhone ? customerPhone.slice(0, 4) + " *** " + customerPhone.slice(-3) : "";

    const customerNameEl = document.getElementById('customerName');
    if (customerNameEl) {
      customerNameEl.textContent = customerName;
    }

    const customerPhoneEl = document.getElementById('customerPhone');
    if (customerPhoneEl) {
      customerPhoneEl.textContent = maskedPhone;
    }

    const avatarImg = document.getElementById('customerAvatar');
    if (avatarImg) {
      avatarImg.src = customerAvatar ? customerAvatar :
      `https://ui-avatars.com/api/?name=${encodeURIComponent(customerName)}&background=A5B4FC&color=3730A3`;
    }

    const phoneLink = document.getElementById('phoneLink');
    if (phoneLink && customerPhone) {
      phoneLink.href = `tel:${customerPhone}`;
    }
    const headerPhoneLink = document.getElementById('headerPhoneLink');
    if (headerPhoneLink && customerPhone) {
      headerPhoneLink.href = `tel:${customerPhone}`;
    }
  }

  if (!customerReviews) return;
  console.log("CUSTOMER REVIEWS: ", customerReviews);
  const rating = customerReviews.average_rating || 0;
  const reviewCount = customerReviews.review_count || 0;
  const reputation = order.customer_id.reputation_score || 0;

  // Update stars
  renderRatingStars('customerStars', rating);

  // Update rating value
  const ratingEl = document.getElementById('customerRating');
  if (ratingEl) {
    ratingEl.textContent = rating > 0 ? rating.toFixed(1) : "—";
  }

  // Update review count
  const reviewCountEl = document.getElementById('customerReviewCount');
  if (reviewCountEl) {
    reviewCountEl.textContent = `(${reviewCount})`;
  }

  // Update reputation
  const reputationEl = document.getElementById('customerReputation');
  if (reputationEl) {
    reputationEl.textContent = `Điểm: ${reputation}`;
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

// Render rating stars
function renderRatingStars(containerId, rating) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;
  
  let starsHTML = "";
  
  // Full stars
  for (let i = 0; i < fullStars; i++) {
    starsHTML += '<span class="material-symbols-outlined text-xs">star</span>';
  }
  
  // Half star
  if (hasHalfStar && fullStars < 5) {
    starsHTML += '<span class="material-symbols-outlined text-xs">star_half</span>';
  }
  
  // Empty stars
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  for (let i = 0; i < emptyStars; i++) {
    starsHTML += '<span class="material-symbols-outlined text-xs text-gray-300">star</span>';
  }
  
  container.innerHTML = starsHTML;
}

// // Update customer reviews and reputation display
// function updateCustomerStats(customerReviews, customer) {
  
// }

function disableAllActions() {
  // disable main button
  if (mainBtn) {
    mainBtn.disabled = true;
    mainBtn.style.opacity = "0.5";
    mainBtn.classList.remove("btn-pulse");
  }

  // disable cancel button
  if (cancelBtn) {
    cancelBtn.disabled = true;
    cancelBtn.style.opacity = "0.5";
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

  if (status === "cancelled") {
    // Badge
    const statusBadge = document.getElementById("statusBadge");
    if (statusBadge) {
      statusBadge.textContent = "Đã hủy";
      statusBadge.className =
        "px-2.5 py-1 bg-red-100 text-red-700 text-[10px] font-bold rounded-full uppercase tracking-wide";
    }

    // Hide all action buttons
    mainBtn.style.display = "none";
    cancelBtn.style.display = "none";

    // Disable all interactions just in case
    disableAllActions();

    // Hide review sections
    reviewReminderSection?.classList.add("hidden");
    reviewDisplaySection?.classList.add("hidden");

    return;
  }

  // Update status badge
  const statusBadge = document.getElementById('statusBadge');
  if (statusBadge) {
    const statusText = {
      "pending": "Chờ nhận",
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
      : status === "pending"
      ? "px-2.5 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full uppercase tracking-wide"
      : "px-2.5 py-1 bg-blue-100 text-blue-700 text-[10px] font-bold rounded-full uppercase tracking-wide";
  }

  // Configure button based on state
  let buttonConfig = null;

  if (status === "pending" || status === "assigned") {
    // Show accept button for both pending and assigned orders
    buttonConfig = {
      btnText: "Nhận đơn hàng",
      icon: "check_circle",
      color: "#10B981",
      action: "accept"
    };
    cancelBtn.style.display = "block";
    cancelBtn.textContent = status === "pending" ? "Không nhận đơn này" : "Từ chối đơn hàng";
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
    // Check review status when order is completed
    checkReview();
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
      // For pending orders trying to accept, show a helpful message
      if (action === "accept" && currentOrder?.status === "pending") {
        alert("Đơn hàng này chưa được gán cho bạn. Vui lòng nhận đơn từ trang chủ trước.");
        return false;
      }
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
      updateOrderInfo(currentOrder, details.receipt);
      updateTimeline(details.statusLogs || []);
      updateUI();
      // Check review status after reload (especially if order was just completed)
      await checkReview();
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
  if (currentOrder?.status === "pending" || currentOrder?.status === "assigned") {
    // Deny action for pending or assigned orders
    const confirmMsg = currentOrder.status === "pending" 
      ? "Bạn có chắc chắn không muốn nhận đơn hàng này?"
      : "Bạn có chắc chắn muốn từ chối đơn hàng này?";
    
    if (!confirm(confirmMsg)) {
      return;
    }

    cancelBtn.disabled = true;
    cancelBtn.textContent = "Đang xử lý...";

    // For pending orders, just redirect back (no deny API call needed)
    if (currentOrder.status === "pending") {
      window.location.href = "./tasker_home.html";
      return;
    }

    const success = await callTaskerAction("deny");

    if (success) {
      alert("Đã từ chối đơn hàng. Hệ thống đang tìm tasker khác.");
      window.location.href = "./tasker_home.html";
    } else {
      cancelBtn.disabled = false;
      cancelBtn.textContent = currentOrder.status === "pending" ? "Không nhận đơn này" : "Từ chối đơn hàng";
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

// logic phần đánh giá

async function checkReview() {
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
  
  selectedRating = 0;
  hoverRating = 0;
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
  hoverRating = 0;
}

// function updateRatingStars(rating) {
//   const stars = document.querySelectorAll(".rating-star");
//   const ratingText = document.getElementById("ratingText");
  
//   stars.forEach((star, index) => {
//     const starRating = index + 1;
//     if (starRating <= rating) {
//       star.classList.remove("text-gray-300");
//       star.classList.add("text-yellow-400");
//     } else {
//       star.classList.remove("text-yellow-400");
//       star.classList.add("text-gray-300");
//     }
//   });
  
//   if (ratingText) {
//     const texts = {
//       0: "Chọn số sao đánh giá",
//       1: "Rất không hài lòng",
//       2: "Không hài lòng",
//       3: "Bình thường",
//       4: "Hài lòng",
//       5: "Rất hài lòng"
//     };
//     ratingText.textContent = texts[rating] || texts[0];
//   }
// }
function updateRatingStars(rating) {
  const stars = document.querySelectorAll(".rating-star");
  const ratingText = document.getElementById("ratingText");

  stars.forEach((star, index) => {
    if (index < rating) {
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

  if (!currentOrder || !currentOrder.customer_id) {
    alert("Không tìm thấy thông tin khách hàng");
    return;
  }

  const comment = document.getElementById("reviewComment").value.trim();
  const customerId = typeof currentOrder.customer_id === "object" 
    ? currentOrder.customer_id._id || currentOrder.customer_id
    : currentOrder.customer_id;

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
          reviewee_id: customerId,
          reviewee_role: "customer",
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

async function init() {
  const details = await fetchOrderDetails();
  
  if (!details) {
    alert("Không thể tải thông tin đơn hàng");
    window.location.href = "./tasker_home.html";
    return;
  }

  currentOrder = details.order;
  currentCustomerReviews = details.customerReviews || { review_count: 0, average_rating: 0 };
  updateOrderInfo(currentOrder, details.receipt, currentCustomerReviews);
  updateTimeline(details.statusLogs || []);
  updateUI();
  
  await checkReview();
}

async function fetchCustomerProfile(customerUserId) {
  try {
    const res = await fetch(
      `http://localhost:3000/api/user/show-public/profile`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ user_id: customerUserId })
      }
    );

    if (res.status === 401) {
      localStorage.removeItem("token");
      alert("Phiên đăng nhập hết hạn");
      location.href = "../auth/login-signup.html";
      return null;
    }

    const result = await res.json();
    if (res.ok) {
      return result;
    }
    return null;
  } catch (error) {
    console.error("Error fetching customer profile:", error);
    return null;
  }
}

function mapCustomerType(type) {
  switch (type) {
    case "new":
      return "Khách hàng mới";
    case "loyal":
      return "Thành viên thân thiết";
    case "vip":
      return "Khách hàng VIP";
    default:
      return "Khách hàng";
  }
}

async function openCustomerModal() {
  if (!currentOrder || !currentOrder.customer_id) {
    alert("Không tìm thấy thông tin khách hàng");
    return;
  }

  const customerUserId = currentOrder.customer_id;
  const customerReviews = currentCustomerReviews || { review_count: 0, average_rating: 0 };

  const customerProfile = await fetchCustomerProfile(customerUserId);
  console.log("TASKER PROFILE (openTaskerModal): ", customerProfile);

  const user = customerProfile.user;
  const customer = customerProfile.customer;

  document.getElementById("modal-customer-avatar").src = user.avatar_url || `https://ui-avatars.com/api/?name=${encodeURIComponent(customer.full_name)}&background=A5B4FC&color=3730A3`;
  document.getElementById("modal-customer-name").textContent = user.full_name || "Khách hàng";
  
  const rating = customerReviews.average_rating || 0;
  renderRatingStars('modal-customer-stars', rating);
  document.getElementById("modal-customer-rating").textContent = rating > 0 ? rating.toFixed(1) : "0.0";
  document.getElementById("modal-customer-reviews").textContent = `(${customerReviews.review_count || 0} đánh giá)`;
  
  document.getElementById("modal-customer-reputation").textContent = user.reputation_score || 0;
  
  if (customer) {
    document.getElementById("modal-customer-completed").textContent = `${customer.total_completed_orders || 0} đơn`;
    document.getElementById("modal-customer-cancelled").textContent = `${customer.cancellation_count || 0} đơn`;
  } else {
    document.getElementById("modal-customer-completed").textContent = "—";
    document.getElementById("modal-customer-cancelled").textContent = "—";
  }
  
  document.getElementById("modal-customer-type").textContent = mapCustomerType(customer.type) || "Khách hàng";

  document.getElementById("customerModal").classList.remove("hidden");
}

function closeCustomerModal() {
  document.getElementById("customerModal").classList.add("hidden");
}

let currentCustomerReviews = null;

function openChat() {
    if (!orderId) {
        alert("Không tìm thấy đơn hàng");
        return;
    }
    window.location.href = `./tasker_chat.html?orderId=${orderId}`;
}

// Setup review modal event listeners
function setupReviewModal() {
  const stars = document.querySelectorAll(".rating-star");

  stars.forEach((star, index) => {
    const ratingValue = index + 1;

    // Hover: tô vàng từ 1 → ratingValue
    star.addEventListener("mouseenter", () => {
      hoverRating = ratingValue;
      updateRatingStars(hoverRating);
    });

    // Click: cố định rating
    star.addEventListener("click", () => {
      selectedRating = ratingValue;
      updateRatingStars(selectedRating);
    });
  });

  // Khi rời khỏi vùng sao → quay về rating đã chọn
  const ratingContainer = document.getElementById("ratingStars");
  if (ratingContainer) {
    ratingContainer.addEventListener("mouseleave", () => {
      hoverRating = 0;
      updateRatingStars(selectedRating);
    });
  }

  // Nút mở modal
  const openReviewBtn = document.getElementById("openReviewBtn");
  if (openReviewBtn) {
    openReviewBtn.addEventListener("click", openReviewModal);
  }
}

// Expose to window for onclick handlers
window.openChat = openChat;
window.openReviewModal = openReviewModal;
window.closeReviewModal = closeReviewModal;
window.submitReview = submitReview;
window.openCustomerModal = openCustomerModal;
window.closeCustomerModal = closeCustomerModal;

// Run initialization
init();
setupReviewModal();
