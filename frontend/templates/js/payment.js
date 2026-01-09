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

  bookingDraft.final_amount = voucherDraft.final_amount;
  localStorage.setItem("bookingDraft", JSON.stringify(bookingDraft));
}

function renderAmounts() {
  document.getElementById("baseAmount").innerText =
    formatCurrency(bookingDraft.base_amount);

  document.getElementById("voucherAmount").innerText =
    voucherDraft.discount_amount
      ? `-${formatCurrency(voucherDraft.discount_amount)}`
      : "0 VND";

  document.getElementById("finalAmount").innerText =
    formatCurrency(voucherDraft.final_amount);

  document.getElementById("finalAmountt").innerText =
    formatCurrency(voucherDraft.final_amount);
}

function renderServiceSummary() {
  const el = document.getElementById("serviceSummary");

  console.log("BOOKING DRAFT: ", bookingDraft);
  const serviceCode = bookingDraft.task_snapshot?.code || "DEFAULT";

  const renderer = serviceRenderers[serviceCode] || serviceRenderers.DEFAULT;

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
      ${renderer(bookingDraft.task_payload || {})}
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
