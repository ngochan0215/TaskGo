// khai báo các biến cần thiết
let bookingDraft = null;
let voucherDraft = null;
let task_code = null;
let houseCleaning_baseAmount = 0;

const formatCurrency = (v) => Number(v || 0).toLocaleString("vi-VN") + " VND";

const houseTypeMap = {
  apartment: "Căn hộ",
  townhouse: "Nhà phố",
  office: "Văn phòng",
  shop: "Cửa hàng"
};

const serviceRenderers = {
  COOKING: (p) => `
    <p>👥 Nấu cho: ${p.people} người</p>
    <p>🍽️ Số món: ${p.dishes}</p>
    <p>⏱️ Thời gian làm việc: ${Math.floor(p.total_time / 60)}h ${p.total_time % 60}p</p>
    <p>📋 Danh sách món ăn:</p>
    <ul>
      ${
        p.dish_list
          ? p.dish_list
              .split('\n')
              .map(dish => `<li>${dish}</li>`)
              .join('')
          : '<li>Không có</li>'
      }
    </ul>
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
    <p>🛒 Tổng số sản phẩm: <strong>${p.items.length}</strong></p>
    <div class="mt-2 space-y-1">
      ${p.items.map(item => `
        <p>🧺 ${item.name}</strong> - <span>${item.quantity} ${item.unit}</span></p>
      `).join("")}
    </div>
    ${p.estimated_budget
      ? `<p class="mt-2">💰 Ngân sách ước tính: ${Number(p.estimated_budget).toLocaleString()}đ</p>`
      : ""
    }
    <p><strong>Lưu ý tổng tiền cần thanh toán sẽ là Tổng Phí dịch vụ + Ngân sách ước tính</strong></p>
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
                <strong>${houseTypeMap[p.house_type]}</strong>
              </p>`
            : ""
        }
        <p>🧾 Tiền dịch vụ gốc (chưa thêm dịch vụ kèm theo): 
          <strong>${houseCleaning_baseAmount}</strong>
        </p>
        ${
          extrasArr.length
            ? `
              <div class="mt-2">
                <p>🧩 Dịch vụ thêm:</p>
                <ul class="ml-4 list-disc list-inside space-y-1">
                  ${extrasArr.map(e => `
                    <li class="ml-10 pl-2 text-m text-dark-300">
                      ${e.name} (+${Number(e.price).toLocaleString()}đ/giờ)
                    </li>
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
      ${p.child_ages
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
    <p class="mt-2 font-semibold">🧾 Tổng cộng: ${p.final_amount.toLocaleString()}đ</p>
  `,

  SICK: (p) => `
    <p>⏱️ Thời gian làm việc: ${Math.floor(p.total_time / 60)}h ${p.total_time % 60}p</p>
    <p class="mt-2 font-semibold">🧾 Tổng cộng: ${p.final_amount.toLocaleString()}đ</p>
  `,

  AIRCONDITIONER: (p) => `
    ${p.devices.map((d, i) => `
      <div class="ml-3 mt-2">
        <p>🔧 <strong>Thiết bị ${i + 1}: ${d.label}</strong></p>
        <p>⚡ Công suất: ${d.hp === "below_2" ? "Dưới 2 HP" : "Từ 2 HP trở lên"}</p>
        <p>🛢️ Bơm gas: ${d.has_gas ? "Có" : "Không"}</p>
        <p>💰 Giá: ${d.amount.toLocaleString()}đ</p>
      </div>
    `).join("")}

    <p class="mt-2 font-semibold">🧾 Tổng cộng: ${p.final_amount.toLocaleString()}đ</p>
  `,

  WASHING_MACHINE: (p) => `
    ${p.devices.map((d, i) => `
      <div class="ml-3 mt-2">
        <p>🔧 <strong>Thiết bị ${i + 1}: ${d.label}</strong></p>
        <p>⚡ Khối lượng lồng giặt: ${d.capacity === "below_9" ? "Dưới 9 Kg" : "Từ 9 Kg trở lên"}</p>
        <p>🛢️ Tháo lồng giặt: ${d.remove ? "Có" : "Không"}</p>
        <p>💰 Giá: ${d.amount.toLocaleString()}đ</p>
      </div>
    `).join("")}

    <p class="mt-2 font-semibold">🧾 Tổng cộng: ${p.final_amount.toLocaleString()}đ</p>
  `,

  DEFAULT: () =>
    `<p class="text-gray-400">Không có chi tiết dịch vụ</p>`
};

const raw = localStorage.getItem("bookingDraft");
if (!raw) {
  alert("Không tìm thấy thông tin đặt dịch vụ");
  location.href = "/";
}
bookingDraft = JSON.parse(raw);
console.log("BOOKING DRAFT BEFORE INIT ANYTHING: ", bookingDraft);

function initPaymentPage() {
  loadBookingDraft();
  initVoucherDraft();
  renderAmounts();
  renderServiceSummary();
  // bindAddressSelect();
  // loadMyAddresses();
}

function loadBookingDraft() {
  const raw = localStorage.getItem("bookingDraft");
  if (!raw) {
    alert("Không tìm thấy thông tin đặt dịch vụ");
    location.href = "/";
    return;
  }
  bookingDraft = JSON.parse(raw);
  task_code = bookingDraft.task_snapshot.code;
  if (task_code === "HOUSE_CLEANING") 
    houseCleaning_baseAmount = formatCurrency(bookingDraft.base_amount); 
  console.log("BOOKING DRAFT IN PAYMENT (loadBookingDraft): ", bookingDraft);
}

function initVoucherDraft() { 
  voucherDraft = JSON.parse(localStorage.getItem("voucherDraft")) || 
  { 
    base_amount: bookingDraft.final_amount, 
    voucher_code: null, 
    discount_amount: 0, 
    final_amount: bookingDraft.final_amount 
  }; 

  voucherDraft.base_amount = bookingDraft.base_amount; 
  localStorage.setItem("voucherDraft", JSON.stringify(voucherDraft)); 
  console.log("VOUCHER DRAFT IN PAYMENT (initVoucherDraft): ", voucherDraft); 
  
  bookingDraft.final_amount = voucherDraft.discount_amount? 
    voucherDraft.final_amount : bookingDraft.final_amount; 
  localStorage.setItem("bookingDraft", JSON.stringify(bookingDraft)); 
  console.log("BOOKING DRAFT IN PAYMENT (initVoucherDraft): ", bookingDraft); 
}

function renderAmounts() {
  document.getElementById("baseAmount").innerText =
    formatCurrency(bookingDraft.base_amount);

  document.getElementById("voucherAmount").innerText =
    voucherDraft.discount_amount
      ? `-${formatCurrency(voucherDraft.discount_amount)}`
      : "0 VND";

  if (task_code === "GROCERY") {
    document.getElementById("extraFee").innerText = formatCurrency(bookingDraft.task_payload.estimated_budget);
  } else {
    document.getElementById("extraFee").innerText = "0 VND";
  }

  if (task_code === "HOUSE_CLEANING") {
    document.getElementById("baseAmount").innerText = formatCurrency(bookingDraft.final_amount);
  } else {
    document.getElementById("extraFee").innerText = "0 VND";
  }

  document.getElementById("finalAmount").innerText =
    formatCurrency(bookingDraft.final_amount);

  document.getElementById("finalAmountt").innerText =
    formatCurrency(bookingDraft.final_amount);
}

function renderServiceSummary() {
  const el = document.getElementById("serviceSummary");

  console.log("BOOKING DRAFT IN PAYMENT (renderServiceSummary): ", bookingDraft);
  const serviceCode = bookingDraft.task_snapshot?.code || "DEFAULT";

  const renderer = serviceRenderers[serviceCode] || serviceRenderers.DEFAULT;

  const payload = bookingDraft.task_payload;
  console.log("PAYLOAD IN RENDER: ", payload);

  el.innerHTML = `
    <div>
      <p class="text-dark-400 font-bold">Thông tin Dịch vụ đã đặt</p>
    </div>

    <div class="border-b pb-2">
      <p class="text-dark-400 font-semibold">
        ${bookingDraft.task_snapshot?.name || "Dịch vụ"}
      </p>
    </div>

    <div class="text-l semibold text-dark-500 space-y-1">
      ${renderer(payload || {})}
    </div>

    ${
      bookingDraft.note
        ? `<div class="bg-gray-50 p-2 rounded text-m">
            <strong class="text-red-600">Ghi chú:</strong>
            ${bookingDraft.note}
          </div>`
        : ""
    }
  `;
}

document.addEventListener("DOMContentLoaded", initPaymentPage);
