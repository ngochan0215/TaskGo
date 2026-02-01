const API_BASE = window.API_BASE || (typeof window.CONFIG !== "undefined" && window.CONFIG.API_BASE_URL ? window.CONFIG.API_BASE_URL : "http://localhost:3000");
let addressMap = {};

let addressState = {
  full_address: "",
  city: "",
  district: "",
  ward: "",
  street: "",
  latitude: null,
  longitude: null,
};

let token = localStorage.getItem("token");
if (!token) {
    alert("Vui lòng đăng nhập");
    location.href = "../../auth/login-signup.html";
}
console.log("TOKEN: ", token);

let order_id = null;
let newOrder = null;
let payment_method = "cash";
let bookingDraft = null;
let voucherDraft = null;

const formatCurrency = (v) => Number(v || 0).toLocaleString("vi-VN") + " VND";

payment_method = document.querySelector("input[name='payment']:checked")?.value;
document.querySelectorAll("input[name='payment']").forEach(radio => {
    radio.addEventListener("change", e => {
        payment_method = e.target.value;
        console.log("LATEST PAYMENT METHOD:", payment_method);
    });
});

document.getElementById("submitBtn").addEventListener("click", submitOrder);

function loadBookingDraft() {
    const raw = localStorage.getItem("bookingDraft");
    if (!raw) {
      alert("Không tìm thấy thông tin đặt dịch vụ");
      location.href = "/";
      return;
    }
    bookingDraft = JSON.parse(raw);
    console.log("BOOKING DRAFT IN PAYMENT CONFIRMATION: ", bookingDraft);
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

function bindAddressSelect() {
    document
        .getElementById("addressSelect")
        .addEventListener("change", (e) => {
            saveSelectedAddress(e.target.value);
        });
}

async function loadMyAddresses() {
    try {
        const res = await fetch(
            `${API_BASE}/api/user/addresses/my`,
            {
                headers: {
                Authorization: `Bearer ${token}`
                }
            }
        );

        if (res.status === 401) {
            localStorage.removeItem("token");
            alert("Phiên đăng nhập hết hạn");
            location.href = "../../login-signup.html";
            return;
        }

        const { data } = await res.json();
        console.log("ADDRESSES: ", data);
        const select = document.getElementById("addressSelect");

        select.innerHTML = `<option value="">-- Chọn địa chỉ --</option>`;
        addressMap = {};

        if (!data || data.length === 0) {
            select.innerHTML += `<option disabled>Chưa có địa chỉ</option>`;
            return;
        }

        data.forEach((addr) => {
            addressMap[addr._id] = addr;

            const opt = document.createElement("option");
            opt.value = addr._id;
            opt.textContent = addr.full_address;

            if (addr.is_default) {
                opt.selected = true;
                saveSelectedAddress(addr._id);
            }

            select.appendChild(opt);
        });
    } catch (err) {
        console.error(err);
        alert("Không thể tải danh sách địa chỉ");
    }
}

function saveSelectedAddress(addressId) {
    if (!addressMap[addressId]) return;

    bookingDraft.address_id = addressId;
    bookingDraft.address_snapshot = {
        full_address: addressMap[addressId].full_address,
        latitude: addressMap[addressId].latitude,
        longitude: addressMap[addressId].longitude
    };

    localStorage.setItem("bookingDraft", JSON.stringify(bookingDraft));
}

// logic thêm địa chỉ
function openAddAddressModal() {
    // Reset address state for new address
    addressState = {
        full_address: "",
        city: "",
        district: "",
        ward: "",
        street: "",
        latitude: null,
        longitude: null,
    };
    
    const modal = document.getElementById("addressModal");
    modal.classList.remove("hidden");
    modal.classList.add("flex");
    
    // Reset form values
    document.getElementById('street').value = '';
    document.getElementById('result_lat').value = '';
    document.getElementById('result_lng').value = '';
    document.getElementById('result_city').value = '';
    document.getElementById('result_district').value = '';
    document.getElementById('result_ward').value = '';
    
    // Reset selects
    const elCity = document.getElementById('city');
    const elDistrict = document.getElementById('district');
    const elWard = document.getElementById('ward');
    elCity.innerHTML = '<option value="" selected disabled>Đang tải danh sách...</option>';
    elDistrict.innerHTML = '<option value="" selected disabled>-- Vui lòng chọn Tỉnh trước --</option>';
    elDistrict.disabled = true;
    elWard.innerHTML = '<option value="" selected disabled>-- Vui lòng chọn Quận trước --</option>';
    elWard.disabled = true;
    
    initAddressMapIfNeeded();
    
    // Invalidate map size after modal is shown
    setTimeout(() => {
        if (map) {
            map.invalidateSize();
        }
    }, 100);
}

window.openAddAddressModal = openAddAddressModal;

// logic xử lý phần địa chỉ
let map = null;
let marker = null;
let mapInitialized = false;
let selectsInitialized = false;

async function moveMapTo(query, zoomLevel) {
  if (!map || !marker) return;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
    const res = await fetch(url);
    const data = await res.json();

    if (data && data.length > 0) {
      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);
      const newLatLng = new L.LatLng(lat, lon);

      marker.setLatLng(newLatLng);
      map.setView(newLatLng, zoomLevel);

      document.getElementById('result_lat').value = lat;
      document.getElementById('result_lng').value = lon;
      addressState.latitude = lat;
      addressState.longitude = lon;
      console.log(`Đã bay tới: ${query}`);
    }
  } catch (e) { 
    console.error("Lỗi tìm map:", e); 
  }
}

