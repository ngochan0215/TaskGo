    // validate authorization
    let token = localStorage.getItem("token");
    if (!token) {
        alert("Chưa đăng nhập! Vui lòng đăng nhập để truy cập.");
        window.location.href = "../auth/login-signup.html";
    }

    const role = localStorage.getItem("system_role");
    const _id = localStorage.getItem("user_id");
    console.log("USER: ", role + " " + _id);
    console.log("TOKEN: ", token);

    if (role !== "tasker") {
        alert("Bạn không phải Tasker. Không có quyền truy cập.");
        window.location.href = "../auth/login-signup.html";
    }
    
    const menuBtn = document.getElementById('menu-btn');
    const menuOverlay = document.getElementById('menu-overlay');
    if(menuBtn) {
        menuBtn.addEventListener('click', () => {
        const isOpened = menuOverlay.classList.contains('translate-y-0');
        if (isOpened) {
            menuOverlay.classList.remove('translate-y-0', 'opacity-100', 'pointer-events-auto');
            menuOverlay.classList.add('-translate-y-[150%]', 'opacity-0', 'pointer-events-none');
        } else {
            menuOverlay.classList.remove('-translate-y-[150%]', 'opacity-0', 'pointer-events-none');
            menuOverlay.classList.add('translate-y-0', 'opacity-100', 'pointer-events-auto');
        }
        });
    }

    const servicesToggle = document.getElementById('services-toggle');
    const servicesDropdown = document.getElementById('services-dropdown');
    const servicesArrow = document.getElementById('services-arrow');
    if(servicesToggle) {
        servicesToggle.addEventListener('click', () => {
        const isExpanded = servicesDropdown.style.maxHeight && servicesDropdown.style.maxHeight !== '0px';
        if (isExpanded) {
            servicesDropdown.style.maxHeight = '0px';
            servicesArrow.style.transform = 'rotate(0deg)';
        } else {
            servicesDropdown.style.maxHeight = servicesDropdown.scrollHeight + "px";
            servicesArrow.style.transform = 'rotate(180deg)';
        }
        });
    }

    // logic nút thay đổi trạng thái
    const statusToggle = document.getElementById('status-toggle');
    const statusDot = document.getElementById('status-dot');
    const statusText = document.getElementById('status-text');
    const jobList = document.getElementById('job-list');

    if(statusToggle) {
        statusToggle.addEventListener('change', function() {
            if(this.checked) {
                statusDot.className = "w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse";
                statusText.className = "text-xs font-bold text-green-600 uppercase";
                statusText.innerText = "Đang trực tuyến";
                jobList.classList.remove('opacity-50', 'pointer-events-none', 'grayscale');
            } else {
                statusDot.className = "w-2.5 h-2.5 bg-gray-400 rounded-full";
                statusText.className = "text-xs font-bold text-gray-500 uppercase";
                statusText.innerText = "Tạm nghỉ";
                jobList.classList.add('opacity-50', 'pointer-events-none', 'grayscale');
            }
        });
    }

    // nút tương ứng với icon lịch làm việc
    const scheduleBtn = document.getElementById("schedule-btn");
    if (scheduleBtn) {
        scheduleBtn.addEventListener("click", async(e) => {
            window.location.href = "./work_schedule.html";
        })
    }

    // logic đăng xuất
    const logoutBtn = document.getElementById("logout-btn");
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async (e) => {
            e.preventDefault();

            try {
                const res = await fetch("http://localhost:3000/api/auth/logout", {
                    method: "POST",
                    credentials: "include",
                    headers: {
                        Authorization: `Bearer ${token}`
                    }
                });

                const data = await res.json();

                if (data.success) {
                    localStorage.removeItem("token");
                    localStorage.removeItem("user_id");
                    localStorage.removeItem("system_role");

                    alert("Đăng xuất thành công. Bạn sẽ được chuyển về trang Đăng nhập.");
                    window.location.href = "../auth/login-signup.html";
                } else {
                    alert("Đăng xuất thất bại. Vui lòng thử lại.");
                }
            } catch (err) {
                console.error("LOGOUT ERROR:", err);
                alert("Có lỗi xảy ra khi đăng xuất.");
            }
        });
    }

    // logic show thông báo
    const notificationBtn = document.getElementById("notification-btn");
    if (notificationBtn){
        notificationBtn.addEventListener("click", async (e) => {
            window.location.href = "../notification.html";
        });
    }

    // logic show địa chỉ khi bấm nút khu vực
    let waState = {
        full_address: "",
        city: "",
        district: "",
        ward: "",
        street: "",
        latitude: null,
        longitude: null,
        radius: 5,
    };

    let waMap = null;
    let waMarker = null;
    let waCircle = null;
    let waMapInitialized = false;
    let waSelectsInitialized = false;

    function adjustWorkingAreaRadius(delta) {
        const input = document.getElementById('wa_work_radius');
        let val = parseInt(input.value) || 5;
        val += delta;
        if (val < 1) val = 1;
        if (val > 50) val = 50;
        input.value = val;
        input.dispatchEvent(new Event('input'));
        if (waCircle) {
            waUpdateCircle();
            if (waMap) {
                waMap.fitBounds(waCircle.getBounds());
            }
        }
    }

    function waUpdateCircle() {
        if (!waMarker || !waCircle) return;
        const latLng = waMarker.getLatLng();
        const radiusMeters = document.getElementById('wa_work_radius').value * 1000;
        waCircle.setLatLng(latLng);
        waCircle.setRadius(radiusMeters);
    }

    async function waMoveMapTo(query, zoomLevel) {
        if (!waMap || !waMarker) return;
        try {
            const url = `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(query)}&limit=1`;
            const res = await fetch(url);
            const data = await res.json();

            if (data && data.length > 0) {
                const lat = parseFloat(data[0].lat);
                const lon = parseFloat(data[0].lon);
                const newLatLng = new L.LatLng(lat, lon);

                waMarker.setLatLng(newLatLng);
                waMap.setView(newLatLng, zoomLevel);
                waUpdateCircle();

                document.getElementById('wa_result_lat').value = lat;
                document.getElementById('wa_result_lng').value = lon;
                waState.latitude = lat;
                waState.longitude = lon;
            }
        } catch (e) {
            console.error("WA move map error:", e);
        }
    }

    function waInitMap() {
        if (waMapInitialized && waMap) return;

        const defaultCoords = waState.latitude && waState.longitude
            ? [waState.latitude, waState.longitude]
            : [10.8231, 106.6297];

        waMap = L.map('wa_map').setView(defaultCoords, 13);
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
            attribution: '&copy; OpenStreetMap'
        }).addTo(waMap);

        waMarker = L.marker(defaultCoords, { draggable: true }).addTo(waMap);
        const radiusMeters = (waState.radius || 5) * 1000;
        waCircle = L.circle(defaultCoords, {
            color: '#3730A3',
            fillColor: '#A5B4FC',
            fillOpacity: 0.25,
            radius: radiusMeters
        }).addTo(waMap);

        if (waState.latitude && waState.longitude) {
            const latLng = new L.LatLng(waState.latitude, waState.longitude);
            waMarker.setLatLng(latLng);
            waMap.setView(latLng, 13);
            waUpdateCircle();
            document.getElementById('wa_result_lat').value = waState.latitude;
            document.getElementById('wa_result_lng').value = waState.longitude;
        }

        setTimeout(() => {
            if (waMap) waMap.invalidateSize();
        }, 200);

        document.getElementById('wa_work_radius').addEventListener('input', function() {
            waState.radius = Number(this.value);
            waUpdateCircle();
            if (waCircle && waMap) waMap.fitBounds(waCircle.getBounds());
        });

        document.getElementById('wa_btn_search_map').addEventListener('click', async function() {
            const city = document.getElementById('wa_result_city').value;
            const district = document.getElementById('wa_result_district').value;
            const ward = document.getElementById('wa_result_ward').value;
            const street = document.getElementById('wa_street').value;

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
                        waMoveMapTo(query, 17);
                    } else {
                        alert("Không tìm thấy số nhà này, bạn có thể tự kéo ghim trên bản đồ.");
                    }
                } catch(e) {
                    console.error(e);
                }
            } else {
                if (waCircle && waMap) waMap.fitBounds(waCircle.getBounds());
            }
        });

        waMarker.on('drag', () => {
            if (waCircle) waCircle.setLatLng(waMarker.getLatLng());
        });

        waMarker.on('dragend', () => {
            const pos = waMarker.getLatLng();
            waState.latitude = pos.lat;
            waState.longitude = pos.lng;
            document.getElementById('wa_result_lat').value = pos.lat;
            document.getElementById('wa_result_lng').value = pos.lng;
            waUpdateCircle();
        });

        waMapInitialized = true;
    }

    function waInitSelects() {
        if (waSelectsInitialized) return;

        const host = "https://provinces.open-api.vn/api/";
        const elCity = document.getElementById('wa_city');
        const elDistrict = document.getElementById('wa_district');
        const elWard = document.getElementById('wa_ward');

        fetch(host + "?depth=1").then(res => res.json()).then(data => {
            let html = '<option value="" selected disabled>Chọn Tỉnh / Thành phố</option>';
            data.forEach(item => html += `<option value="${item.code}" data-name="${item.name}">${item.name}</option>`);
            elCity.innerHTML = html;

            if (waState.city) {
                const cityOption = Array.from(elCity.options).find(opt => opt.getAttribute('data-name') === waState.city);
                if (cityOption) {
                    elCity.value = cityOption.value;
                    elCity.dispatchEvent(new Event('change'));
                }
            }
        });

        elCity.addEventListener('change', function() {
            const cityName = this.options[this.selectedIndex].getAttribute('data-name');
            document.getElementById('wa_result_city').value = cityName;
            waState.city = cityName;
            waMoveMapTo(cityName, 10);

            elDistrict.innerHTML = '<option value="" selected disabled>Đang tải...</option>';
            elDistrict.disabled = true;
            elWard.innerHTML = '<option value="" selected disabled>-- Vui lòng chọn Quận trước --</option>';
            elWard.disabled = true;

            fetch(host + "p/" + this.value + "?depth=2").then(res => res.json()).then(data => {
                let html = '<option value="" selected disabled>Chọn Quận / Huyện</option>';
                data.districts.forEach(item => html += `<option value="${item.code}" data-name="${item.name}">${item.name}</option>`);
                elDistrict.innerHTML = html;
                elDistrict.disabled = false;

                if (waState.district) {
                    const distOption = Array.from(elDistrict.options).find(opt => opt.getAttribute('data-name') === waState.district);
                    if (distOption) {
                        elDistrict.value = distOption.value;
                        elDistrict.dispatchEvent(new Event('change'));
                    }
                }
            });
        });

        elDistrict.addEventListener('change', function() {
            const distName = this.options[this.selectedIndex].getAttribute('data-name');
            const cityName = document.getElementById('wa_result_city').value;
            document.getElementById('wa_result_district').value = distName;
            waState.district = distName;
            waMoveMapTo(`${distName}, ${cityName}`, 13);

            elWard.innerHTML = '<option value="" selected disabled>Đang tải...</option>';
            elWard.disabled = true;

            fetch(host + "d/" + this.value + "?depth=2").then(res => res.json()).then(data => {
                let html = '<option value="" selected disabled>Chọn Phường / Xã</option>';
                data.wards.forEach(item => html += `<option value="${item.code}" data-name="${item.name}">${item.name}</option>`);
                elWard.innerHTML = html;
                elWard.disabled = false;

                if (waState.ward) {
                    const wardOption = Array.from(elWard.options).find(opt => opt.getAttribute('data-name') === waState.ward);
                    if (wardOption) {
                        elWard.value = wardOption.value;
                        elWard.dispatchEvent(new Event('change'));
                    }
                }
            });
        });

        elWard.addEventListener('change', function() {
            const wardName = this.options[this.selectedIndex].getAttribute('data-name');
            const distName = document.getElementById('wa_result_district').value;
            const cityName = document.getElementById('wa_result_city').value;
            document.getElementById('wa_result_ward').value = wardName;
            waState.ward = wardName;
            waMoveMapTo(`${wardName}, ${distName}, ${cityName}`, 15);
        });

        waSelectsInitialized = true;
    }

    function openWorkingAreaModal() {
        const modal = document.getElementById("workingAreaModal");
        modal.classList.remove("hidden");
        modal.classList.add("flex");

        document.getElementById('wa_work_radius').value = waState.radius || 5;
        document.getElementById('wa_street').value = waState.street || '';
        document.getElementById('wa_result_lat').value = waState.latitude || '';
        document.getElementById('wa_result_lng').value = waState.longitude || '';
        document.getElementById('wa_result_city').value = waState.city || '';
        document.getElementById('wa_result_district').value = waState.district || '';
        document.getElementById('wa_result_ward').value = waState.ward || '';

        setTimeout(() => {
            waInitMap();
            waInitSelects();
            if (waMap) waMap.invalidateSize();
        }, 100);
    }

    function closeWorkingAreaModal() {
        const modal = document.getElementById("workingAreaModal");
        modal.classList.add("hidden");
        modal.classList.remove("flex");
    }

    async function saveWorkingArea() {
        const lat = document.getElementById('wa_result_lat').value;
        const lng = document.getElementById('wa_result_lng').value;
        const city = document.getElementById('wa_result_city').value;
        const district = document.getElementById('wa_result_district').value;
        const ward = document.getElementById('wa_result_ward').value;
        const street = document.getElementById('wa_street').value;
        const radius = Number(document.getElementById('wa_work_radius').value);

        if (!lat || !lng) {
            alert("Vui lòng xác định vị trí trên bản đồ");
            return;
        }

        const full_address = [street, ward, district, city].filter(Boolean).join(", ");
        const working_area = {
            full_address,
            longitude: parseFloat(lng),
            latitude: parseFloat(lat),
        };

        const payload = {
            working_area,
            working_radius: radius
        };

        const btn = document.getElementById("wa_save_btn");
        const oldText = btn.textContent;
        btn.disabled = true;
        btn.textContent = "Đang lưu...";

        try {
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
                alert(data.message || "Cập nhật khu vực thất bại");
                return;
            }

            waState.full_address = full_address;
            waState.latitude = working_area.latitude;
            waState.longitude = working_area.longitude;
            waState.radius = radius;
            waState.city = city;
            waState.district = district;
            waState.ward = ward;
            waState.street = street;

            alert("Cập nhật khu vực hoạt động thành công");
            closeWorkingAreaModal();
        } catch (e) {
            console.error("saveWorkingArea error:", e);
            alert("Có lỗi xảy ra khi cập nhật khu vực hoạt động");
        } finally {
            btn.disabled = false;
            btn.textContent = oldText;
        }
    }

    window.openWorkingAreaModal = openWorkingAreaModal;
    window.closeWorkingAreaModal = closeWorkingAreaModal;
    window.saveWorkingArea = saveWorkingArea;
    window.adjustWorkingAreaRadius = adjustWorkingAreaRadius;
  
    // logic load thông tin tổng quát
    async function loadTaskerHome() {
        try {
            const res = await fetch("http://localhost:3000/api/user/profile", {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const data = await res.json();
            if (!data.success) return;

            const { user, tasker, account, reviews } = data;

            // menu hamburger
            const menuName = document.querySelector('#menu-overlay p.text-lg');
            const menuId = document.querySelector('#menu-overlay p.text-xs');

            if (menuName) menuName.innerText = user.full_name;
            if (menuId) menuId.innerText = `ID: #${user._id.slice(-6).toUpperCase()}`;

            // header
            const greeting = document.querySelector('h2');
            if (greeting) {
                greeting.innerText = `Chào ${user.full_name}! 👋`;
            }
 
            const menuAvatar = document.getElementById("menuAvatar");
            if (menuAvatar) {
                menuAvatar.src = user.avatar_url || "https://api.dicebear.com/9.x/bottts/svg?seed=George";
            }

            // working status
            const statusToggle = document.getElementById('status-toggle');
            const statusDot = document.getElementById('status-dot');
            const statusText = document.getElementById('status-text');

            if (statusToggle) {
                statusToggle.addEventListener('change', async function () {
                    const newStatus = this.checked ? "available" : "offline";

                    try {
                        const res = await fetch(
                            "http://localhost:3000/api/tasker/update/working-status",
                            {
                                method: "PATCH",
                                headers: {
                                    "Content-Type": "application/json",
                                    Authorization: `Bearer ${token}`
                                },
                                body: JSON.stringify({ working_status: newStatus })
                            }
                        );

                        const data = await res.json();

                        if (!res.ok || !data.success) {
                            throw new Error(data.message || "Cập nhật thất bại");
                        }

                        // update UI khi backend OK
                        if (newStatus === "available") {
                            statusDot.className = "w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse";
                            statusText.className = "text-xs font-bold text-green-600 uppercase";
                            statusText.innerText = "Đang trực tuyến";
                            jobList.classList.remove('opacity-50', 'pointer-events-none', 'grayscale');
                        } else if (newStatus === "offline") {
                            statusDot.className = "w-2.5 h-2.5 bg-gray-400 rounded-full";
                            statusText.className = "text-xs font-bold text-gray-500 uppercase";
                            statusText.innerText = "Tasker hiện đã offline - nghỉ làm việc";
                            jobList.classList.add('opacity-50', 'pointer-events-none', 'grayscale');
                        }

                    } catch (err) {
                        alert(err.message);
                        // rollback UI
                        this.checked = !this.checked;
                    }
                });
            }

            if (tasker.working_status === 'available') {
                statusToggle.checked = true;
                statusDot.className = "w-2.5 h-2.5 bg-green-500 rounded-full animate-pulse";
                statusText.innerText = "Đang trực tuyến";
                statusText.className = "text-xs font-bold text-green-600 uppercase";
            } else if (tasker.working_status === 'paused') {
                statusToggle.checked = false;
                statusDot.className = "w-2.5 h-2.5 bg-gray-400 rounded-full";
                statusText.innerText = "Tạm nghỉ";
                statusText.className = "text-xs font-bold text-gray-500 uppercase";
            } else if (tasker.working_status === 'pending') {
                statusToggle.checked = false;
                statusDot.className = "w-2.5 h-2.5 bg-blue-500 rounded-full";
                statusText.innerText = "Hồ sơ đang được xem xét";
                statusText.className = "text-xs font-bold text-blue-500 uppercase";
            } else if (tasker.working_status === 'busy'){
                statusToggle.checked = false;
                statusDot.className = "w-2.5 h-2.5 bg-orange-500 rounded-full";
                statusText.innerText = "Tasker hiện đang làm việc cho khách hàng";
                statusText.className = "text-xs font-bold text-orange-500 uppercase";
            } else {
                statusToggle.checked = false;
                statusDot.className = "w-2.5 h-2.5 bg-gray-700 rounded-full";
                statusText.innerText = "Tasker hiện đã offline - nghỉ làm việc.";
                statusText.className = "text-xs font-bold text-dark-700 uppercase";
            }

            // điểm uy tín
            const ratingEl = document.getElementById("rating-value");
            if (ratingEl) {
                const rating = reviews && reviews.average_rating
                    ? Number(reviews.average_rating).toFixed(1)
                    : "0.0";
                ratingEl.textContent = rating;
            }
            // working_area
            if (tasker?.working_area) {
                waState.full_address = tasker.working_area.full_address || "";
                waState.latitude = tasker.working_area.latitude ?? null;
                waState.longitude = tasker.working_area.longitude ?? null;
                waState.radius = tasker.working_radius || 5;
                // parse address components
                if (tasker.working_area.full_address) {
                    const addressParts = tasker.working_area.full_address.split(',').map(s => s.trim());
                    if (addressParts.length >= 4) {
                        waState.street = addressParts[0] || '';
                        waState.ward = addressParts[1] || '';
                        waState.district = addressParts[2] || '';
                        waState.city = addressParts[3] || '';
                    } else if (addressParts.length === 3) {
                        waState.ward = addressParts[0] || '';
                        waState.district = addressParts[1] || '';
                        waState.city = addressParts[2] || '';
                    }
                }
            }

            // acceptance rate
            try {
                const rateRes = await fetch("http://localhost:3000/api/tasker/stats/acceptance-rate", {
                    headers: { Authorization: `Bearer ${token}` }
                });
                const rateJson = await rateRes.json();
                if (rateRes.ok && rateJson.success) {
                    const ratio = Number(rateJson.acceptance_rate || 0);
                    const pct = Math.round(ratio * 100);
                    const el = document.getElementById("acceptanceRate");
                    if (el) el.textContent = `${pct}%`;
                }
            } catch (e) {
                console.warn("Load acceptance rate failed:", e);
            }

        } catch (err) {
            console.error("LOAD TASKER HOME ERROR:", err);
        }
    }

    loadTaskerHome();

    // open working area modal
    const workingAreaBtn = document.getElementById("working-area-btn");
    if (workingAreaBtn) {
        workingAreaBtn.addEventListener("click", () => {
            openWorkingAreaModal();
        });
    }

    // Store original orders and current sort mode
    let allOrders = [];
    let currentSortMode = null; // "near", "price", or null
    let currentPage = 1;
    const itemsPerPage = 6;
    // Calculate distance between two coordinates (Haversine formula)
    function getDistanceKm(lat1, lon1, lat2, lon2) {
        const R = 6371; // Earth radius in km
        const dLat = ((lat2 - lat1) * Math.PI) / 180;
        const dLon = ((lon2 - lon1) * Math.PI) / 180;
        const a =
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    }

    // Sort orders by distance (nearest first)
    function sortByDistance(orders) {
        if (!waState.latitude || !waState.longitude) {
            console.warn("Tasker working area not set, cannot sort by distance");
            return orders;
        }

        return [...orders].map(order => {
            const orderLat = order.address_snapshot?.latitude || order.address_id?.latitude;
            const orderLon = order.address_snapshot?.longitude || order.address_id?.longitude;
            
            let distance = null;
            if (orderLat && orderLon) {
                distance = getDistanceKm(
                    waState.latitude,
                    waState.longitude,
                    orderLat,
                    orderLon
                );
            }

            return {
                ...order,
                _distance: distance
            };
        }).sort((a, b) => {
            // Orders with distance first, then by distance value
            if (a._distance === null && b._distance === null) return 0;
            if (a._distance === null) return 1;
            if (b._distance === null) return -1;
            return a._distance - b._distance;
        });
    }

    // Sort orders by price (highest first)
    function sortByPrice(orders) {
        return [...orders].sort((a, b) => {
            const priceA = a.final_amount || a.base_amount || 0;
            const priceB = b.final_amount || b.base_amount || 0;
            return priceB - priceA;
        });
    }

    // Update filter button styles
    function updateFilterButtons(activeMode) {
        const nearBtn = document.getElementById("sort-near");
        const priceBtn = document.getElementById("sort-price");

        if (nearBtn && priceBtn) {
            if (activeMode === "near") {
                nearBtn.classList.add("bg-[#3730A3]", "text-white");
                nearBtn.classList.remove("bg-white", "text-gray-600");
                priceBtn.classList.add("bg-white", "text-gray-600");
                priceBtn.classList.remove("bg-[#3730A3]", "text-white");
            } else if (activeMode === "price") {
                priceBtn.classList.add("bg-[#3730A3]", "text-white");
                priceBtn.classList.remove("bg-white", "text-gray-600");
                nearBtn.classList.add("bg-white", "text-gray-600");
                nearBtn.classList.remove("bg-[#3730A3]", "text-white");
            } else {
                nearBtn.classList.add("bg-white", "text-gray-600");
                nearBtn.classList.remove("bg-[#3730A3]", "text-white");
                priceBtn.classList.add("bg-white", "text-gray-600");
                priceBtn.classList.remove("bg-[#3730A3]", "text-white");
            }
        }
    }

    // Apply sorting and render
    // Apply sorting and render
        function applySortingAndRender() {
            let sortedOrders = [...allOrders];

            // First apply priority sorting (assigned first, then pending)
            sortedOrders = sortedOrders.sort((a, b) => {
                const aIsAssigned = a.status === "assigned" && a.tasker_id;
                const bIsAssigned = b.status === "assigned" && b.tasker_id;
                const aIsPending = a.status === "pending" && !a.tasker_id;
                const bIsPending = b.status === "pending" && !b.tasker_id;

                if (aIsAssigned && !bIsAssigned) return -1;
                if (!aIsAssigned && bIsAssigned) return 1;
                if (aIsPending && !bIsPending) return -1;
                if (!aIsPending && bIsPending) return 1;
                return 0;
            });

            // Then apply user-selected sorting
            if (currentSortMode === "near") {
                sortedOrders = sortByDistance(sortedOrders);
            } else if (currentSortMode === "price") {
                sortedOrders = sortByPrice(sortedOrders);
            }

            const totalItems = sortedOrders.length;
            const startIndex = (currentPage - 1) * itemsPerPage;
            const endIndex = startIndex + itemsPerPage;

            const ordersForCurrentPage = sortedOrders.slice(startIndex, endIndex);

            renderOrders(ordersForCurrentPage);

            renderPagination(totalItems);
        }

    // Load available orders
    async function loadAvailableOrders() {
        try {
            const res = await fetch("http://localhost:3000/api/tasker/orders/available", {
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            if (res.status === 401) {
                localStorage.removeItem("token");
                alert("Phiên đăng nhập hết hạn");
                window.location.href = "../auth/login-signup.html";
                return;
            }

            const data = await res.json();
            if (!data.success) {
                console.error("Failed to load orders:", data.message);
                return;
            }

            allOrders = data.orders || [];
            applySortingAndRender();

        } catch (err) {
            console.error("Error loading orders:", err);
        }
    }

    function formatCurrency(amount) {
        return Number(amount || 0).toLocaleString("vi-VN") + "đ";
    }

    function formatDateTime(dateString) {
        if (!dateString) return "—";
        const date = new Date(dateString);
        const now = new Date();
        const diffMs = date - now;
        const diffMins = Math.floor(diffMs / 60000);

        if (diffMins < 0) {
            return "Đã qua";
        } else if (diffMins < 60) {
            return `Ngay bây giờ (${diffMins} phút)`;
        } else {
            const hours = Math.floor(diffMins / 60);
            const mins = diffMins % 60;
            return `${hours}h${mins > 0 ? mins + 'p' : ''} nữa`;
        }
    }

    function formatScheduledTime(dateString, type) {
        if (!dateString) return "—";
        const date = new Date(dateString);
        
        if (type === "immediate") {
            return formatDateTime(dateString);
        } else {
            const timeStr = date.toLocaleTimeString("vi-VN", {
                hour: "2-digit",
                minute: "2-digit"
            });
            const dateStr = date.toLocaleDateString("vi-VN", {
                day: "2-digit",
                month: "2-digit"
            });
            return `${timeStr}, ${dateStr}`;
        }
    }

    function getStatusBadgeClass(status) {
        const statusMap = {
            "pending": "bg-blue-100 text-blue-700",
            "assigned": "bg-yellow-100 text-yellow-700",
            "accepted": "bg-green-100 text-green-700",
            "departed": "bg-purple-100 text-purple-700",
            "arrived": "bg-indigo-100 text-indigo-700",
            "in_progress": "bg-orange-100 text-orange-700"
        };
        return statusMap[status] || "bg-gray-100 text-gray-700";
    }

    function getStatusText(status) {
        const statusMap = {
            "pending": "Chờ nhận",
            "assigned": "Đã được gán",
            "accepted": "Đã nhận đơn",
            "departed": "Đang di chuyển",
            "arrived": "Đã đến nơi",
            "in_progress": "Đang làm việc"
        };
        return statusMap[status] || status;
    }

    function renderPagination(totalItems) {
        const container = document.getElementById("pagination-controls");
        if (!container) return;
        container.innerHTML = "";

        const totalPages = Math.ceil(totalItems / itemsPerPage);

        if (totalPages <= 1) return;

        const prevBtn = document.createElement("button");
        prevBtn.innerHTML = '<span class="material-symbols-outlined text-sm">chevron_left</span>';
        prevBtn.className = `w-8 h-8 flex items-center justify-center rounded-lg border ${currentPage === 1 ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-600 border-gray-300 hover:bg-gray-50 hover:text-[#3730A3]'}`;
        prevBtn.disabled = currentPage === 1;
        prevBtn.onclick = () => {
            if (currentPage > 1) {
                currentPage--;
                applySortingAndRender();
                // Cuộn lên đầu danh sách việc
                document.getElementById("job-list").scrollIntoView({ behavior: "smooth", block: "start" });
            }
        };
        container.appendChild(prevBtn);

        // Các nút số trang
        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement("button");
            btn.innerText = i;
            if (i === currentPage) {
                // Style cho trang đang chọn
                btn.className = "w-8 h-8 flex items-center justify-center rounded-lg bg-[#3730A3] text-white font-bold shadow-md";
            } else {
                // Style cho trang thường
                btn.className = "w-8 h-8 flex items-center justify-center rounded-lg border border-gray-300 text-gray-600 hover:bg-gray-50 hover:text-[#3730A3]";
            }
            btn.onclick = () => {
                currentPage = i;
                applySortingAndRender();
                document.getElementById("job-list").scrollIntoView({ behavior: "smooth", block: "start" });
            };
            container.appendChild(btn);
        }

        // Nút Next
        const nextBtn = document.createElement("button");
        nextBtn.innerHTML = '<span class="material-symbols-outlined text-sm">chevron_right</span>';
        nextBtn.className = `w-8 h-8 flex items-center justify-center rounded-lg border ${currentPage === totalPages ? 'text-gray-300 border-gray-200 cursor-not-allowed' : 'text-gray-600 border-gray-300 hover:bg-gray-50 hover:text-[#3730A3]'}`;
        nextBtn.disabled = currentPage === totalPages;
        nextBtn.onclick = () => {
            if (currentPage < totalPages) {
                currentPage++;
                applySortingAndRender();
                document.getElementById("job-list").scrollIntoView({ behavior: "smooth", block: "start" });
            }
        };
        container.appendChild(nextBtn);
    }

    function renderOrders(orders) {
        const jobList = document.getElementById("job-list");
        if (!jobList) return;

        if (orders.length === 0) {
            jobList.innerHTML = `
                <div class="col-span-full text-center py-12">
                    <span class="material-symbols-outlined text-6xl text-gray-300 mb-4">work_off</span>
                    <p class="text-gray-500 font-medium">Hiện tại không có đơn hàng nào</p>
                </div>
            `;
            return;
        }

        jobList.innerHTML = orders.map(order => {
            // Get current tasker user ID
            const currentTaskerUserId = _id;
            
            // Check if order is assigned to current tasker
            const orderTaskerId = order.tasker_id?._id || order.tasker_id;
            const isAssignedToMe = order.status === "assigned" && orderTaskerId && String(orderTaskerId) === String(currentTaskerUserId);
            
            const isPending = order.status === "pending" && !order.tasker_id;
            const isAssigned = order.status === "assigned" && order.tasker_id;
            const isAccepted = ["accepted", "departed", "arrived", "in_progress"].includes(order.status);
            const isTaken = !isPending && !isAssigned && !isAccepted;

            const serviceName = order.task_snapshot?.name || order.task_id?.task_name || "Dịch vụ";
            const price = formatCurrency(order.final_amount || order.base_amount);
            const address = order.address_snapshot?.full_address || order.address_id?.full_address || "—";
            const timeDisplay = formatScheduledTime(order.scheduled_at, order.type);
            const isImmediate = order.type === "immediate";

            // Different card styles for pending vs assigned
            const cardBorderClass = isAssigned 
                ? "border-2 border-yellow-400" 
                : isPending 
                ? "border border-gray-200" 
                : "border border-gray-100";
            
            const cardBgClass = isAssigned 
                ? "bg-gradient-to-br from-yellow-50 to-white" 
                : "bg-white";
            
            const leftBarColor = isAssigned 
                ? "bg-yellow-500" 
                : isPending 
                ? "bg-blue-500" 
                : isTaken 
                ? "bg-gray-300" 
                : "bg-[#3730A3]";

            return `
                <div class="${cardBgClass} rounded-2xl p-5 shadow-sm ${cardBorderClass} hover:shadow-lg transition-all duration-300 flex flex-col justify-between h-full relative overflow-hidden group ${isTaken ? 'opacity-60 grayscale cursor-not-allowed' : ''}">
                    <div class="${leftBarColor} absolute left-0 top-0 bottom-0 w-1.5 transition-all group-hover:w-2"></div>
                    <div class="pl-3">
                        <div class="flex justify-between items-start mb-3">
                            <div>
                                <h2 class="text-[#111827] font-bold text-lg group-hover:text-[#3730A3] transition-colors ${isTaken ? 'text-gray-700' : ''}">${serviceName}</h2>
                                ${isPending ? 
                                    `<span style="background-color: #EEF2FF; color: #3730A3;" class="text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide inline-block mt-1">Mới</span>` :
                                    isAssigned ?
                                    `<span class="bg-yellow-100 text-yellow-700 text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide inline-block mt-1">Đã được gán</span>` :
                                    `<span class="${getStatusBadgeClass(order.status)} text-[10px] px-2 py-0.5 rounded font-bold uppercase tracking-wide inline-block mt-1">${getStatusText(order.status)}</span>`
                                }
                            </div>
                            <span style="color: #3730A3;" class="text-xl font-black ${isTaken ? 'text-gray-400' : ''}">${price}</span>
                        </div>
                        <div class="space-y-2 text-sm text-gray-600 border-t border-dashed border-gray-200 pt-3 ${isTaken ? 'text-gray-500' : ''}">
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-[18px] ${isImmediate ? 'text-red-500' : 'text-gray-400'}">${isImmediate ? 'timer' : 'schedule'}</span>
                                <span class="font-medium ${isImmediate ? 'font-bold text-red-500' : ''}">${timeDisplay}</span>
                            </div>
                            <div class="flex items-center gap-2">
                                <span class="material-symbols-outlined text-[18px] text-gray-400">location_on</span>
                                <span class="line-clamp-1">${address}</span>
                            </div>
                        </div>
                    </div>
                    <div class="flex gap-2 mt-5 ml-1">
                        ${isAssignedToMe ? 
                            `<button onclick="acceptOrder('${order._id}')" style="background-color: #3730A3;" class="flex-1 py-2.5 text-white font-bold rounded-xl shadow-md hover:opacity-90 transition-opacity">
                                Nhận việc ngay
                            </button>
                            <button onclick="viewOrderDetails('${order._id}')" style="color: #3730A3; border-color: #3730A3;" class="px-4 py-2.5 bg-white border-2 font-bold rounded-xl hover:bg-[#EEF2FF] transition-colors">
                                Xem chi tiết
                            </button>` :
                            isAccepted ?
                            `<button onclick="viewOrderDetails('${order._id}')" style="color: #3730A3; border-color: #3730A3;" class="w-full py-2.5 bg-white border-2 font-bold rounded-xl hover:bg-[#EEF2FF] transition-colors">
                                Xem chi tiết
                            </button>` :
                            `<button onclick="viewOrderDetails('${order._id}')" class="w-full py-2.5 bg-gray-100 border border-gray-200 text-gray-400 font-bold rounded-xl hover:bg-gray-200 transition-colors ${isPending ? 'cursor-pointer' : 'cursor-not-allowed'}" ${isPending ? '' : 'disabled'}>
                                ${isPending ? 'Xem chi tiết' : 'Đã có người nhận'}
                            </button>`
                        }
                    </div>
                </div>
            `;
        }).join("");
    }

    async function acceptOrder(orderId) {
        if (!confirm("Bạn có chắc chắn muốn nhận đơn hàng này?")) {
            return;
        }

        try {
            const res = await fetch(`http://localhost:3000/api/tasker/accept/${orderId}`, {
                method: "PUT",
                headers: {
                    Authorization: `Bearer ${token}`
                }
            });

            const data = await res.json();

            if (res.ok && data.success) {
                alert("Nhận đơn hàng thành công!");
                loadAvailableOrders();
            } else {
                alert(data.message || "Nhận đơn hàng thất bại");
            }
        } catch (err) {
            console.error("Error accepting order:", err);
            alert("Có lỗi xảy ra khi nhận đơn hàng");
        }
    }

    function viewOrderDetails(orderId) {
        localStorage.setItem("currentOrderId", orderId);
        window.location.href = `./tasker_order_progress.html?orderId=${orderId}`;
    }

    // Setup sort filter buttons
    const sortNearBtn = document.getElementById("sort-near");
    const sortPriceBtn = document.getElementById("sort-price");

    if (sortNearBtn) {
        sortNearBtn.addEventListener("click", () => {
            if (currentSortMode === "near") {
                // Toggle off
                currentSortMode = null;
            } else {
                currentSortMode = "near";
            }
            currentPage = 1;
            updateFilterButtons(currentSortMode);
            applySortingAndRender();
        });
    }

    if (sortPriceBtn) {
        sortPriceBtn.addEventListener("click", () => {
            if (currentSortMode === "price") {
                // Toggle off
                currentSortMode = null;
            } else {
                currentSortMode = "price";
            }
            currentPage = 1;
            updateFilterButtons(currentSortMode);
            applySortingAndRender();
        });
    }

    // Load orders when page loads
    loadAvailableOrders();

    // Cashout UI logic: load amounts, handle cashout
    function formatCurrency(amount) {
        try {
            return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(Number(amount || 0));
        } catch (e) {
            return amount;
        }
    }

    function showToast(message, type = 'info') {
        const toast = document.getElementById('toast');
        if (!toast) return;
        toast.innerHTML = '';
        const el = document.createElement('div');
        el.className = `px-4 py-2 rounded shadow ${type === 'success' ? 'bg-green-500 text-white' : type === 'error' ? 'bg-red-500 text-white' : 'bg-gray-800 text-white'}`;
        el.textContent = message;
        toast.appendChild(el);
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 4000);
    }

    async function loadCashoutInfo() {
        try {
            const [todayRes, availRes] = await Promise.all([
                fetch('http://localhost:3000/api/tasker/cashOut', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } }),
                fetch('http://localhost:3000/api/tasker/cashOut/available', { headers: { Authorization: `Bearer ${localStorage.getItem('token')}` } })
            ]);
            const todayJson = await todayRes.json();
            const availJson = await availRes.json();

            const today = todayJson && todayJson.success ? todayJson.data : 0;
            const available = availJson && availJson.success ? availJson.data : 0;

            const todayEl = document.getElementById('todayEarnings');
            const availEl = document.getElementById('availableBalance');
            const btn = document.getElementById('cashoutBtn');

            if (todayEl) todayEl.textContent = formatCurrency(today);
            if (availEl) availEl.textContent = formatCurrency(available);

            if (btn) {
                if (!available || Number(available) <= 0) {
                    btn.disabled = true;
                } else {
                    btn.disabled = false;
                }
            }
        } catch (err) {
            console.error('loadCashoutInfo error', err);
            showToast('Không thể tải thông tin rút tiền', 'error');
        }
    }

    async function performCashout() {
        const btn = document.getElementById('cashoutBtn');
        const spinner = document.getElementById('cashoutSpinner');
        const text = document.getElementById('cashoutBtnText');
        if (!btn) return;
        
        const originalText = text.textContent;
        const originalDisabled = btn.disabled;
        
        try {
            btn.disabled = true;
            spinner.classList.remove('hidden');
            text.textContent = 'Đang xử lý...';

            const res = await fetch('http://localhost:3000/api/tasker/cashOut', {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${localStorage.getItem('token')}` }
            });
            const body = await res.json();
            if (body && body.success) {
                showToast('Yêu cầu rút tiền thành công', 'success');
                await loadCashoutInfo();
            } else {
                showToast(body && body.message ? body.message : 'Rút tiền thất bại', 'error');
                // Reload cashout info to restore button state
                await loadCashoutInfo();
            }
        } catch (err) {
            console.error('performCashout error', err);
            showToast('Lỗi kết nối, vui lòng thử lại', 'error');
            // Reload cashout info to restore button state
            await loadCashoutInfo();
        } finally {
            spinner.classList.add('hidden');
            // Restore button text
            text.textContent = 'Rút ngay';
            // Button state will be set by loadCashoutInfo, but ensure it's not stuck disabled
            btn.disabled = false;
        }
    }

    document.addEventListener('DOMContentLoaded', () => {
        loadCashoutInfo();
        const btn = document.getElementById('cashoutBtn');
        if (btn) btn.addEventListener('click', performCashout);
    });