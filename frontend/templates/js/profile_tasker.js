let isEditing = false;
let currentSkills = [];

let addressState = {
  full_address: "",
  city: "",
  district: "",
  ward: "",
  street: "",
  latitude: null,
  longitude: null,
  radius: 5,
};

// validate authorization
let token = localStorage.getItem("token");
if (!token) {
  alert("Chưa đăng nhập! Vui lòng đăng nhập để truy cập.");
  window.location.href = "../auth/login-signup.html";
}
console.log("TOKEN: ", token);

const role = localStorage.getItem("system_role");
if (role !== "tasker") {
  alert("Bạn không phải Tasker. Không có quyền truy cập.");
  window.location.href = "../auth/login-signup.html";
}

const editBtn = document.getElementById("editToggle");
const updateBtn = document.getElementById("updateBtn");

const editableInputs = [
    document.getElementById("full-name-input"),
    document.getElementById("cccd"),
    document.getElementById("phone"),
    document.getElementById("intro"),
    document.getElementById("working-area"),
    document.getElementById("working-radius"),
    document.getElementById("bin"),
    document.getElementById("account-number"),
];

// Bank data storage
let bankData = {};
let bankSelect = document.getElementById("bank-select");

editBtn.addEventListener("click", () => {
    isEditing = !isEditing;

    editableInputs.forEach(input => {
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

    renderSkills(currentSkills);

    document.getElementById("editAddressBtn").classList.toggle("hidden", !isEditing);

});

async function getTaskById(taskId) {
  const res = await fetch(`http://localhost:3000/api/task/${taskId}`, {
    method: "GET",
    headers: {
      "Authorization": `Bearer ${token}`,
      "Content-Type": "application/json"
    }
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error("Không lấy được task " + taskId);
  }

  return data.task;
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
        starsHTML += '<span class="material-symbols-outlined text-xl">star_half</span>';
    }
    
    // Empty stars
    const emptyStars = 5 - fullStars - (hasHalfStar ? 1 : 0);
    for (let i = 0; i < emptyStars; i++) {
        starsHTML += '<span class="material-symbols-outlined text-xl text-gray-300">star</span>';
    }
    
    starsContainer.innerHTML = starsHTML;
}

async function renderSkills(skillIds = []) {
  const skillsContainer = document.getElementById("skills");
  skillsContainer.innerHTML = "";
  currentSkills = [...skillIds];

  if (!skillIds.length) {
    skillsContainer.innerHTML = `
      <span class="text-gray-400 italic">Chưa có chuyên môn</span>
    `;
  } else {
    const tasks = await Promise.all(
      skillIds.map(id => getTaskById(id, token))
    );

    tasks.forEach(task => {
      const tag = document.createElement("div");
      tag.className =
        "flex items-center gap-1 px-3 py-1 rounded-full text-sm " +
        "bg-primary-100 text-primary-600 border border-primary-200";

      tag.innerHTML = `
        <span>${task.task_name}</span>
        ${
          isEditing
            ? `<button class="hover:text-red-500"
                onclick="removeSkill('${task._id}')">
                <span class="material-symbols-outlined text-sm">close</span>
              </button>`
            : ""
        }
      `;

      skillsContainer.appendChild(tag);
    });
  }

  console.log("IS EDITING (in render skills): ", isEditing);
  if (isEditing) {
    const addBtn = document.createElement("button");
    addBtn.className =
      "w-8 h-8 flex items-center justify-center rounded-full " +
      "border border-dashed border-primary-400 text-primary-500 hover:bg-primary-50";
    addBtn.innerHTML = `
      <span class="material-symbols-outlined text-base">add</span>
    `;
    addBtn.onclick = openAddSkillModal;

    skillsContainer.appendChild(addBtn);
  }
}

async function getAllTasks() {
    try {
    const res = await fetch("http://localhost:3000/api/task/all?status=active", {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        }
    });

    console.log("TOKEN: ", token);
    if (res.status === 401) {
        localStorage.removeItem("token");
        alert("Token đã hết hạn hoặc không hợp lệ! Vui lòng đăng nhập lại.");
        window.location.href = "../auth/login-signup.html";
        return;
    }

    const data = await res.json();
    console.log("DATA in getAllTask: ", data);
    
    if (!res.ok || !data.success) {
        alert(data.message || "Không thể lấy thông tin các tasks.");
        return;
    }

    return data.tasks;
    } catch (error) {
        console.error("Lỗi load profile:", error);
    }
}

async function openAddSkillModal() {
  const modal = document.getElementById("skillModal");
  const select = document.getElementById("skillSelect");

  const tasks = await getAllTasks();
  console.log("TASKS IN ADD SKILL MODAL: ", tasks);

  select.innerHTML = tasks
    .filter(t => !currentSkills.includes(t._id))
    .map(t => `<option value="${t._id}">${t.task_name}</option>`)
    .join("");

  modal.classList.remove("hidden");
  modal.classList.add("flex");
}

function closeSkillModal() {
  document.getElementById("skillModal").classList.add("hidden");
}

function addSkill() {
  const select = document.getElementById("skillSelect");
  const taskId = select.value;

  if (!taskId || currentSkills.includes(taskId)) return;

  currentSkills.push(taskId);
  closeSkillModal();
  renderSkills(currentSkills);
}

function removeSkill(taskId) {
  currentSkills = currentSkills.filter(id => id !== taskId);
  renderSkills(currentSkills);
}

async function loadUserProfile() {
    console.log("IS EDITING in load profile: ", isEditing);
    try {
    const res = await fetch("http://localhost:3000/api/user/profile", {
        method: "GET",
        headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json"
        }
    });

    console.log("TOKEN: ", token);
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
    const { working_area, working_radius, working_year, hourly_rate, 
      introduction, skills, BIN, account_number } = data.tasker;
    const reviews = data.reviews || { review_count: 0, average_rating: 0 };

    console.log("PROFILE DATA: ", data);
    console.log("working area: ", working_area);

    // chỉ xử lý tasker
    if (role !== "tasker") {
        alert("Bạn không phải là tasker! Vui lòng đăng nhập để truy cập.");
        window.location.href = "../auth/login-signup.html";
        return;
    }

    // bind data vào UI
    document.getElementById("full-name").innerText = user.full_name || "";
    document.getElementById("full-name-input").value = user.full_name || "";
    document.getElementById("phone").value = user.phone_number || "";
    document.getElementById("cccd").value = user.identification || "";
    document.getElementById("email").value = email || "";
    document.getElementById("intro").value = introduction || "";
    document.getElementById("working-year").value = working_year || 1;
    document.getElementById("hourly-rate").value = hourly_rate || 1;
    document.getElementById("working-area").value = working_area.full_address;
    document.getElementById("working-radius").value = working_radius;
    
    await renderSkills(skills);

    document.getElementById("bin").value = BIN || "";
    document.getElementById("account-number").value = account_number || "";
    
    // Set bank selection based on BIN
    if (BIN && bankSelect) {
        const matchingBank = Object.keys(bankData).find(key => {
            const bank = bankData[key];
            return bank.bin === BIN || bank.bin === BIN.split(',')[0].trim();
        });
        if (matchingBank) {
            bankSelect.value = matchingBank;
        }
    }

    // avatar
    document.getElementById("avatar").src = user.avatar_url || "https://api.dicebear.com/9.x/bottts/svg?seed=Charlie";

    // Display reviews and reputation
    renderRatingStars(reviews.average_rating || 0);
    document.getElementById("rating-value").textContent = reviews.average_rating ? reviews.average_rating.toFixed(1) : "0.0";
    document.getElementById("review-count").textContent = `(${reviews.review_count || 0} đánh giá)`;
    document.getElementById("reputation-score").textContent = user.reputation_score || 0;

    addressState.latitude = working_area.latitude;
    addressState.longitude = working_area.longitude;
    addressState.radius = working_radius || 5;
    addressState.full_address = working_area.full_address;
    
    // Parse address components from full_address
    if (working_area.full_address) {
      const addressParts = working_area.full_address.split(',').map(s => s.trim());
      if (addressParts.length >= 4) {
        addressState.street = addressParts[0] || '';
        addressState.ward = addressParts[1] || '';
        addressState.district = addressParts[2] || '';
        addressState.city = addressParts[3] || '';
      } else if (addressParts.length === 3) {
        addressState.ward = addressParts[0] || '';
        addressState.district = addressParts[1] || '';
        addressState.city = addressParts[2] || '';
      }
    }

    } catch (error) {
        console.error("Lỗi load profile:", error);
    }
}