function initAddressMap() {
  if (mapInitialized && map) return;
  
  const defaultCoords = addressState.latitude && addressState.longitude 
    ? [addressState.latitude, addressState.longitude]
    : [10.8231, 106.6297];
  
  map = L.map('map').setView(defaultCoords, 13);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { 
    attribution: '&copy; OpenStreetMap' 
  }).addTo(map);

  marker = L.marker(defaultCoords, { draggable: true }).addTo(map);

  if (addressState.latitude && addressState.longitude) {
    const latLng = new L.LatLng(addressState.latitude, addressState.longitude);
    marker.setLatLng(latLng);
    map.setView(latLng, 13);
    document.getElementById('result_lat').value = addressState.latitude;
    document.getElementById('result_lng').value = addressState.longitude;
  }
  
  setTimeout(() => {
    if (map) {
      map.invalidateSize();
    }
  }, 200);

  document.getElementById('btn-search-map').addEventListener('click', async function() {
    const city = document.getElementById('result_city').value;
    const district = document.getElementById('result_district').value;
    const ward = document.getElementById('result_ward').value;
    const street = document.getElementById('street').value;

    if (!city) { 
      alert("Vui lòng chọn Tỉnh/Thành phố!"); 
      return; 
    }

    if (street) {
      const query = `${street}, ${ward}, ${district}, ${city}`;
      const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data && data.length > 0) {
          moveMapTo(query, 17);
        } else {
          alert("Không tìm thấy số nhà này, nhưng nó chỉ ở gần đây thôi, bản đồ sẽ giữ nguyên vị trí ở Phường/Xã để bạn tự kéo ghim.");
        }
      } catch(e) { 
        console.error(e); 
      }
    } else {
      const latLng = marker.getLatLng();
      map.setView(latLng, 15);
    }
  });

  marker.on('dragend', () => {
    const pos = marker.getLatLng();
    addressState.latitude = pos.lat;
    addressState.longitude = pos.lng;
    document.getElementById('result_lat').value = pos.lat;
    document.getElementById('result_lng').value = pos.lng;
  });

  mapInitialized = true;
}

