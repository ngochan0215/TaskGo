const token = localStorage.getItem("token");
const role = localStorage.getItem("system_role");
const customerUserId = localStorage.getItem("user_id");
if (!token) {
  alert("Vui lòng đăng nhập");
  location.href = "../auth/login-signup.html";
}
if (role !== "customer") {
  alert("Bạn không phải là Khách hàng. Vui lòng đăng nhập lại.");
  location.href = "../auth/login-signup.html";
}
console.log("TOKEN: ", token);
console.log("CUSTOMER USER ID: ", customerUserId);

const $ = (id) => document.getElementById(id);

const tabUpcoming = $("tabUpcoming");
const tabHistory = $("tabHistory");
const upcomingSection = $("upcomingSection");
const historySection = $("historySection");

const upcomingList = $("upcomingList");
const historyList = $("historyList");
const upcomingEmpty = $("upcomingEmpty");
const historyEmpty = $("historyEmpty");
const upcomingCount = $("upcomingCount");
const historyCount = $("historyCount");
const searchInput = $("searchInput");

const sheetBackdrop = $("sheetBackdrop");
const sheet = $("sheet");
const closeSheetBtn = $("closeSheetBtn");

const dOrderId = $("dOrderId");
const dStatusPill = $("dStatusPill");
const dService = $("dService");
const dTask = $("dTask");
const dTime = $("dTime");
const dCountdown = $("dCountdown");
const dAddress = $("dAddress");
const dTotal = $("dTotal");
const dPaymentNote = $("dPaymentNote");
const primaryActionBtn = $("primaryActionBtn");
const secondaryActionBtn = $("secondaryActionBtn");
const dangerActionBtn = $("dangerActionBtn");

let currentQuery = "";
let allOrders = [];
let upcomingOrders = [];
let historyOrders = [];
let currentOrderDetail = null; // Store current order detail for cancel action

// Payment method mapping
const paymentMethodMap = {
  cash: "Tiền mặt",
  credit_card: "Thẻ tín dụng",
  bank_transfer: "Chuyển khoản",
  ewallet: "Ví TaskGo"
};

// Format order ID (last 6 digits)
function formatOrderId(orderId) {
  if (!orderId) return "—";
  const idStr = String(orderId);
  return `DH-${idStr.slice(-6)}`;
}