// logic xử lý phần địa chỉ
let map = null;
let marker = null;
let workCircle = null;
let mapInitialized = false;
let selectsInitialized = false;

function adjustRadius(delta) {
  const input = document.getElementById('work_radius');
  let val = parseInt(input.value) || 5;
  val += delta;
  if (val < 1) val = 1;
  if (val > 50) val = 50;
  input.value = val;
  input.dispatchEvent(new Event('input'));
  if (workCircle) {
    updateCircle();
    if (map) {
      map.fitBounds(workCircle.getBounds());
    }
  }
}

function updateCircle() {
  if (!marker || !workCircle) return;
  const latLng = marker.getLatLng();
  const radiusMeters = document.getElementById('work_radius').value * 1000;
  workCircle.setLatLng(latLng);
  workCircle.setRadius(radiusMeters);
}

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
      updateCircle();

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
  const radiusMeters = (addressState.radius || 5) * 1000;
  workCircle = L.circle(defaultCoords, { 
    color: '#68A776', 
    fillColor: '#ACCFB2', 
    fillOpacity: 0.4, 
    radius: radiusMeters 
  }).addTo(map);

  if (addressState.latitude && addressState.longitude) {
    const latLng = new L.LatLng(addressState.latitude, addressState.longitude);
    marker.setLatLng(latLng);
    map.setView(latLng, 13);
    updateCircle();
    document.getElementById('result_lat').value = addressState.latitude;
    document.getElementById('result_lng').value = addressState.longitude;
  }
  
  // Invalidate size after a short delay to ensure proper rendering
  setTimeout(() => {
    if (map) {
      map.invalidateSize();
    }
  }, 200);

  document.getElementById('work_radius').addEventListener('input', function() {
    addressState.radius = Number(this.value);
    updateCircle();
    map.fitBounds(workCircle.getBounds());
  });

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
      map.fitBounds(workCircle.getBounds());
    }
  });

  marker.on('drag', () => {
    if (workCircle) {
      workCircle.setLatLng(marker.getLatLng());
    }
  });
  
  marker.on('dragend', () => {
    const pos = marker.getLatLng();
    addressState.latitude = pos.lat;
    addressState.longitude = pos.lng;
    document.getElementById('result_lat').value = pos.lat;
    document.getElementById('result_lng').value = pos.lng;
    updateCircle();
  });

  mapInitialized = true;
}

