const API_BASE = window.API_BASE || (typeof window.CONFIG !== "undefined" && window.CONFIG.API_BASE_URL ? window.CONFIG.API_BASE_URL : "http://localhost:3000");
let isEditing = false;
let addresses = [];

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
  alert("Chưa đăng nhập! Vui lòng đăng nhập để truy cập.");
  window.location.href = "../auth/login-signup.html";
}
console.log("TOKEN: ", token);

const editBtn = document.getElementById("editToggle");
const updateBtn = document.getElementById("updateBtn");

const editableInputs = [
  document.getElementById("phone"),
  document.getElementById("full-name-input"),
  document.getElementById("cccd"),
  document.getElementById("bin"),
  document.getElementById("account-number"),
].filter(Boolean);

// Bank data storage
let bankData = {};
let bankSelect = document.getElementById("bank-select");

editBtn.addEventListener("click", () => {
  isEditing = !isEditing;

  editableInputs.forEach((input) => {
    input.readOnly = !isEditing;
    input.classList.toggle("bg-white", isEditing);
  });

  // Enable/disable bank select
  if (bankSelect) {
    bankSelect.disabled = !isEditing;
    bankSelect.classList.toggle("bg-gray-50", !isEditing);
    bankSelect.classList.toggle("bg-white", isEditing);
  }

  updateBtn.disabled = !isEditing;
  updateBtn.classList.toggle("opacity-50", !isEditing);
  updateBtn.classList.toggle("cursor-not-allowed", !isEditing);

  editBtn.innerHTML = isEditing
    ? `<span>Hủy chỉnh sửa</span>
        <span class="material-symbols-outlined ml-1">close</span>`
    : `<span>Chỉnh sửa thông tin</span>
        <span class="material-symbols-outlined ml-1">edit</span>`;

  renderAddresses();
});

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

// Render rating stars based on average_rating
function renderRatingStars(rating) {
  const starsContainer = document.getElementById("stars-container");
  if (!starsContainer) return;

  const fullStars = Math.floor(rating);
  const hasHalfStar = rating % 1 >= 0.5;

  let starsHTML = "";

  // Full stars
  for (let i = 0; i < fullStars; i++) {
    starsHTML += '<span class="material-symbols-outlined text-xl">star</span>';
  }

  // Half star
  if (hasHalfStar && fullStars < 5) {
    starsHTML +=
      '<span class="material-symbols-outlined text-xl">star_half</span>';
  }

  // Empty stars
  const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
  for (let i = 0; i < emptyStars; i++) {
    starsHTML +=
      '<span class="material-symbols-outlined text-xl text-gray-300">star</span>';
  }

  starsContainer.innerHTML = starsHTML;
}