function initAddressSelects() {
  const host = "https://provinces.open-api.vn/api/";
  const elCity = document.getElementById('city');
  const elDistrict = document.getElementById('district');
  const elWard = document.getElementById('ward');

  // Load city list every time (in case modal was closed and reopened)
  fetch(host + "?depth=1").then(res => res.json()).then(data => {
    let html = '<option value="" selected disabled>Chọn Tỉnh / Thành phố</option>';
    data.forEach(item => html += `<option value="${item.code}" data-name="${item.name}">${item.name}</option>`);
    elCity.innerHTML = html;
    
    // Try to select existing city if available (only when editing, not when adding new)
    if (addressState.city && addressState.latitude) {
      const cityOption = Array.from(elCity.options).find(opt => opt.getAttribute('data-name') === addressState.city);
      if (cityOption) {
        elCity.value = cityOption.value;
        elCity.dispatchEvent(new Event('change'));
      }
    }
  });

  // Only set up event listeners once
  if (selectsInitialized) return;

  elCity.addEventListener('change', function() {
    const cityName = this.options[this.selectedIndex].getAttribute('data-name');
    document.getElementById('result_city').value = cityName;
    addressState.city = cityName;

    moveMapTo(cityName, 10);

    elDistrict.innerHTML = '<option value="" selected disabled>Đang tải...</option>';
    elDistrict.disabled = true;
    elWard.innerHTML = '<option value="" selected disabled>-- Vui lòng chọn Quận trước --</option>';
    elWard.disabled = true;

    fetch(host + "p/" + this.value + "?depth=2").then(res => res.json()).then(data => {
      let html = '<option value="" selected disabled>Chọn Quận / Huyện</option>';
      data.districts.forEach(item => html += `<option value="${item.code}" data-name="${item.name}">${item.name}</option>`);
      elDistrict.innerHTML = html;
      elDistrict.disabled = false;
      
      // Try to select existing district if available (only when editing, not when adding new)
      if (addressState.district && addressState.latitude) {
        const distOption = Array.from(elDistrict.options).find(opt => opt.getAttribute('data-name') === addressState.district);
        if (distOption) {
          elDistrict.value = distOption.value;
          elDistrict.dispatchEvent(new Event('change'));
        }
      }
    });
  });

  elDistrict.addEventListener('change', function() {
    const distName = this.options[this.selectedIndex].getAttribute('data-name');
    const cityName = document.getElementById('result_city').value;
    document.getElementById('result_district').value = distName;
    addressState.district = distName;

    moveMapTo(`${distName}, ${cityName}`, 13);

    elWard.innerHTML = '<option value="" selected disabled>Đang tải...</option>';
    elWard.disabled = true;

    fetch(host + "d/" + this.value + "?depth=2").then(res => res.json()).then(data => {
      let html = '<option value="" selected disabled>Chọn Phường / Xã</option>';
      data.wards.forEach(item => html += `<option value="${item.code}" data-name="${item.name}">${item.name}</option>`);
      elWard.innerHTML = html;
      elWard.disabled = false;
      
      // Try to select existing ward if available (only when editing, not when adding new)
      if (addressState.ward && addressState.latitude) {
        const wardOption = Array.from(elWard.options).find(opt => opt.getAttribute('data-name') === addressState.ward);
        if (wardOption) {
          elWard.value = wardOption.value;
          elWard.dispatchEvent(new Event('change'));
        }
      }
    });
  });

  elWard.addEventListener('change', function() {
    const wardName = this.options[this.selectedIndex].getAttribute('data-name');
    const distName = document.getElementById('result_district').value;
    const cityName = document.getElementById('result_city').value;
    document.getElementById('result_ward').value = wardName;
    addressState.ward = wardName;

    moveMapTo(`${wardName}, ${distName}, ${cityName}`, 15);
  });
  
  selectsInitialized = true;
}

function initAddressMapIfNeeded() {
  if (!mapInitialized) {
    setTimeout(() => {
      initAddressMap();
      initAddressSelects();
    }, 100);
  } else {
    // Update map position if address state has changed
    if (addressState.latitude && addressState.longitude && map && marker) {
      const latLng = new L.LatLng(addressState.latitude, addressState.longitude);
      marker.setLatLng(latLng);
      map.setView(latLng, 13);
      map.invalidateSize();
    }
  }
}