function initAddressSelects() {
  if (selectsInitialized) return;
  
  const host = "https://provinces.open-api.vn/api/";
  const elCity = document.getElementById('city');
  const elDistrict = document.getElementById('district');
  const elWard = document.getElementById('ward');

  fetch(host + "?depth=1").then(res => res.json()).then(data => {
    let html = '<option value="" selected disabled>Chọn Tỉnh / Thành phố</option>';
    data.forEach(item => html += `<option value="${item.code}" data-name="${item.name}">${item.name}</option>`);
    elCity.innerHTML = html;
    
    // Try to select existing city if available
    if (addressState.city) {
      const cityOption = Array.from(elCity.options).find(opt => opt.getAttribute('data-name') === addressState.city);
      if (cityOption) {
        elCity.value = cityOption.value;
        elCity.dispatchEvent(new Event('change'));
      }
    }
  });

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
      
      // Try to select existing district if available
      if (addressState.district) {
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
      
      // Try to select existing ward if available
      if (addressState.ward) {
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
      updateCircle();
      map.invalidateSize();
    }
  }
}

function applyAddress() {
  const lat = document.getElementById('result_lat').value;
  const lng = document.getElementById('result_lng').value;
  const city = document.getElementById('result_city').value;
  const district = document.getElementById('result_district').value;
  const ward = document.getElementById('result_ward').value;
  const street = document.getElementById('street').value;
  const radius = Number(document.getElementById('work_radius').value);

  if (!lat || !lng) {
    alert("Vui lòng xác định vị trí trên bản đồ");
    return;
  }

  const full_address = [street, ward, district, city]
    .filter(Boolean)
    .join(", ");

  addressState.full_address = full_address;
  addressState.latitude = parseFloat(lat);
  addressState.longitude = parseFloat(lng);
  addressState.radius = radius;
  addressState.city = city;
  addressState.district = district;
  addressState.ward = ward;
  addressState.street = street;

  document.getElementById("working-area").value = full_address;
  document.getElementById("working-radius").value = radius;
  
  closeAddressModal();
}

function openAddressModal() {
  const modal = document.getElementById("addressModal");
  modal.classList.remove("hidden");
  modal.classList.add("flex");
  
  // Set initial values
  document.getElementById('work_radius').value = addressState.radius || 5;
  document.getElementById('street').value = addressState.street || '';
  document.getElementById('result_lat').value = addressState.latitude || '';
  document.getElementById('result_lng').value = addressState.longitude || '';
  document.getElementById('result_city').value = addressState.city || '';
  document.getElementById('result_district').value = addressState.district || '';
  document.getElementById('result_ward').value = addressState.ward || '';
  
  initAddressMapIfNeeded();
  
  // Invalidate map size after modal is shown
  setTimeout(() => {
    if (map) {
      map.invalidateSize();
    }
  }, 100);
}