// Format money
function formatMoney(v) {
  try {
    return (v || 0).toLocaleString("vi-VN") + "đ";
  } catch {
    return (v || 0) + "đ";
  }
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

// Status UI mapping
function statusUI(status) {
  const statusMap = {
    scheduled: {
      text: "Đặt trước",
      cls: "bg-blue-50 text-blue-700 border-blue-200",
    },
    pending: {
      text: "Chờ xác nhận",
      cls: "bg-yellow-50 text-yellow-700 border-yellow-200",
    },
    assigned: {
      text: "Đã gán Tasker",
      cls: "bg-purple-50 text-purple-700 border-purple-200",
    },
    accepted: {
      text: "Tasker đã nhận",
      cls: "bg-indigo-50 text-indigo-700 border-indigo-200",
    },
    departed: {
      text: "Tasker đang đi",
      cls: "bg-cyan-50 text-cyan-700 border-cyan-200",
    },
    arrived: {
      text: "Tasker đã đến",
      cls: "bg-teal-50 text-teal-700 border-teal-200",
    },
    in_progress: {
      text: "Đang thực hiện",
      cls: "bg-primary-100 text-primary-500 border-primary-300",
    },
    awaiting_payment: {
      text: "Chờ thanh toán",
      cls: "bg-orange-50 text-orange-700 border-orange-200",
    },
    completed: {
      text: "Hoàn tất",
      cls: "bg-green-50 text-green-700 border-green-200",
    },
    cancelled: {
      text: "Đã huỷ",
      cls: "bg-red-50 text-red-700 border-red-200",
    },
  };

  return statusMap[status] || {
    text: status || "—",
    cls: "bg-gray-50 text-gray-700 border-gray-200",
  };
}

// Calculate countdown
function calcCountdown(iso) {
  const t = new Date(iso).getTime();
  const now = Date.now();
  const diff = t - now;
  if (!isFinite(diff) || diff <= 0) return null;
  const d = Math.floor(diff / (24 * 60 * 60 * 1000));
  const h = Math.floor((diff % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
  if (d > 0) return `Còn ${d} ngày ${h} giờ`;
  return `Còn ${h} giờ`;
}

// Get task details string
function getTaskDetails(order) {
  const taskPayload = order.task_payload || {};
  const taskSnapshot = order.task_snapshot || {};
  
  // Try to get task name from task_id if populated
  if (order.task_id && typeof order.task_id === 'object') {
    return order.task_id.task_name || taskSnapshot.name || "Dịch vụ";
  }
  
  return taskSnapshot.name || "Dịch vụ";
}

// Transform order to UI format
function transformOrder(order) {
  const orderId = formatOrderId(order._id);
  const service = getTaskDetails(order);
  const address = order.address_snapshot?.full_address || "—";
  const total = order.final_amount || order.base_amount || 0;
  const paymentMethod = order.receipt?.payment_method 
    ? paymentMethodMap[order.receipt.payment_method] || order.receipt.payment_method
    : "—";
  const time = formatDateTime(order.scheduled_at);
  const timeISO = order.scheduled_at;

  return {
    id: orderId,
    _id: order._id,
    type: ["completed", "cancelled"].includes(order.status) ? "history" : "upcoming",
    status: order.status,
    service: service,
    task: service, // Can be enhanced with more details
    time: time,
    timeISO: timeISO,
    address: address,
    total: total,
    payment: paymentMethod,
    order: order // Keep full order object for detail view
  };
}

// Card template
function cardTemplate(o) {
  const st = statusUI(o.status);
  return `
    <button type="button" data-order="${o._id}"
            class="w-full text-left bg-white rounded-2xl shadow-md border border-primary-300 p-4 hover:opacity-95 transition">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="font-bold text-dark-900 truncate">${o.service}</div>
          <div class="text-sm text-primary-500 truncate">${o.task}</div>

          <div class="mt-3 space-y-1">
            <div class="flex items-center gap-2 text-sm text-gray-600">
              <span class="material-symbols-outlined text-[18px] text-primary-500">schedule</span>
              <span class="truncate">${o.time}</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-gray-600">
              <span class="material-symbols-outlined text-[18px] text-primary-500">location_on</span>
              <span class="truncate">${o.address}</span>
            </div>
          </div>

          <div class="mt-3 flex items-center justify-between">
            <div class="text-xs text-gray-500 font-semibold">#${o.id}</div>
            <div class="font-black text-dark-900">${formatMoney(o.total)}</div>
          </div>
        </div>

        <span class="text-[11px] font-black px-3 py-1 rounded-full border ${st.cls} whitespace-nowrap">
          ${st.text}
        </span>
      </div>
    </button>
  `;
}

// Apply search filter
function applySearch(list) {
  if (!currentQuery) return list;
  const q = currentQuery.toLowerCase();
  return list.filter(
    (o) =>
      (o.id || "").toLowerCase().includes(q) ||
      (o.service || "").toLowerCase().includes(q) ||
      (o.task || "").toLowerCase().includes(q) ||
      (o.address || "").toLowerCase().includes(q)
  );
}

// Fetch orders from API
async function fetchOrders() {
  try {
    // Fetch upcoming orders
    const upcomingRes = await fetch(
      `http://localhost:3000/api/order/customer/${customerUserId}?category=upcoming&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    // Fetch history orders
    const historyRes = await fetch(
      `http://localhost:3000/api/order/customer/${customerUserId}?category=history&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (upcomingRes.status === 401 || historyRes.status === 401) {
      localStorage.removeItem("token");
      alert("Phiên đăng nhập hết hạn");
      location.href = "../auth/login-signup.html";
      return;
    }

    const upcomingData = await upcomingRes.json();
    const historyData = await historyRes.json();

    if (upcomingData.success) {
      upcomingOrders = upcomingData.orders.map(transformOrder);
    }

    if (historyData.success) {
      historyOrders = historyData.orders.map(transformOrder);
    }

    allOrders = [...upcomingOrders, ...historyOrders];
    render();
  } catch (error) {
    console.error("Error fetching orders:", error);
    alert("Không thể tải danh sách đơn hàng");
  }
}

// Render orders
function render() {
  const upcoming = applySearch(upcomingOrders);
  const history = applySearch(historyOrders);

  upcomingCount.textContent = `${upcoming.length} đơn`;
  historyCount.textContent = `${history.length} đơn`;

  upcomingList.innerHTML = upcoming.map(cardTemplate).join("");
  historyList.innerHTML = history.map(cardTemplate).join("");

  upcomingEmpty.classList.toggle("hidden", upcoming.length !== 0);
  historyEmpty.classList.toggle("hidden", history.length !== 0);

  // Attach click handlers
  document.querySelectorAll("[data-order]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const orderId = btn.getAttribute("data-order");
      const order = allOrders.find((o) => String(o._id) === String(orderId));
      if (order) {
        openDetail(order);
      }
    });
  });
}