async function loadUserAddresses() {
  try {
    const res = await fetch("http://localhost:3000/api/user/addresses/my", {
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (res.status === 401) {
      localStorage.removeItem("token");
      alert("Token đã hết hạn hoặc không hợp lệ! Vui lòng đăng nhập lại.");
      window.location.href = "../auth/login-signup.html";
      return;
    }

    const result = await res.json();

    if (!res.ok) {
      alert(result.message || "Không lấy được địa chỉ");
      return;
    }

    addresses = result.data || [];
    console.log("ADDRESSES: ", addresses);
    renderAddresses();
  } catch (err) {
    console.error("Load address error:", err);
  }
}

function renderAddresses() {
  const container = document.getElementById("address");
  container.innerHTML = "";

  if (!addresses.length) {
    container.innerHTML = `<span class="text-gray-400">Chưa có địa chỉ</span>`;
  }

  addresses.forEach((addr) => {
    const div = document.createElement("div");
    div.className = `
            flex items-center gap-2 px-3 py-2 rounded-lg border
            ${addr.is_default ? "border-primary-500 bg-primary-50" : "border-gray-300 bg-gray-50"}
        `;

    div.innerHTML = `
            <span class="text-sm">${addr.full_address}</span>

            ${
              addr.is_default
                ? `
              <span class="material-symbols-outlined text-primary-500 text-sm">
                check_circle
              </span>
            `
                : ""
            }

            ${
              isEditing
                ? `
              <button onclick="deleteAddress('${addr._id}')"
                class="material-symbols-outlined text-red-500 text-sm">
                delete
              </button>
            `
                : ""
            }
        `;

    container.appendChild(div);
  });

  if (isEditing) {
    const addBtn = document.createElement("button");
    addBtn.className = `
          flex items-center gap-1 px-3 py-2 rounded-lg
          border border-dashed border-primary-400
          text-primary-500
        `;
    addBtn.innerHTML = `
          <span class="material-symbols-outlined text-sm">add</span>
          <span class="text-sm">Thêm địa chỉ</span>
        `;
    addBtn.onclick = openAddAddressModal;
    container.appendChild(addBtn);
  }
}

async function deleteAddress(addressId) {
  if (!confirm("Xóa địa chỉ này?")) return;

  try {
    const res = await fetch(
      `${API_BASE}/api/user/addresses/${addressId}`,
      {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${token}`,
        },
      },
    );

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Xóa địa chỉ thất bại");
      return;
    }

    addresses = addresses.filter((a) => a._id !== addressId);
    renderAddresses();
    location.reload();
  } catch (err) {
    console.error("Delete address error:", err);
    alert("Có lỗi khi xóa địa chỉ");
  }
}

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
  document.getElementById("street").value = "";
  document.getElementById("result_lat").value = "";
  document.getElementById("result_lng").value = "";
  document.getElementById("result_city").value = "";
  document.getElementById("result_district").value = "";
  document.getElementById("result_ward").value = "";

  // Reset selects
  const elCity = document.getElementById("city");
  const elDistrict = document.getElementById("district");
  const elWard = document.getElementById("ward");
  elCity.innerHTML =
    '<option value="" selected disabled>Đang tải danh sách...</option>';
  elDistrict.innerHTML =
    '<option value="" selected disabled>-- Vui lòng chọn Tỉnh trước --</option>';
  elDistrict.disabled = true;
  elWard.innerHTML =
    '<option value="" selected disabled>-- Vui lòng chọn Quận trước --</option>';
  elWard.disabled = true;

  initAddressMapIfNeeded();

  // Invalidate map size after modal is shown
  setTimeout(() => {
    if (map) {
      map.invalidateSize();
    }
  }, 100);
}

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

      document.getElementById("result_lat").value = lat;
      document.getElementById("result_lng").value = lon;
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

  const defaultCoords =
    addressState.latitude && addressState.longitude
      ? [addressState.latitude, addressState.longitude]
      : [10.8231, 106.6297];

  map = L.map("map").setView(defaultCoords, 13);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    attribution: "&copy; OpenStreetMap",
  }).addTo(map);

  marker = L.marker(defaultCoords, { draggable: true }).addTo(map);

  if (addressState.latitude && addressState.longitude) {
    const latLng = new L.LatLng(addressState.latitude, addressState.longitude);
    marker.setLatLng(latLng);
    map.setView(latLng, 13);
    document.getElementById("result_lat").value = addressState.latitude;
    document.getElementById("result_lng").value = addressState.longitude;
  }

  setTimeout(() => {
    if (map) {
      map.invalidateSize();
    }
  }, 200);

  document
    .getElementById("btn-search-map")
    .addEventListener("click", async function () {
      const city = document.getElementById("result_city").value;
      const district = document.getElementById("result_district").value;
      const ward = document.getElementById("result_ward").value;
      const street = document.getElementById("street").value;

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
            alert(
              "Không tìm thấy số nhà này, nhưng nó chỉ ở gần đây thôi, bản đồ sẽ giữ nguyên vị trí ở Phường/Xã để bạn tự kéo ghim.",
            );
          }
        } catch (e) {
          console.error(e);
        }
      } else {
        const latLng = marker.getLatLng();
        map.setView(latLng, 15);
      }
    });

  marker.on("dragend", () => {
    const pos = marker.getLatLng();
    addressState.latitude = pos.lat;
    addressState.longitude = pos.lng;
    document.getElementById("result_lat").value = pos.lat;
    document.getElementById("result_lng").value = pos.lng;
  });

  mapInitialized = true;
}

function initAddressSelects() {
  const host = "https://provinces.open-api.vn/api/";
  const elCity = document.getElementById("city");
  const elDistrict = document.getElementById("district");
  const elWard = document.getElementById("ward");

  // Load city list every time (in case modal was closed and reopened)
  fetch(host + "?depth=1")
    .then((res) => res.json())
    .then((data) => {
      let html =
        '<option value="" selected disabled>Chọn Tỉnh / Thành phố</option>';
      data.forEach(
        (item) =>
          (html += `<option value="${item.code}" data-name="${item.name}">${item.name}</option>`),
      );
      elCity.innerHTML = html;

      // Try to select existing city if available (only when editing, not when adding new)
      if (addressState.city && addressState.latitude) {
        const cityOption = Array.from(elCity.options).find(
          (opt) => opt.getAttribute("data-name") === addressState.city,
        );
        if (cityOption) {
          elCity.value = cityOption.value;
          elCity.dispatchEvent(new Event("change"));
        }
      }
    });

  // Only set up event listeners once
  if (selectsInitialized) return;

  elCity.addEventListener("change", function () {
    const cityName = this.options[this.selectedIndex].getAttribute("data-name");
    document.getElementById("result_city").value = cityName;
    addressState.city = cityName;

    moveMapTo(cityName, 10);

    elDistrict.innerHTML =
      '<option value="" selected disabled>Đang tải...</option>';
    elDistrict.disabled = true;
    elWard.innerHTML =
      '<option value="" selected disabled>-- Vui lòng chọn Quận trước --</option>';
    elWard.disabled = true;

    fetch(host + "p/" + this.value + "?depth=2")
      .then((res) => res.json())
      .then((data) => {
        let html =
          '<option value="" selected disabled>Chọn Quận / Huyện</option>';
        data.districts.forEach(
          (item) =>
            (html += `<option value="${item.code}" data-name="${item.name}">${item.name}</option>`),
        );
        elDistrict.innerHTML = html;
        elDistrict.disabled = false;

        // Try to select existing district if available (only when editing, not when adding new)
        if (addressState.district && addressState.latitude) {
          const distOption = Array.from(elDistrict.options).find(
            (opt) => opt.getAttribute("data-name") === addressState.district,
          );
          if (distOption) {
            elDistrict.value = distOption.value;
            elDistrict.dispatchEvent(new Event("change"));
          }
        }
      });
  });

  elDistrict.addEventListener("change", function () {
    const distName = this.options[this.selectedIndex].getAttribute("data-name");
    const cityName = document.getElementById("result_city").value;
    document.getElementById("result_district").value = distName;
    addressState.district = distName;

    moveMapTo(`${distName}, ${cityName}`, 13);

    elWard.innerHTML =
      '<option value="" selected disabled>Đang tải...</option>';
    elWard.disabled = true;

    fetch(host + "d/" + this.value + "?depth=2")
      .then((res) => res.json())
      .then((data) => {
        let html =
          '<option value="" selected disabled>Chọn Phường / Xã</option>';
        data.wards.forEach(
          (item) =>
            (html += `<option value="${item.code}" data-name="${item.name}">${item.name}</option>`),
        );
        elWard.innerHTML = html;
        elWard.disabled = false;

        // Try to select existing ward if available (only when editing, not when adding new)
        if (addressState.ward && addressState.latitude) {
          const wardOption = Array.from(elWard.options).find(
            (opt) => opt.getAttribute("data-name") === addressState.ward,
          );
          if (wardOption) {
            elWard.value = wardOption.value;
            elWard.dispatchEvent(new Event("change"));
          }
        }
      });
  });

  elWard.addEventListener("change", function () {
    const wardName = this.options[this.selectedIndex].getAttribute("data-name");
    const distName = document.getElementById("result_district").value;
    const cityName = document.getElementById("result_city").value;
    document.getElementById("result_ward").value = wardName;
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
      const latLng = new L.LatLng(
        addressState.latitude,
        addressState.longitude,
      );
      marker.setLatLng(latLng);
      map.setView(latLng, 13);
      map.invalidateSize();
    }
  }
}

async function saveAddress() {
  const lat = document.getElementById("result_lat").value;
  const lng = document.getElementById("result_lng").value;
  const city = document.getElementById("result_city").value;
  const district = document.getElementById("result_district").value;
  const ward = document.getElementById("result_ward").value;
  const street = document.getElementById("street").value;

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
    const res = await fetch(`${API_BASE}/api/user/addresses`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok) {
      alert(data.message || "Thêm địa chỉ thất bại");
      return;
    }

    await loadUserAddresses();
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

async function loadUserProfile() {
  try {
    const res = await fetch("http://localhost:3000/api/user/profile", {
      method: "GET",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
    });

    if (res.status === 401) {
      localStorage.removeItem("token");
      alert("Token đã hết hạn hoặc không hợp lệ! Vui lòng đăng nhập lại.");
      window.location.href = "../auth/login-signup.html";
      return;
    }

    const data = await res.json();
    console.log("DATA: ", data);

    if (!res.ok || !data.success) {
      alert(data.message || "Không thể lấy thông tin người dùng");
      return;
    }

    const { role, email } = data.account;
    const user = data.user;
    const { BIN, account_number, type } = data.customer;
    const reviews = data.reviews || { review_count: 0, average_rating: 0 };

    // chỉ xử lý customer
    if (role !== "customer") return;

    // bind data vào UI
    document.getElementById("full-name").innerText = user.full_name || "";
    document.getElementById("full-name-input").value = user.full_name || "";
    document.getElementById("phone").value = user.phone_number || "";
    document.getElementById("cccd").value = user.identification || "";
    document.getElementById("email").value = email || "";
    document.getElementById("rank").value =
      mapCustomerType(type) || "Khách hàng mới";
    document.getElementById("bin").value = BIN || "";
    document.getElementById("account-number").value = account_number || "";

    // Set bank selection based on BIN
    if (BIN && bankSelect) {
      const matchingBank = Object.keys(bankData).find((key) => {
        const bank = bankData[key];
        return bank.bin === BIN || bank.bin === BIN.split(",")[0].trim();
      });
      if (matchingBank) {
        bankSelect.value = matchingBank;
      }
    }

    // avatar
    document.getElementById("avatar").src =
      user.avatar_url || "https://api.dicebear.com/9.x/bottts/svg?seed=Julia";

    // Display reviews and reputation
    renderRatingStars(reviews.average_rating || 0);
    document.getElementById("rating-value").textContent = reviews.average_rating
      ? reviews.average_rating.toFixed(1)
      : "0.0";
    document.getElementById("review-count").textContent =
      `(${reviews.review_count || 0} đánh giá)`;
    document.getElementById("reputation-score").textContent =
      user.reputation_score || 0;

    await loadUserAddresses();
  } catch (error) {
    console.error("Lỗi load profile:", error);
  }
}

async function updateProfile() {
  try {
    const full_name = document.getElementById("full-name-input").value;
    const phone_number = document.getElementById("phone").value;
    const identification = document.getElementById("cccd").value;

    const BIN = document.getElementById("bin").value;
    const account_number = document.getElementById("account-number").value;

    if (!BIN || !account_number) {
      return alert("Yêu cầu nhập đầy đủ thông tin tài khoản ngân hàng.");
    }

    const payload = {
      full_name,
      phone_number,
      identification,
      BIN,
      account_number,
    };

    Object.keys(payload).forEach(
      (key) => payload[key] === "" && delete payload[key],
    );

    const res = await fetch(`${API_BASE}/api/user/profile/update`, {
      method: "PUT",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data.message || "Cập nhật thất bại");
      return;
    }

    alert("Cập nhật thông tin thành công");

    if (data.success) {
      isEditing = false;

      editableInputs.forEach((input) => (input.readOnly = true));
      updateBtn.disabled = true;
      updateBtn.classList.add("opacity-50", "cursor-not-allowed");

      editBtn.innerHTML = `
            <span>Chỉnh sửa thông tin</span>
            <span class="material-symbols-outlined ml-1">edit</span>
            `;
    }

    //renderAddress();
    location.reload();
  } catch (error) {
    console.error("Update profile error:", error);
    alert("Có lỗi xảy ra");
  }
}

async function updateAvatar(event) {
  try {
    const file = event.target.files[0];

    if (!file) return;

    const formData = new FormData();
    formData.append("avatar", file);

    const res = await fetch(
      "http://localhost:3000/api/user/profile/update-avatar",
      {
        method: "PUT",
        headers: {
          Authorization: `Bearer ${token}`,
        },
        body: formData,
      },
    );

    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data.message || "Upload avatar thất bại");
      return;
    }

    document.getElementById("avatar").src = URL.createObjectURL(file);
    alert("✅ Cập nhật avatar thành công");
  } catch (error) {
    console.error("Update avatar error:", error);
    alert("Có lỗi khi upload avatar");
  }
}

// Fetch banks from MoMo API
async function loadBanks() {
  try {
    const response = await fetch(`${API_BASE}/api/momo/bankcodes`);
    if (!response.ok) {
      throw new Error("Failed to fetch banks");
    }

    bankData = await response.json();
    console.log(bankData);

    if (bankSelect) {
      // Clear existing options except the first one
      bankSelect.innerHTML = '<option value="">-- Chọn ngân hàng --</option>';

      // Sort banks by name for better UX
      const sortedBanks = Object.entries(bankData)
        .filter(([key, bank]) => bank.isDisburse === true) // Only show banks that support disbursement
        .sort((a, b) => a[1].name.localeCompare(b[1].name, "vi"));

      sortedBanks.forEach(([key, bank]) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = bank.shortName + " - " + bank.name;
        option.dataset.bin = bank.bin;
        bankSelect.appendChild(option);
      });
    }
  } catch (error) {
    console.error("Error loading banks:", error);
    if (bankSelect) {
      bankSelect.innerHTML =
        '<option value="">Lỗi tải danh sách ngân hàng</option>';
    }
  }
}

// Handle bank selection change
if (bankSelect) {
  bankSelect.addEventListener("change", function () {
    const selectedKey = this.value;
    if (selectedKey && bankData[selectedKey]) {
      const selectedBank = bankData[selectedKey];
      const binInput = document.getElementById("bin");
      if (binInput) {
        // Handle banks with multiple BINs (comma-separated)
        const binValue = selectedBank.bin.split(",")[0].trim();
        binInput.value = binValue;
      }
    }
  });
}

window.updateProfile = updateProfile;
window.updateAvatar = updateAvatar;
window.openAddAddressModal = openAddAddressModal;
window.closeAddressModal = closeAddressModal;
window.saveAddress = saveAddress;
window.deleteAddress = deleteAddress;

// Initialize: Load banks first, then profile
document.addEventListener("DOMContentLoaded", async () => {
  await loadBanks();
  await loadUserProfile();
});