function closeAddressModal() {
  const modal = document.getElementById("addressModal");
  modal.classList.add("hidden");
  modal.classList.remove("flex");
}

async function updateProfile() {
    try {
    const token = localStorage.getItem("token");

    const full_name = document.getElementById("full-name-input").value;
    const phone_number =  document.getElementById("phone").value;
    const identification = document.getElementById("cccd").value;
    
    const introduction = document.getElementById("intro").value;

    const working_area = {
      full_address: document.getElementById("working-area").value,
      longitude: addressState.longitude,
      latitude: addressState.latitude,
    };

    //const working_radius = addressState.radius;

    const working_radius = document.getElementById("working-radius").value?
      Number(document.getElementById("working-radius").value) : 20;
      
    const BIN = document.getElementById("bin").value;
    const account_number = document.getElementById("account-number").value;

    if (!BIN || !account_number) {
      return alert("Yêu cầu nhập đầy đủ thông tin tài khoản ngân hàng.");
    }

    const payload = {
        full_name, phone_number, identification,
        introduction, working_area, working_radius, BIN, account_number,
        skills: currentSkills,
    };

    Object.keys(payload).forEach(
        key => payload[key] === "" && delete payload[key]
    );

    console.log("UPDATE PAYLOAD: ", payload);

    const res = await fetch("http://localhost:3000/api/user/profile/update/tasker", {
        method: "PUT",
        headers: {
          "Authorization": `Bearer ${token}`,
          "Content-Type": "application/json"
        },
        body: JSON.stringify(payload)
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
        alert(data.message || "Cập nhật thất bại");
        return;
    }

    alert("Cập nhật thông tin thành công");

    if (data.success) {
        isEditing = false;

        editableInputs.forEach(input => input.readOnly = true);
        updateBtn.disabled = true;
        updateBtn.classList.add("opacity-50", "cursor-not-allowed");

        editBtn.innerHTML = `
        <span>Chỉnh sửa thông tin</span>
        <span class="material-symbols-outlined ml-1">edit</span>
        `;

        renderSkills(currentSkills);
        location.reload();
    }

    } catch (error) {
    console.error("Update profile error:", error);
    alert("Có lỗi xảy ra");
    }
}

async function updateAvatar(event) {
    try {
      const token = localStorage.getItem("token");
      const file = event.target.files[0];

      if (!file) return;

      const formData = new FormData();
      formData.append("avatar", file);

      const res = await fetch("http://localhost:3000/api/user/profile/update-avatar", {
          method: "PUT",
          headers: {
          "Authorization": `Bearer ${token}`
          },
          body: formData
      });

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
        const response = await fetch("http://localhost:3000/api/momo/bankcodes");
        if (!response.ok) {
          throw new Error("Failed to fetch banks");
        }

        const bankData = await response.json();
        console.log(bankData);
        
        if (bankSelect) {
            // Clear existing options except the first one
            bankSelect.innerHTML = '<option value="">-- Chọn ngân hàng --</option>';
            
            // Sort banks by name for better UX
            const sortedBanks = Object.entries(bankData)
                .filter(([key, bank]) => bank.isDisburse === true) // Only show banks that support disbursement
                .sort((a, b) => a[1].name.localeCompare(b[1].name, 'vi'));
            
            sortedBanks.forEach(([key, bank]) => {
                const option = document.createElement('option');
                option.value = key;
                option.textContent = bank.shortName + " - " + bank.name;
                option.dataset.bin = bank.bin;
                bankSelect.appendChild(option);
            });
        }
    } catch (error) {
        console.error('Error loading banks:', error);
        if (bankSelect) {
            bankSelect.innerHTML = '<option value="">Lỗi tải danh sách ngân hàng</option>';
        }
    }
}

// Handle bank selection change
if (bankSelect) {
    bankSelect.addEventListener('change', function() {
        const selectedKey = this.value;
        if (selectedKey && bankData[selectedKey]) {
            const selectedBank = bankData[selectedKey];
            const binInput = document.getElementById("bin");
            if (binInput) {
                // Handle banks with multiple BINs (comma-separated)
                const binValue = selectedBank.bin.split(',')[0].trim();
                binInput.value = binValue;
            }
        }
    });
}

window.updateProfile = updateProfile;
window.updateAvatar = updateAvatar;
window.adjustRadius = adjustRadius;
window.openAddressModal = openAddressModal;
window.closeAddressModal = closeAddressModal;
window.applyAddress = applyAddress;

// Initialize: Load banks first, then profile
document.addEventListener("DOMContentLoaded", async () => {
    await loadBanks();
    await loadUserProfile();
});