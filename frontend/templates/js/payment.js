// khai báo các biến cần thiết
let addressMap = {};
let bookingDraft = null;
let voucherDraft = null;

const formatCurrency = (v) => Number(v || 0).toLocaleString("vi-VN") + " VND";

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
}

function initVoucherDraft() {
  voucherDraft =
    JSON.parse(localStorage.getItem("voucherDraft")) || {
      base_amount: bookingDraft.base_amount,
      voucher_code: null,
      discount_amount: 0,
      final_amount: bookingDraft.base_amount
    };

  voucherDraft.base_amount = bookingDraft.base_amount;
  localStorage.setItem("voucherDraft", JSON.stringify(voucherDraft));

  bookingDraft.final_amount = voucherDraft.discount_amount? 
    voucherDraft.final_amount : bookingDraft.final_amount;
  localStorage.setItem("bookingDraft", JSON.stringify(bookingDraft));
}

function renderAmounts() {
  document.getElementById("baseAmount").innerText =
    formatCurrency(bookingDraft.final_amount);

  document.getElementById("voucherAmount").innerText =
    voucherDraft.discount_amount
      ? `-${formatCurrency(voucherDraft.discount_amount)}`
      : "0 VND";

  document.getElementById("finalAmount").innerText =
    formatCurrency(bookingDraft.final_amount);

  document.getElementById("finalAmountt").innerText =
    formatCurrency(bookingDraft.final_amount);
}

function renderServiceSummary() {
  const el = document.getElementById("serviceSummary");

  console.log("BOOKING DRAFT IN PAYMENT: ", bookingDraft);
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

// function bindAddressSelect() {
//   document
//     .getElementById("addressSelect")
//     .addEventListener("change", (e) => {
//       saveSelectedAddress(e.target.value);
//     });
// }

// async function loadMyAddresses() {
//   try {
//     const token = localStorage.getItem("token");
//     if (!token) {
//       alert("Vui lòng đăng nhập");
//       location.href = "../auth/login-signup.html";
//       return;
//     }

//     const res = await fetch(
//       "http://localhost:3000/api/user/addresses/my",
//       {
//         headers: {
//           Authorization: `Bearer ${token}`
//         }
//       }
//     );

//     if (res.status === 401) {
//       localStorage.removeItem("token");
//       alert("Phiên đăng nhập hết hạn");
//       location.href = "../auth/login-signup.html";
//       return;
//     }

//     const { data } = await res.json();
//     const select = document.getElementById("addressSelect");

//     select.innerHTML = `<option value="">-- Chọn địa chỉ --</option>`;
//     addressMap = {};

//     if (!data || data.length === 0) {
//       select.innerHTML += `<option disabled>Chưa có địa chỉ</option>`;
//       return;
//     }

//     data.forEach((addr) => {
//       addressMap[addr._id] = addr;

//       const opt = document.createElement("option");
//       opt.value = addr._id;
//       opt.textContent = addr.full_address;

//       if (addr.is_default) {
//         opt.selected = true;
//         saveSelectedAddress(addr._id);
//       }

//       select.appendChild(opt);
//     });
//   } catch (err) {
//     console.error(err);
//     alert("Không thể tải danh sách địa chỉ");
//   }
// }

// function saveSelectedAddress(addressId) {
//   if (!addressMap[addressId]) return;

//   bookingDraft.address_id = addressId;
//   bookingDraft.address_snapshot = {
//     full_address: addressMap[addressId].full_address,
//     latitude: addressMap[addressId].latitude,
//     longtitude: addressMap[addressId].longtitude
//   };

//   localStorage.setItem("bookingDraft", JSON.stringify(bookingDraft));
// }

document.addEventListener("DOMContentLoaded", initPaymentPage);