async function saveAddress() {
  const lat = document.getElementById('result_lat').value;
  const lng = document.getElementById('result_lng').value;
  const city = document.getElementById('result_city').value;
  const district = document.getElementById('result_district').value;
  const ward = document.getElementById('result_ward').value;
  const street = document.getElementById('street').value;

  if (!lat || !lng) {
    alert("Vui lòng xác định vị trí trên bản đồ");
    return;
  }

  if (!city || !district || !ward) {
    alert("Vui lòng chọn đầy đủ Tỉnh/Thành phố, Quận/Huyện và Phường/Xã");
    return;
  }

  const full_address = [street, ward, district, city]
    .filter(Boolean)
    .join(", ");

  const payload = {
    full_address,
    street: street || "",
    ward,
    district,
    city,
    longitude: parseFloat(lng),
    latitude: parseFloat(lat),
  };

  console.log("PAYLOAD IN SAVE ADDRESS: ", payload);

  try {
    const res = await fetch(
      "http://localhost:3000/api/user/addresses",
      {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
      }
    );

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Thêm địa chỉ thất bại");
      return;
    }

    await loadMyAddresses();
    closeAddressModal();
    alert("✅ Thêm địa chỉ thành công");

  } catch (err) {
    console.error("Add address error:", err);
    alert("Có lỗi khi thêm địa chỉ");
  }
}

function closeAddressModal() {
    const modal = document.getElementById("addressModal");
    modal.classList.add("hidden");
    modal.classList.remove("flex");

    // reset map state
    if (map) {
        map.remove();
        map = null;
    }
    marker = null;
    mapInitialized = false;
}

async function createPaymentLink(orderId, receiptId) {
    console.log("ORDER ID IN CREATE PAYMENT LINK: ", orderId);
    console.log("BOOKING DRAFT IN CREATE PAYMENT LINK: ", bookingDraft);
    console.log("VOUCHER DRAFT IN CREATE PAYMENT LINK: ", voucherDraft);

    // const amount =
    //     (voucherDraft && typeof voucherDraft.final_amount === "number"
    //         ? voucherDraft.final_amount
    //         : bookingDraft?.base_amount) || 0;

    const amount = bookingDraft.final_amount;

    const shortOrderId = orderId.toString().slice(-6);

    const transactionPayload = {
        order_id: orderId,
        receipt_id: receiptId,
        amount,
        description: `TT DH ${shortOrderId}`,
        items: [
            {
                name: bookingDraft?.task_snapshot?.name || "TaskGo service",
                quantity: 1,
                price: amount,
            },
        ],
    };

    const res = await fetch(
        `${API_BASE}/api/transaction/paymentLink/${newOrder.customer_id}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`
            },
            body: JSON.stringify(transactionPayload)
        }
    );

    const result = await res.json();

    if (!res.ok || !result.success) {
        alert(result.message || result.error || "Không thể tạo link thanh toán");
        return null;
    }

    return result.data; // PayOS payment link object (checkoutUrl, orderCode, id,...)
}

