const token = localStorage.getItem("token");
const role = localStorage.getItem("system_role");
const taskerUserId = localStorage.getItem("user_id");
if (!token) {
  alert("Vui lòng đăng nhập");
  location.href = "../auth/login-signup.html";
}
if (role !== "tasker") {
  alert("Bạn không phải là Tasker. Vui lòng đăng nhập lại.");
  location.href = "../auth/login-signup.html";
}
console.log("TOKEN: ", token);
console.log("TASKER USER ID: ", taskerUserId);

const $ = (id) => document.getElementById(id);

const tabCurrentWorking = $("tabCurrentWorking");
const tabScheduled = $("tabScheduled");
const tabHistory = $("tabHistory");
const currentWorkingSection = $("currentWorkingSection");
const scheduledSection = $("scheduledSection");
const historySection = $("historySection");

const currentWorkingList = $("currentWorkingList");
const scheduledList = $("scheduledList");
const historyList = $("historyList");
const currentWorkingEmpty = $("currentWorkingEmpty");
const scheduledEmpty = $("scheduledEmpty");
const historyEmpty = $("historyEmpty");
const currentWorkingCount = $("currentWorkingCount");
const scheduledCount = $("scheduledCount");
const historyCount = $("historyCount");
const searchInput = $("searchInput");

let currentQuery = "";
let allOrders = [];
let currentWorkingOrders = [];
let scheduledOrders = [];
let historyOrders = [];
let currentOrderDetail = null;

// Payment method mapping
const paymentMethodMap = {
  cash: "Tiền mặt",
  credit_card: "Thẻ tín dụng",
  bank_transfer: "Chuyển khoản",
  ewallet: "Ví TaskGo"
};

const tabs = ['tabCurrentWorking', 'tabScheduled', 'tabHistory'];
const sections = ['currentWorkingSection', 'scheduledSection', 'historySection'];
tabs.forEach((tabId, index) => {
        document.getElementById(tabId).addEventListener('click', () => {
            tabs.forEach(t => {
                const el = document.getElementById(t);
                el.style.backgroundColor = '';
                el.style.color = '';
                el.className = "flex-1 py-2.5 rounded-xl text-sm font-bold text-gray-500 hover:text-[#3730A3] hover:bg-gray-50 transition-all";
            });

            const activeEl = document.getElementById(tabId);
            activeEl.style.backgroundColor = '#E0E7FF';
            activeEl.style.color = '#3730A3';
            activeEl.className = "flex-1 py-2.5 rounded-xl text-sm font-bold shadow-sm transition-all";

            sections.forEach(s => document.getElementById(s).classList.add('hidden'));
            document.getElementById(sections[index]).classList.remove('hidden');
        });
    });

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

