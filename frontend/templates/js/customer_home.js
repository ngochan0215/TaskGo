
      let token = localStorage.getItem("token");
      if (!token) {
        alert("Vui lòng đăng nhập");
        window.location.href = "../auth/login-signup.html";
      }
      console.log("User token:", token);

      const role = localStorage.getItem("system_role");
      console.log("User role:", role);
      if (role !== "customer") {
        alert("Bạn không có quyền truy cập trang này. Vui lòng đăng nhập lại.");
        window.location.href = "../auth/login-signup.html";
      }

      const TASK_DETAIL_MAP = {
        cleaning_washing_machine:
          "./detail_pages/cleaning_washing_machine.html",
        cleaning_house: "./detail_pages/cleaning_house.html",
        cleaning_air_conditioner:
          "./detail_pages/cleaning_air_conditioner.html",
        caring_elderly: "./detail_pages/takecare_of_elder.html",
        caring_thesick: "./detail_pages/takecare_of_sickpeople.html",
        caring_children: "./detail_pages/babysitting.html",
        shopping: "./detail_pages/market.html",
        cooking: "./detail_pages/cooking.html",
        active: "#",
      };

      const PROMO_COLORS = [
        { bg: "#5c956c", badge: "bg-primary-100 text-primary-500 border-primary-200" },
        { bg: "#ffbe18", badge: "bg-yellow-50 text-yellow-700 border-yellow-200" },
        { bg: "#12a327", badge: "bg-green-50 text-green-700 border-green-200" },
        { bg: "#8b5cf6", badge: "bg-purple-50 text-purple-700 border-purple-200" },
        { bg: "#f59e0b", badge: "bg-orange-50 text-orange-700 border-orange-200" },
        { bg: "#ef4444", badge: "bg-red-50 text-red-700 border-red-200" },
        { bg: "#06b6d4", badge: "bg-cyan-50 text-cyan-700 border-cyan-200" },
        { bg: "#ec4899", badge: "bg-pink-50 text-pink-700 border-pink-200" }
      ];

      let currentPromoCode = "";

      function formatDate(dateString) {
        if (!dateString) return "";
        const d = new Date(dateString);
        return d.toLocaleDateString("vi-VN", {
          day: "2-digit",
          month: "2-digit",
          year: "numeric",
          hour: "2-digit",
          minute: "2-digit"
        });
      }

      function formatDateRange(begin, end) {
        const beginStr = formatDate(begin);
        const endStr = formatDate(end);
        return `${beginStr} - ${endStr}`;
      }

      function getDayName(dayNum) {
        const days = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
        return days[dayNum] || "";
      }

      function getTierName(tier) {
        const map = { NEW: "Mới", LOYAL: "Thân thiết", VIP: "VIP" };
        return map[tier] || tier;
      }

      async function loadPromotions() {
        try {
          const res = await fetch("http://localhost:3000/api/discount/active", {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (res.status === 401) {
            localStorage.removeItem("token");
            alert("Phiên đăng nhập hết hạn");
            window.location.href = "../auth/login-signup.html";
            return;
          }

          const data = await res.json();
          const container = document.getElementById("promo-list");
          
          if (!data.success || !data.promotions || data.promotions.length === 0) {
            container.innerHTML = `
              <div class="flex-shrink-0 w-full text-center py-8 text-gray-400 text-sm">
                <span class="material-symbols-outlined text-4xl mb-2 block">local_activity</span>
                <p>Hiện chưa có chương trình khuyến mãi</p>
              </div>
            `;
            return;
          }

          container.innerHTML = "";
          data.promotions.forEach((promo, index) => {
            const color = PROMO_COLORS[index % PROMO_COLORS.length];
            const card = document.createElement("div");
            card.className = "flex-shrink-0 w-[280px] bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden cursor-pointer hover:shadow-md transition-shadow";
            card.onclick = () => openPromoModal(promo.id, promo.type);

            const typeLabel = promo.type === "discount" ? "Khuyến mãi" : "Voucher";
            const shortDesc = promo.description ? (promo.description.length > 60 ? promo.description.substring(0, 60) + "..." : promo.description) : "";

            const discountDisplay = promo.discount_text || (promo.discount_type === "PERCENT" 
              ? `Giảm ${promo.discount_value}%` 
              : `Giảm ${Number(promo.discount_value).toLocaleString("vi-VN")}đ`);

            card.innerHTML = `
              <div class="p-4 relative">
                <div class="absolute -top-10 -right-10 w-32 h-32 rounded-full opacity-20" style="background: ${color.bg}"></div>
                <p class="text-xs font-bold text-gray-500 uppercase">${typeLabel}</p>
                <h3 class="text-lg font-black text-dark-900 mt-1 line-clamp-2">${promo.name}</h3>
                <p class="text-sm text-gray-600 mt-1 line-clamp-2">${shortDesc || "Xem chi tiết để biết thêm thông tin."}</p>
                <div class="mt-3 mb-2">
                  <span class="text-xs font-semibold text-primary-500">${discountDisplay}</span>
                </div>
                <div class="mt-2 flex items-center justify-between">
                  <span class="text-xs font-bold px-3 py-1 rounded-full ${color.badge} border">
                    ${promo.code}
                  </span>
                  <button
                    type="button"
                    onclick="event.stopPropagation(); copyPromoCodeStatic('${promo.code}')"
                    class="text-sm font-bold text-white px-4 py-2 rounded-xl shadow-sm hover:opacity-90 transition"
                    style="background: #3b5f43"
                  >
                    Copy mã
                  </button>
                </div>
              </div>
            `;
            container.appendChild(card);
          });
        } catch (err) {
          console.error("Load promotions error:", err);
          const container = document.getElementById("promo-list");
          container.innerHTML = `
            <div class="flex-shrink-0 w-full text-center py-8 text-red-400 text-sm">
              <p>Không thể tải chương trình khuyến mãi</p>
            </div>
          `;
        }
      }

      async function openPromoModal(id, type) {
        try {
          const res = await fetch(`http://localhost:3000/api/discount/detail/${type}/${id}`, {
            headers: { Authorization: `Bearer ${token}` }
          });

          if (res.status === 401) {
            localStorage.removeItem("token");
            alert("Phiên đăng nhập hết hạn");
            window.location.href = "../auth/login-signup.html";
            return;
          }

          const data = await res.json();
          if (!data.success || !data.promotion) {
            alert("Không tìm thấy thông tin khuyến mãi");
            return;
          }

          const promo = data.promotion;
          currentPromoCode = promo.code;

          // Set basic info
          document.getElementById("promo-modal-code").textContent = promo.code;
          document.getElementById("promo-modal-name").textContent = promo.name;
          document.getElementById("promo-modal-description").textContent = promo.description || "Không có mô tả";
          document.getElementById("promo-modal-discount").textContent = promo.discount_text;
          document.getElementById("promo-modal-dates").innerHTML = formatDateRange(promo.begin_date, promo.end_date);

          // Set type badge
          const typeBadge = document.getElementById("promo-modal-type-badge");
          if (promo.type === "discount") {
            typeBadge.textContent = "KHUYẾN MÃI";
            typeBadge.className = "text-xs font-bold px-3 py-1 rounded-full bg-primary-100 text-primary-500 border border-primary-200";
          } else {
            typeBadge.textContent = "VOUCHER";
            typeBadge.className = "text-xs font-bold px-3 py-1 rounded-full bg-purple-100 text-purple-500 border border-purple-200";
          }

          // Set conditions
          const conditionsList = document.getElementById("promo-modal-conditions-list");
          conditionsList.innerHTML = "";
          const conditions = promo.conditions || {};

          if (conditions.min_order_value) {
            conditionsList.innerHTML += `
              <div class="flex items-start gap-2">
                <span class="material-symbols-outlined text-sm text-gray-400 mt-0.5">shopping_cart</span>
                <span class="text-gray-700">Đơn hàng tối thiểu: <strong>${Number(conditions.min_order_value).toLocaleString("vi-VN")}đ</strong></span>
              </div>
            `;
          }

          if (conditions.days_of_week && conditions.days_of_week.length > 0) {
            const dayNames = conditions.days_of_week.map(d => getDayName(d)).join(", ");
            conditionsList.innerHTML += `
              <div class="flex items-start gap-2">
                <span class="material-symbols-outlined text-sm text-gray-400 mt-0.5">calendar_today</span>
                <span class="text-gray-700">Áp dụng vào: <strong>${dayNames}</strong></span>
              </div>
            `;
          }

          if (conditions.hours_range) {
            conditionsList.innerHTML += `
              <div class="flex items-start gap-2">
                <span class="material-symbols-outlined text-sm text-gray-400 mt-0.5">schedule</span>
                <span class="text-gray-700">Khung giờ: <strong>${conditions.hours_range.from}:00 - ${conditions.hours_range.to}:00</strong></span>
              </div>
            `;
          }

          if (conditions.customer_tiers && conditions.customer_tiers.length > 0) {
            const tierNames = conditions.customer_tiers.map(t => getTierName(t)).join(", ");
            conditionsList.innerHTML += `
              <div class="flex items-start gap-2">
                <span class="material-symbols-outlined text-sm text-gray-400 mt-0.5">star</span>
                <span class="text-gray-700">Hạng khách hàng: <strong>${tierNames}</strong></span>
              </div>
            `;
          }

          if (conditions.rule_type === "FIRST_ORDER") {
            conditionsList.innerHTML += `
              <div class="flex items-start gap-2">
                <span class="material-symbols-outlined text-sm text-gray-400 mt-0.5">new_releases</span>
                <span class="text-gray-700">Chỉ áp dụng cho <strong>đơn hàng đầu tiên</strong></span>
              </div>
            `;
          }

          if (promo.type === "discount" && conditions.task_ids && conditions.task_ids.length > 0) {
            conditionsList.innerHTML += `
              <div class="flex items-start gap-2">
                <span class="material-symbols-outlined text-sm text-gray-400 mt-0.5">design_services</span>
                <span class="text-gray-700">Áp dụng cho <strong>${conditions.task_ids.length} dịch vụ cụ thể</strong></span>
              </div>
            `;
          }

          if (conditionsList.innerHTML === "") {
            conditionsList.innerHTML = '<span class="text-gray-400 text-xs">Không có điều kiện đặc biệt</span>';
          }

          // Set eligibility
          const eligibilityStatus = document.getElementById("promo-modal-eligibility-status");
          const eligibilityReasons = document.getElementById("promo-modal-eligibility-reasons");
          
          if (promo.is_eligible) {
            eligibilityStatus.innerHTML = `
              <div class="flex items-center gap-2 text-green-600">
                <span class="material-symbols-outlined text-sm">check_circle</span>
                <span class="font-semibold">Bạn đủ điều kiện sử dụng khuyến mãi này</span>
              </div>
            `;
            eligibilityReasons.innerHTML = "";
          } else {
            eligibilityStatus.innerHTML = `
              <div class="flex items-center gap-2 text-red-600">
                <span class="material-symbols-outlined text-sm">cancel</span>
                <span class="font-semibold">Bạn chưa đủ điều kiện sử dụng</span>
              </div>
            `;
            if (promo.eligibility_reasons && promo.eligibility_reasons.length > 0) {
              eligibilityReasons.innerHTML = promo.eligibility_reasons.map(r => 
                `<div class="text-red-500">• ${r}</div>`
              ).join("");
            }
          }

          // Set voucher-specific info
          const voucherInfo = document.getElementById("promo-modal-voucher-info");
          if (promo.type === "voucher") {
            voucherInfo.classList.remove("hidden");
            document.getElementById("promo-modal-remaining").textContent = 
              promo.remaining_quantity !== null 
                ? `${promo.remaining_quantity}/${promo.total_quantity}`
                : "Không giới hạn";
            document.getElementById("promo-modal-used-by-user").textContent = 
              `${promo.used_by_user || 0}/${promo.per_user_limit || "∞"}`;
          } else {
            voucherInfo.classList.add("hidden");
          }

          // Show modal
          document.getElementById("promo-modal").classList.add("show");
        } catch (err) {
          console.error("Open promo modal error:", err);
          alert("Không thể tải thông tin chi tiết khuyến mãi");
        }
      }

      function closePromoModal() {
        document.getElementById("promo-modal").classList.remove("show");
        currentPromoCode = "";
      }

      function copyPromoCode() {
        if (!currentPromoCode) return;
        copyPromoCodeStatic(currentPromoCode);
      }

      function copyPromoCodeStatic(code) {
        navigator.clipboard.writeText(code).then(() => {
          alert(`Đã copy mã: ${code}`);
        }).catch(() => {
          alert(`Không copy được tự động. Mã: ${code}`);
        });
      }

      // Close modal when clicking outside
      window.onclick = (event) => {
        const promoModal = document.getElementById("promo-modal");
        if (event.target === promoModal) {
          closePromoModal();
        }
        const taskerModal = document.getElementById("tasker-modal");
        if (event.target === taskerModal) {
          taskerModal.classList.remove("show");
        }
      };

      async function loadCustomerStats() {
        try {
          const statsRes = await fetch(
            "http://localhost:3000/api/order/statistics/completed-cancelled",
            { headers: { Authorization: `Bearer ${token}` } },
          );

          const pointsRes = await fetch(
            "http://localhost:3000/api/user/reputation-score",
            { headers: { Authorization: `Bearer ${token}` } },
          );

          if (statsRes.status === 401 || pointsRes.status === 401) {
            localStorage.removeItem("token");
            alert("Token hết hạn. Vui lòng đăng nhập lại.");
            window.location.href = "../auth/login-signup.html";
            return;
          }

          if (!statsRes.ok || !pointsRes.ok) {
            console.error("Load customer stats failed:",
              statsRes.status,
              pointsRes.status,
            );
            return;
          }

          const statsJson = await statsRes.json();
          const pointsJson = await pointsRes.json();

          const { completed_orders, cancelled_orders } = statsJson.data || {};
          document.getElementById("customer-points").textContent =
            pointsJson.points ?? 0;
          document.getElementById("customer-completed-orders").textContent =
            completed_orders ?? 0;
          document.getElementById("customer-cancelled-orders").textContent =
            cancelled_orders ?? 0;
        } catch (err) {
          console.error("Load customer stats error:" + err);
        }
      }

      async function loadFavoriteTasks() {
        try {
          const res = await fetch(
            "http://localhost:3000/api/task/favorite/by-user",
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );

          if (res.status === 401) {
            localStorage.removeItem("token");
            alert("Phiên đăng nhập hết hạn");
            window.location.href = "../auth/login-signup.html";
            return;
          }

          const json = await res.json();
          const container = document.getElementById("favorite-services");

          if (!json.success || !json.data || json.data.length === 0) {
            container.innerHTML = `
              <div class="col-span-2 text-center py-8 text-gray-400 text-sm">
                <span class="material-symbols-outlined text-4xl mb-2 block">favorite_border</span>
                <p>Bạn chưa có dịch vụ yêu thích</p>
                <p class="text-xs mt-1">Đặt dịch vụ để xem ở đây</p>
              </div>
            `;
            return;
          }

          container.innerHTML = "";
          json.data.forEach((task) => {
            const detailPage = TASK_DETAIL_MAP[task.task_type] || "#";
            const div = document.createElement("div");
            div.className =
              "bg-white rounded-xl shadow-sm p-4 cursor-pointer hover:shadow-md transition-shadow";
            div.onclick = () => {
              window.location.href = `${detailPage}?id=${task.task_id}&price=${task.pricing}`;
            };

            const avatarImg = task.avatar_url
              ? `<img src="${task.avatar_url}" class="w-full h-full object-cover rounded-lg">`
              : `<span class="material-symbols-outlined text-4xl text-primary-500">design_services</span>`;

            const price = task.pricing
              ? `<p class="text-xs font-semibold text-primary-500 mt-1">${Number(task.pricing).toLocaleString("vi-VN")}đ/${task.unit === "hour" ? "giờ" : "gói"}</p>`
              : "";

            div.innerHTML = `
              <div class="w-full h-32 bg-primary-100 rounded-lg mb-2 flex items-center justify-center overflow-hidden">
                ${avatarImg}
              </div>
              <p class="text-sm font-medium text-dark-900 line-clamp-2">${task.task_name || "Dịch vụ"}</p>
              ${price}
              <p class="text-xs text-gray-500 mt-1">Đã đặt ${task.total_orders} lần</p>
            `;
            container.appendChild(div);
          });
        } catch (err) {
          console.error("Load favorite tasks error:", err);
        }
      }

      async function loadPopularTasks() {
        try {
          const res = await fetch(
            "http://localhost:3000/api/task/top-popular/by-orders",
          );
          const json = await res.json();
          const serviceList = document.getElementById("service-list");

          if (!json.success || !json.data || json.data.length === 0) {
            serviceList.innerHTML = `
              <div class="col-span-full text-center py-8 text-gray-400 text-sm">
                <p>Không có dịch vụ phổ biến</p>
              </div>
            `;
            return;
          }

          serviceList.innerHTML = "";
          json.data.forEach((task) => {
            const detailPage = TASK_DETAIL_MAP[task.task_type] || "#";
            const div = document.createElement("div");
            div.className =
              "service-item relative cursor-pointer hover:opacity-90 transition-opacity";
            div.onclick = () => {
              window.location.href = `${detailPage}?id=${task.task_id}&price=${task.pricing}`;
            };

            const avatarImg = task.avatar_url
              ? `<img src="${task.avatar_url}" class="w-full h-full object-cover rounded-xl">`
              : `<span class="material-symbols-outlined text-5xl text-primary-500">design_services</span>`;

            const price = task.pricing
              ? `<p class="text-xs text-primary-500 font-semibold mt-1">${Number(task.pricing).toLocaleString("vi-VN")}đ/${task.unit === "hour" ? "giờ" : "gói"}</p>`
              : "";

            div.innerHTML = `
              <div class="w-full h-48 bg-primary-100 rounded-xl flex items-center justify-center relative overflow-hidden">
                ${avatarImg}
                <div class="absolute top-2 right-2 bg-primary-500 text-white text-xs font-bold px-2 py-1 rounded-full">
                  ${task.total_orders} đơn
                </div>
              </div>
              <p class="mt-1 text-sm font-medium text-dark-900">${task.task_name || "Dịch vụ"}</p>
              ${price}
            `;
            serviceList.appendChild(div);
          });
        } catch (err) {
          console.error("Load popular tasks error:", err);
        }
      }

      async function loadFavoriteTaskers() {
        try {
          const res = await fetch(
            "http://localhost:3000/api/user/favorites/taskers",
            {
              headers: { Authorization: `Bearer ${token}` },
            },
          );

          if (res.status === 401) {
            localStorage.removeItem("token");
            alert("Phiên đăng nhập hết hạn");
            window.location.href = "../auth/login-signup.html";
            return;
          }

          const json = await res.json();
          const container = document.getElementById("favorite-taskers-list");
          container.innerHTML = "";

          if (!json.data || json.data.length === 0) {
            container.innerHTML = `<p class="text-sm text-gray-400 px-4">Bạn chưa có tasker yêu thích</p>`;
            return;
          }

          json.data.forEach((item) => {
            const tasker = item.tasker;
            const user = item.user;
            const reviews = item.reviews;
            const avatar =
              user.avatar_url ||
              "https://api.dicebear.com/9.x/bottts/svg?seed=Julia";

            const card = document.createElement("div");
            card.className =
              "flex-shrink-0 w-24 flex flex-col items-center cursor-pointer group";
            card.onclick = () =>
              openTaskerModal({
                name: user.full_name,
                avatar,
                rating: reviews.average_rating || 0,
                reviews: reviews.review_count || 0,
                skills: tasker.skills || [],
                reputation_score: user.reputation_score || 0,
                jobs: tasker.total_completed_orders || 0,
                location: tasker.working_area?.full_address || "—",
                bio: tasker.introduction || "",
              });

            card.innerHTML = `
              <div class="w-16 h-16 rounded-full overflow-hidden border-2 border-white shadow-md group-hover:border-primary-500 transition-colors">
                <img src="${avatar}" class="w-full h-full object-cover">
              </div>
              <p class="text-xs font-medium text-center mt-2 text-dark-900 group-hover:text-primary-500 truncate w-full">
                ${user.full_name}
              </p>
              <div class="flex items-center text-[10px] text-gray-500">
                <span class="material-symbols-outlined text-[10px] text-yellow-500 mr-0.5">star</span>
                ${reviews.average_rating || 0}
              </div>
            `;
            container.appendChild(card);
          });
        } catch (err) {
          console.error("Load favorite taskers error:", err);
        }
      }

      const modal = document.getElementById("tasker-modal");
      const closeModalBtn = document.querySelector(".close-modal");

      async function openTaskerModal(tasker) {
        document.getElementById("modal-tasker-avatar").src = tasker.avatar;
        document.getElementById("modal-tasker-name").textContent = tasker.name;
        document.getElementById("modal-tasker-rating").textContent =
          tasker.rating;
        document.getElementById("modal-tasker-reviews").textContent =
          `(${tasker.reviews} đánh giá)`;
        document.getElementById("modal-tasker-reputation").textContent =
          tasker.reputation_score || 0;
        document.getElementById("modal-tasker-jobs").textContent =
          `${tasker.jobs} việc`;
        document.getElementById("modal-tasker-location").textContent =
          tasker.location;
        document.getElementById("modal-tasker-bio").textContent = tasker.bio;

        await loadTaskerSkills(tasker.skills || []);
        modal.classList.add("show");
      }

      async function loadTaskerSkills(skillIds) {
        const skillsContainer = document.getElementById("modal-tasker-skills");

        if (!skillIds || skillIds.length === 0) {
          skillsContainer.innerHTML =
            '<span class="text-xs text-gray-400">Chưa có chuyên môn</span>';
          return;
        }

        skillsContainer.innerHTML =
          '<span class="text-xs text-gray-400">Đang tải...</span>';

        try {
          const res = await fetch("http://localhost:3000/api/task/all", {
            headers: { Authorization: `Bearer ${token}` },
          });

          if (res.status === 401) {
            localStorage.removeItem("token");
            alert("Phiên đăng nhập hết hạn");
            window.location.href = "../auth/login-signup.html";
            return;
          }

          const json = await res.json();
          if (!json.success || !json.tasks) {
            skillsContainer.innerHTML =
              '<span class="text-xs text-gray-400">Không thể tải chuyên môn</span>';
            return;
          }

          const taskMap = new Map();
          json.tasks.forEach((t) => taskMap.set(t._id, t.task_name));

          const skillNames = skillIds
            .map((id) => {
              const taskId = typeof id === "object" ? id.toString() : id;
              return taskMap.get(taskId);
            })
            .filter(Boolean);

          skillsContainer.innerHTML =
            skillNames.length === 0
              ? '<span class="text-xs text-gray-400">Chưa có chuyên môn</span>'
              : skillNames
                  .map(
                    (name) =>
                      `<span class="px-2 py-1 bg-primary-100 text-primary-700 text-xs font-medium rounded-full border border-primary-200">${name}</span>`,
                  )
                  .join("");
        } catch (err) {
          console.error("Load tasker skills error:", err);
          skillsContainer.innerHTML =
            '<span class="text-xs text-gray-400">Không thể tải chuyên môn</span>';
        }
      }

      if (closeModalBtn)
        closeModalBtn.onclick = () => modal.classList.remove("show");
      window.onclick = (event) => {
        if (event.target === modal) modal.classList.remove("show");
      };

      document.addEventListener("DOMContentLoaded", () => {
        loadCustomerStats();
        loadPromotions();
        loadFavoriteTasks?.();
        loadFavoriteTaskers?.();
        loadPopularTasks?.();
    });

      window.closePromoModal = closePromoModal;
      window.copyPromoCode = copyPromoCode;