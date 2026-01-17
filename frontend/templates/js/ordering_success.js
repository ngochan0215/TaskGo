let bookingDraft = null;

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

function loadBookingDraft() {
  const raw = localStorage.getItem("bookingDraft");
  if (raw) {
    bookingDraft = JSON.parse(raw);
    console.log("BOOKING DRAFT: ", bookingDraft);
    return;
  }
  
  // Try to load from orderCreated as fallback (when bookingDraft was cleared after order creation)
  const orderRaw = localStorage.getItem("orderCreated");
  if (orderRaw) {
    const order = JSON.parse(orderRaw);
    console.log("ORDER CREATED: ", order);
    // Convert order to bookingDraft format
    bookingDraft = {
      task_snapshot: order.task_snapshot,
      task_payload: order.task_payload,
      address_snapshot: order.address_snapshot,
      base_amount: order.base_amount,
      final_amount: order.final_amount,
      note: order.note,
      scheduled_at: order.scheduled_at,
      type: order.type,
      voucher_snapshot: order.voucher_snapshot
    };
    return;
  }
  
  console.warn("No bookingDraft or orderCreated found in localStorage");
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
  if (!el || !bookingDraft) return;

  const serviceCode = bookingDraft.task_snapshot?.code || "DEFAULT";
  const renderer = serviceRenderers[serviceCode] || serviceRenderers.DEFAULT;
  const payload = bookingDraft.task_payload || {};

  const scheduledInfo = bookingDraft.scheduled_at && bookingDraft.type === "scheduled"
    ? `<div class="bg-blue-50 p-3 rounded-lg mt-3 border border-blue-200">
        <p class="text-sm font-semibold text-blue-700 flex items-center">
          <span class="material-symbols-outlined text-sm mr-1">schedule</span>
          Đã lên lịch
        </p>
        <p class="text-sm text-blue-600 mt-1">
          ${formatDate(bookingDraft.scheduled_at)} lúc ${formatTime(bookingDraft.scheduled_at)}
        </p>
      </div>`
    : "";

  el.innerHTML = `
    <div class="space-y-2">
      <h4 class="font-bold text-dark-900 text-lg mb-2">
        ${bookingDraft.task_snapshot?.name || "Dịch vụ"}
      </h4>
      <div class="text-base text-dark-500 space-y-1">
        ${renderer(payload)}
      </div>
      ${scheduledInfo}
      ${
        bookingDraft.note
          ? `<div class="bg-gray-50 p-3 rounded-lg mt-3">
              <p class="text-sm"><strong class="text-primary-500">📝 Ghi chú:</strong></p>
              <p class="text-sm text-gray-700 mt-1">${bookingDraft.note}</p>
            </div>`
          : ""
      }
    </div>
  `;
}

function renderAddressDetails() {
  const el = document.getElementById("addressDetails");
  if (!el || !bookingDraft) return;

  const address = bookingDraft.address_snapshot;
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
  if (!el || !bookingDraft) return;

  const now = new Date();
  const paymentDate = formatDate(now.toISOString());
  const paymentTime = formatTime(now.toISOString());

  el.innerHTML = `
    <div class="space-y-3">
      <div class="flex justify-between items-center">
        <span class="text-gray-600">Tổng tiền dịch vụ</span>
        <span class="font-semibold text-dark-900">${formatCurrency(bookingDraft.base_amount || bookingDraft.final_amount)}</span>
      </div>
      ${
        bookingDraft.voucher_snapshot
          ? `<div class="flex justify-between items-center">
              <span class="text-gray-600">Mã giảm giá</span>
              <span class="font-semibold text-green-600">-${formatCurrency(bookingDraft.voucher_snapshot.discount_amount || 0)}</span>
            </div>`
          : ""
      }
      <div class="border-t border-gray-300 pt-3 flex justify-between items-center">
        <span class="font-bold text-dark-900 text-lg">Tổng tiền</span>
        <span class="font-bold text-primary-500 text-xl">${formatCurrency(bookingDraft.final_amount)}</span>
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

function renderTaskerSearchStatus(status = "searching", assignedTasker = null) {
  const el = document.getElementById("taskerSearchStatus");
  if (!el) return;

  if (status === "assigned" && assignedTasker) {
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
      `http://localhost:3000/api/order/${orderId}/find-tasker`,
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
      
      // Update order in localStorage if needed
      if (result.order) {
        localStorage.setItem("orderCreated", JSON.stringify(result.order));
      }
    } else {
      console.warn("Could not find tasker:", result.message);
      renderTaskerSearchStatus("error");
    }
  } catch (error) {
    console.error("Error finding tasker:", error);
    renderTaskerSearchStatus("error");
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

function initOrderingSuccess() {
  loadBookingDraft();
  
  if (!bookingDraft) {
    console.error("Failed to load booking draft");
    renderError();
    return;
  }

  renderServiceDetails();
  renderAddressDetails();
  renderPaymentDetails();
  
  // Check if we have an order ID and try to find tasker
  const orderRaw = localStorage.getItem("orderCreated");
  if (orderRaw) {
    try {
      const order = JSON.parse(orderRaw);
      if (order._id && order.type === "immediate" && order.status === "pending") {
        // Show searching status first
        renderTaskerSearchStatus("searching");
        // Then try to find tasker
        findTaskerForOrder(order._id);
      } else if (order.tasker_id || order.status !== "pending") {
        // Already has tasker or not pending
        renderTaskerSearchStatus("assigned", order.tasker_id);
      } else {
        renderTaskerSearchStatus("searching");
      }
    } catch (err) {
      console.error("Error parsing order:", err);
      renderTaskerSearchStatus("searching");
    }
  } else {
    // No order found, just show searching status
    renderTaskerSearchStatus("searching");
  }
}

document.addEventListener("DOMContentLoaded", initOrderingSuccess);