// Status UI mapping for tasker
function statusUI(status) {
  const statusMap = {
    pending: {
      text: "Chờ xác nhận",
      cls: "bg-yellow-50 text-yellow-700 border-yellow-200",
    },
    assigned: {
      text: "Đã được gán",
      cls: "bg-purple-50 text-purple-700 border-purple-200",
    },
    accepted: {
      text: "Đã nhận đơn",
      cls: "bg-indigo-50 text-indigo-700 border-indigo-200",
    },
    departed: {
      text: "Đang di chuyển",
      cls: "bg-cyan-50 text-cyan-700 border-cyan-200",
    },
    arrived: {
      text: "Đã đến nơi",
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
  const customerName = order.customer_id?.full_name || "Khách hàng";

  // Determine category
  let category = "history";
  if (["accepted", "departed", "arrived", "in_progress"].includes(order.status)) {
    category = "current_working";
  } else if (order.type === "scheduled" && ["pending", "assigned"].includes(order.status)) {
    category = "scheduled";
  } else if (["completed", "cancelled"].includes(order.status)) {
    category = "history";
  }

  return {
    id: orderId,
    _id: order._id,
    category: category,
    status: order.status,
    service: service,
    task: service,
    time: time,
    timeISO: timeISO,
    address: address,
    total: total,
    payment: paymentMethod,
    customerName: customerName,
    order: order // Keep full order object for detail view
  };
}

// Card template
function cardTemplate(o) {
  const st = statusUI(o.status);
  return `
    <button type="button" data-order="${o._id}"
            class="w-full text-left bg-white rounded-2xl shadow-md border border-gray-200 p-4 hover:opacity-95 transition">
      <div class="flex items-start justify-between gap-3">
        <div class="min-w-0 flex-1">
          <div class="font-bold text-gray-900 truncate">${o.service}</div>
          <div class="text-sm text-indigo-600 truncate">${o.task}</div>

          <div class="mt-3 space-y-1">
            <div class="text-sm text-gray-600 font-medium">
              Khách hàng: <span class="font-semibold">${o.customerName}</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-gray-600">
              <span class="material-symbols-outlined text-[18px] text-indigo-500">schedule</span>
              <span class="truncate">${o.time}</span>
            </div>
            <div class="flex items-center gap-2 text-sm text-gray-600">
              <span class="material-symbols-outlined text-[18px] text-indigo-500">location_on</span>
              <span class="truncate">${o.address}</span>
            </div>
          </div>

          <div class="mt-3 flex items-center justify-between">
            <div class="text-xs text-gray-500 font-semibold">#${o.id}</div>
            <div class="font-black text-gray-900">${formatMoney(o.total)}</div>
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
      (o.address || "").toLowerCase().includes(q) ||
      (o.customerName || "").toLowerCase().includes(q)
  );
}

// Fetch orders from API
async function fetchOrders() {
  try {
    // Fetch current working orders
    const currentWorkingRes = await fetch(
      `http://localhost:3000/api/tasker/orders?category=current_working&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    // Fetch scheduled orders
    const scheduledRes = await fetch(
      `http://localhost:3000/api/tasker/orders?category=scheduled&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    // Fetch history orders
    const historyRes = await fetch(
      `http://localhost:3000/api/tasker/orders?category=history&limit=100`,
      {
        headers: {
          Authorization: `Bearer ${token}`
        }
      }
    );

    if (currentWorkingRes.status === 401 || scheduledRes.status === 401 || historyRes.status === 401) {
      localStorage.removeItem("token");
      alert("Phiên đăng nhập hết hạn");
      location.href = "../auth/login-signup.html";
      return;
    }

    const currentWorkingData = await currentWorkingRes.json();
    const scheduledData = await scheduledRes.json();
    const historyData = await historyRes.json();

    if (currentWorkingData.success) {
      currentWorkingOrders = currentWorkingData.orders.map(transformOrder);
    }

    if (scheduledData.success) {
      scheduledOrders = scheduledData.orders.map(transformOrder);
    }

    if (historyData.success) {
      historyOrders = historyData.orders.map(transformOrder);
    }

    allOrders = [...currentWorkingOrders, ...scheduledOrders, ...historyOrders];
    render();
  } catch (error) {
    console.error("Error fetching orders:", error);
    alert("Không thể tải danh sách đơn hàng");
  }
}

// Render orders
function render() {
  const currentWorking = applySearch(currentWorkingOrders);
  const scheduled = applySearch(scheduledOrders);
  const history = applySearch(historyOrders);

  currentWorkingCount.textContent = `${currentWorking.length} đơn`;
  scheduledCount.textContent = `${scheduled.length} đơn`;
  historyCount.textContent = `${history.length} đơn`;

  currentWorkingList.innerHTML = currentWorking.map(cardTemplate).join("");
  scheduledList.innerHTML = scheduled.map(cardTemplate).join("");
  historyList.innerHTML = history.map(cardTemplate).join("");

  currentWorkingEmpty.classList.toggle("hidden", currentWorking.length !== 0);
  scheduledEmpty.classList.toggle("hidden", scheduled.length !== 0);
  historyEmpty.classList.toggle("hidden", history.length !== 0);

  // Attach click handlers
  document.querySelectorAll("[data-order]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const orderId = btn.getAttribute("data-order");
      const order = allOrders.find((o) => String(o._id) === String(orderId));
      if (order) {
        window.location.href = `./tasker_order_progress.html?orderId=${orderId}`;
      }
    });
  });
}

// Set active tab
function setTab(tab) {
  // Reset all tabs
  [tabCurrentWorking, tabScheduled, tabHistory].forEach(t => {
    t.classList.remove("bg-white", "text-gray-900");
    t.classList.add("text-indigo-600", "hover:text-gray-900");
  });

  // Hide all sections
  [currentWorkingSection, scheduledSection, historySection].forEach(s => {
    s.classList.add("hidden");
  });

  // Activate selected tab
  if (tab === "current_working") {
    tabCurrentWorking.classList.add("bg-white", "text-gray-900");
    tabCurrentWorking.classList.remove("text-indigo-600", "hover:text-gray-900");
    currentWorkingSection.classList.remove("hidden");
  } else if (tab === "scheduled") {
    tabScheduled.classList.add("bg-white", "text-gray-900");
    tabScheduled.classList.remove("text-indigo-600", "hover:text-gray-900");
    scheduledSection.classList.remove("hidden");
  } else if (tab === "history") {
    tabHistory.classList.add("bg-white", "text-gray-900");
    tabHistory.classList.remove("text-indigo-600", "hover:text-gray-900");
    historySection.classList.remove("hidden");
  }
}

// Event listeners
tabCurrentWorking.addEventListener("click", () => setTab("current_working"));
tabScheduled.addEventListener("click", () => setTab("scheduled"));
tabHistory.addEventListener("click", () => setTab("history"));

searchInput.addEventListener("input", (e) => {
  currentQuery = (e.target.value || "").trim();
  render();
});

// Initialize
fetchOrders();
setTab("current_working");