// Service renderers
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
      ${(p.items || []).map(item => `<p>🧺 ${item.name} - <span>${item.quantity} ${item.unit}</span></p>`).join("")}
    </div>
    ${p.estimated_budget ? `<p class="mt-2">💰 Ngân sách ước tính: ${Number(p.estimated_budget).toLocaleString()}đ</p>` : ""}
  `,
  HOUSE_CLEANING: (p) => {
    const extrasArr = p.extras ? Object.values(p.extras) : [];
    return `
      <div class="space-y-1">
        <p>⏱️ Thời gian combo dọn dẹp gốc: <strong>${p.base_time} giờ</strong></p>
        ${p.total_time && p.total_time > p.base_time ? `<p>⏱️ Thời gian thực hiện tổng: <strong>${p.total_time} giờ</strong></p>` : ""}
        ${p.house_type ? `<p>🏠 Loại nhà: <strong>${p.house_type}</strong></p>` : ""}
        ${extrasArr.length ? `
          <div class="mt-2">
            <p>🧩 Dịch vụ thêm:</p>
            <ul class="ml-4 list-disc space-y-1">
              ${extrasArr.map(e => `<span class="pl-30 text-m text-dark-300">${e.name} (+${Number(e.price).toLocaleString()}đ/giờ)</span>`).join("")}
            </ul>
          </div>
        ` : `<p>🧩 Dịch vụ thêm: <span class="text-gray-500">Không có</span></p>`}
      </div>
    `;
  },
  CHILDCARE: (p) => `
    <p>👶 Số lượng trẻ: ${p.child_count} bé</p>
    <p>⏱️ Thời gian làm việc: ${Math.floor(p.total_time / 60)}h ${p.total_time % 60}p</p>
    <p>📋 Độ tuổi các bé:</p>
    <ul class="pl-5 list-disc">
      ${(p.child_ages || []).map((age, index) => `<li>🧒 Bé ${index + 1}: ${age === "1-6" ? "12 tháng – 6 tuổi" : "7 – 11 tuổi"}</li>`).join("")}
    </ul>
  `,
  ELDERLY: (p) => `<p>⏱️ Thời gian làm việc: ${Math.floor(p.total_time / 60)}h ${p.total_time % 60}p</p>`,
  SICK: (p) => `<p>⏱️ Thời gian làm việc: ${Math.floor(p.total_time / 60)}h ${p.total_time % 60}p</p>`,
  AIRCONDITIONER: (p) => `
    ${(p.devices || []).map((d, i) => `
      <div class="ml-3 mt-2">
        <p>🔧 <strong>Thiết bị ${i + 1}: ${d.label}</strong></p>
        <p>⚡ Công suất: ${d.hp === "below_2" ? "Dưới 2 HP" : "Từ 2 HP trở lên"}</p>
        <p>🛢️ Bơm gas: ${d.has_gas ? "Có" : "Không"}</p>
        <p>💰 Giá: ${(d.amount || 0).toLocaleString()}đ</p>
      </div>
    `).join("")}
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
  `,
  DEFAULT: () => `<p class="text-gray-400">Không có chi tiết dịch vụ</p>`
};

// Fetch order details from API
async function fetchOrderDetails(orderId) {
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

// Open detail sheet
async function openDetail(orderData) {
  // Show loading state
  dOrderId.textContent = "Đang tải...";
  sheetBackdrop.classList.remove("hidden");
  sheet.classList.remove("hidden");

  // Fetch full order details
  const details = await fetchOrderDetails(orderData._id);
  
  if (!details) {
    alert("Không thể tải chi tiết đơn hàng");
    closeDetail();
    return;
  }

  const order = details.order;
  const receipt = details.receipt;
  const review = details.review;
  const canCancel = details.canCancel;
  const cancelReason = details.cancelReason;
  const penaltyAmount = details.penaltyAmount;

  currentOrderDetail = { ...orderData, ...details };

  const st = statusUI(order.status);
  const orderId = formatOrderId(order._id);
  const serviceCode = order.task_snapshot?.code || "DEFAULT";
  const renderer = serviceRenderers[serviceCode] || serviceRenderers.DEFAULT;
  const payload = order.task_payload || {};

  // Update basic info
  dOrderId.textContent = "#" + orderId;
  dStatusPill.textContent = st.text;
  dStatusPill.className = `text-xs font-bold px-3 py-1 rounded-full border ${st.cls}`;

  dService.textContent = order.task_snapshot?.name || "Dịch vụ";
  dTask.innerHTML = renderer(payload);
  dTime.textContent = formatDateTime(order.scheduled_at);
  dAddress.textContent = order.address_snapshot?.full_address || "—";
  dTotal.textContent = formatMoney(order.final_amount || order.base_amount);

  // Payment info
  const paymentMethod = receipt?.payment_method 
    ? paymentMethodMap[receipt.payment_method] || receipt.payment_method
    : "Chưa thanh toán";
  dPaymentNote.textContent = `Thanh toán: ${paymentMethod}`;

  // Countdown for upcoming orders
  const isUpcoming = !["completed", "cancelled"].includes(order.status);
  const cd = isUpcoming ? calcCountdown(order.scheduled_at) : null;
  if (cd) {
    dCountdown.textContent = cd;
    dCountdown.classList.remove("hidden");
  } else {
    dCountdown.classList.add("hidden");
  }

  // Action buttons
  dangerActionBtn.classList.add("hidden");
  
  if (isUpcoming) {
    primaryActionBtn.textContent = "Liên hệ hỗ trợ";
    secondaryActionBtn.textContent = "Xem chi tiết";
    if (canCancel) {
      dangerActionBtn.classList.remove("hidden");
      dangerActionBtn.textContent = penaltyAmount > 0 
        ? `Huỷ đơn (Phí phạt: ${formatMoney(penaltyAmount)})`
        : "Huỷ đơn";
    }
  } else {
    if (order.status === "completed") {
      primaryActionBtn.textContent = "Đặt lại";
      secondaryActionBtn.textContent = review ? "Xem đánh giá" : "Đánh giá";
    } else {
      primaryActionBtn.textContent = "Đặt lại";
      secondaryActionBtn.textContent = "Xem chi tiết";
    }
  }

  // Add review section
  const reviewSection = document.getElementById("reviewSection");
  if (reviewSection) {
    if (review) {
      reviewSection.classList.remove("hidden");
      reviewSection.innerHTML = `
        <div class="mt-3 bg-white border border-primary-300 rounded-2xl p-4">
          <div class="text-xs text-gray-500 mb-2">Đánh giá của bạn</div>
          <div class="flex items-center gap-2 mb-2">
            ${Array.from({ length: 5 }, (_, i) => `
              <span class="text-xl ${i < review.rating ? 'text-yellow-400' : 'text-gray-300'}">★</span>
            `).join("")}
          </div>
          ${review.comment ? `<p class="text-sm text-gray-700 mt-2">${review.comment}</p>` : ""}
        </div>
      `;
    } else if (order.status === "completed") {
      reviewSection.classList.remove("hidden");
      reviewSection.innerHTML = `
        <div class="mt-3 bg-gray-50 border border-gray-200 rounded-2xl p-4 text-center">
          <p class="text-sm text-gray-600">Bạn chưa đánh giá đơn hàng này</p>
        </div>
      `;
    } else {
      reviewSection.classList.add("hidden");
    }
  }

  // Show note if exists
  if (order.note) {
    const noteSection = document.getElementById("noteSection");
    if (!noteSection) {
      const noteDiv = document.createElement("div");
      noteDiv.id = "noteSection";
      noteDiv.className = "mt-3 bg-gray-50 border border-gray-200 rounded-2xl p-4";
      noteDiv.innerHTML = `
        <div class="text-xs text-gray-500 mb-1">Ghi chú</div>
        <p class="text-sm text-gray-700">${order.note}</p>
      `;
      dPaymentNote.parentElement.parentElement.after(noteDiv);
    } else {
      noteSection.innerHTML = `
        <div class="text-xs text-gray-500 mb-1">Ghi chú</div>
        <p class="text-sm text-gray-700">${order.note}</p>
      `;
      noteSection.classList.remove("hidden");
    }
  }
}

// Close detail sheet
function closeDetail() {
  sheetBackdrop.classList.add("hidden");
  sheet.classList.add("hidden");
}

// Set active tab
function setTab(tab) {
  if (tab === "upcoming") {
    tabUpcoming.className =
      "flex-1 py-2 rounded-xl text-sm font-bold bg-white text-dark-900";
    tabHistory.className =
      "flex-1 py-2 rounded-xl text-sm font-bold text-primary-600 hover:text-dark-900";
    upcomingSection.classList.remove("hidden");
    historySection.classList.add("hidden");
  } else {
    tabHistory.className =
      "flex-1 py-2 rounded-xl text-sm font-bold bg-white text-dark-900";
    tabUpcoming.className =
      "flex-1 py-2 rounded-xl text-sm font-bold text-primary-600 hover:text-dark-900";
    historySection.classList.remove("hidden");
    upcomingSection.classList.add("hidden");
  }
}

// Cancel order
async function cancelOrder(orderId) {
  if (!confirm("Bạn có chắc chắn muốn hủy đơn hàng này?")) {
    return;
  }

  try {
    const res = await fetch(
      `http://localhost:3000/api/order/cancel/${orderId}`,
      {
        method: "PUT",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`
        },
        body: JSON.stringify({ reason: "Khách hàng hủy đơn" })
      }
    );

    const result = await res.json();

    if (res.ok && result.success) {
      alert("Hủy đơn hàng thành công");
      closeDetail();
      await fetchOrders(); // Refresh orders
    } else {
      alert(result.message || "Không thể hủy đơn hàng");
    }
  } catch (error) {
    console.error("Error canceling order:", error);
    alert("Có lỗi xảy ra khi hủy đơn hàng");
  }
}

// Event listeners
tabUpcoming.addEventListener("click", () => setTab("upcoming"));
tabHistory.addEventListener("click", () => setTab("history"));
closeSheetBtn.addEventListener("click", closeDetail);
sheetBackdrop.addEventListener("click", closeDetail);

searchInput.addEventListener("input", (e) => {
  currentQuery = (e.target.value || "").trim();
  render();
});

primaryActionBtn.addEventListener("click", () => {
  alert("Tính năng đang phát triển");
});

secondaryActionBtn.addEventListener("click", () => {
  alert("Tính năng đang phát triển");
});

dangerActionBtn.addEventListener("click", () => {
  if (currentOrderDetail && currentOrderDetail.order && currentOrderDetail.order._id) {
    const penaltyMsg = currentOrderDetail.penaltyAmount > 0 
      ? `\n\nLưu ý: Bạn sẽ bị phạt ${formatMoney(currentOrderDetail.penaltyAmount)} khi hủy đơn này.`
      : "";
    if (confirm(`Bạn có chắc chắn muốn hủy đơn hàng này?${penaltyMsg}`)) {
      cancelOrder(currentOrderDetail.order._id);
    }
  }
});

// Initialize
fetchOrders();
setTab("upcoming");