async function createOrderReceipt() {
    const payload = { order_id, payment_method };
    console.log("PAYLOAD FOR RECEIPT: ", payload);

    const res = await fetch(`${API_BASE}/api/order/receipt/add`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    const result = await res.json();

    // Accept either {success:true} or legacy responses with {data:...}
    const ok = res.ok && (result?.success === true || result?.data);

    if (!ok) {
        alert(result.message || "Tạo hóa đơn cho đơn hàng thất bại!");
        return null;
    }

    console.log("RECEIPT CREATED:", result.data);
    return result;
}

async function submitOrder() {
    const payload = {
        ...bookingDraft
    };

    console.log("payload in submit order (UI): ", payload);

    if (!bookingDraft.address_id) {
        alert("Vui lòng chọn địa chỉ làm việc");
        return;
    }

    // Prevent creating scheduled order with invalid payment method
    if (bookingDraft.type === "scheduled" && payment_method !== "bank_transfer") {
        alert("Đơn đặt lịch chỉ được thanh toán bằng chuyển khoản ngân hàng. Vui lòng chọn 'Chuyển khoản ngân hàng (Mã QR)'.");
        return;
    }

    // If an order was already created in this flow, reuse it to avoid double voucher usage
    try {
        const existingOrder = JSON.parse(localStorage.getItem("orderCreated") || "null");
        const existingOrderId = existingOrder?._id;
        const existingTaskId = existingOrder?.task_id?._id || existingOrder?.task_id;
        const draftTaskId = bookingDraft?.task_id?._id || bookingDraft?.task_id;

        if (
            existingOrderId &&
            existingOrder?.status === "pending" &&
            existingOrder?.type === bookingDraft?.type &&
            existingTaskId &&
            draftTaskId &&
            String(existingTaskId) === String(draftTaskId)
        ) {
            order_id = existingOrderId;
            newOrder = existingOrder;

            const receiptExisting = await createOrderReceipt();
            const receiptIdExisting =
                receiptExisting?.data?._id ||
                receiptExisting?.data?.receipt?._id ||
                receiptExisting?.data?.receipt?.id;

            if (!receiptExisting || !receiptIdExisting) return;

            if (payment_method === "cash") {
                bookingDraft = null;
                voucherDraft = null;
                localStorage.removeItem("bookingDraft");
                localStorage.removeItem("voucherDraft");
                location.href = `./ordering_success.html?orderId=${order_id}`;
                return;
            }

            if (payment_method === "bank_transfer") {
                const paymentLink = await createPaymentLink(order_id, receiptIdExisting);
                if (!paymentLink || !paymentLink.checkoutUrl) {
                    alert("Không tạo được link thanh toán");
                    return;
                }

                localStorage.setItem("paymentPending", JSON.stringify({
                    order_id,
                    paymentId: paymentLink.id,
                    orderCode: paymentLink.orderCode
                }));

                bookingDraft = null;
                voucherDraft = null;
                localStorage.removeItem("bookingDraft");
                localStorage.removeItem("voucherDraft");

                window.location.href = paymentLink.checkoutUrl;
                return;
            }
        }
    } catch (e) {
        console.warn("Cannot reuse existing orderCreated:", e);
    }

    const res = await fetch(`${API_BASE}/api/order/create`, {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`
        },
        body: JSON.stringify(payload)
    });

    const result = await res.json();

    if (!res.ok) {
        alert(result.message || "Tạo đơn hàng thất bại");
        return;
    }

    console.log("ORDER CREATED:", result.order);
    newOrder = result.order;
    order_id = result.order._id;
    localStorage.setItem("orderCreated", JSON.stringify(result.order));

    // tạo hóa đơn
    const receipt = await createOrderReceipt();

    // If receipt creation failed, DO NOT redirect/clear drafts.
    const receiptId =
        receipt?.data?._id ||
        receipt?.data?.receipt?._id ||
        receipt?.data?.receipt?.id;

    if (!receipt || !receiptId) {
        return;
    }

    if (payment_method === "cash") {
      // Clear all drafts after order creation to avoid conflicts
      bookingDraft = null;
      voucherDraft = null;
      localStorage.removeItem("bookingDraft");
      localStorage.removeItem("voucherDraft");

      // Pass orderId as URL parameter
      location.href = `./ordering_success.html?orderId=${order_id}`;
    }
    else if (payment_method === "bank_transfer") {
        const paymentLink = await createPaymentLink(order_id, receiptId);

        if (!paymentLink || !paymentLink.checkoutUrl) {
            alert("Không tạo được link thanh toán");
            return;
        }

        // Lưu thông tin để success page check lại
        localStorage.setItem("paymentPending", JSON.stringify({
          order_id,
          paymentId: paymentLink.id,
          orderCode: paymentLink.orderCode
        }));

        // Clear all drafts after order creation to avoid conflicts
        bookingDraft = null;
        voucherDraft = null;
        localStorage.removeItem("bookingDraft");
        localStorage.removeItem("voucherDraft");

        // Redirect sang PayOS
        window.location.href = paymentLink.checkoutUrl;
    }
}

loadBookingDraft();
initVoucherDraft();
renderAmounts();
bindAddressSelect();
loadMyAddresses();

window.openAddAddressModal = openAddAddressModal;
window.closeAddressModal = closeAddressModal;
window.saveAddress = saveAddress;

console.log("FINAL BOOKING DRAFT: ", bookingDraft);
//document.addEventListener("DOMContentLoaded");