// Sidebar functions
const token = localStorage.getItem("token");
if (!token) {
    alert("Vui lòng đăng nhập!");
    window.location.href = "../auth/login-signup.html";
}

const role = localStorage.getItem("system_role");
if (role !== "admin") {
    alert("Bạn không phải Admin. Không có quyền truy cập.");
    window.location.href = "../auth/login-signup.html";
}

const sidebarMobile = document.getElementById("sidebarMobile");
const backdrop = document.getElementById("backdrop");

function openSidebar() {
  sidebarMobile.classList.remove("-translate-x-full");
  backdrop.classList.remove("hidden");
}

function closeSidebar() {
  sidebarMobile.classList.add("-translate-x-full");
  backdrop.classList.add("hidden");
}

// API Configuration
const API_BASE = (typeof window.CONFIG !== "undefined" && window.CONFIG.API_BASE_URL) ? window.CONFIG.API_BASE_URL : "http://localhost:3000";
const API_URL = API_BASE + "/api/order";
let allOrders = [];
let filteredOrders = [];
let currentPage = 1;
let itemsPerPage = 10;
let currentFilter = "";
let searchQuery = "";
let orderTrends = [];

// Service renderers for task_payload
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
    `,
    HOUSE_CLEANING: (p) => {
        const extrasArr = p.extras ? Object.values(p.extras) : [];
        return `
            <div class="space-y-1">
                <p>⏱️ Thời gian combo dọn dẹp gốc: <strong>${p.base_time} giờ</strong></p>
                ${p.total_time && p.total_time > p.base_time
                    ? `<p>⏱️ Thời gian thực hiện tổng: <strong>${p.total_time} giờ</strong></p>`
                    : ""
                }
                ${p.house_type
                    ? `<p>🏠 Loại nhà: <strong>${p.house_type}</strong></p>`
                    : ""
                }
                ${extrasArr.length
                    ? `
                        <div class="mt-2">
                            <p>🧩 Dịch vụ thêm:</p>
                            <ul class="ml-4 list-disc space-y-1">
                                ${extrasArr.map(e => `
                                    <li>${e.name} (+${Number(e.price).toLocaleString()}đ/giờ)</li>
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
            ${(p.child_ages || []).map((age, index) =>
                `<li>🧒 Bé ${index + 1}: ${age === "1-6" ? "12 tháng – 6 tuổi" : "7 – 11 tuổi"}</li>`
            ).join("")}
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
    DEFAULT: () => `<p class="text-gray-400">Không có chi tiết dịch vụ</p>`
};

// Utility functions
function getStatusBadge(status) {
    const statusMap = {
        'pending': { text: 'Chờ xử lý', class: 'bg-gray-100 text-gray-700 border-gray-200' },
        'assigned': { text: 'Đã giao việc', class: 'bg-blue-100 text-blue-700 border-blue-200' },
        'in_progress': { text: 'Đang diễn ra', class: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
        'completed': { text: 'Hoàn thành', class: 'bg-green-100 text-green-700 border-green-200' },
        'cancelled': { text: 'Đã hủy', class: 'bg-red-100 text-red-700 border-red-200' },
    };

    const statusInfo = statusMap[status] || { text: status, class: 'bg-gray-100 text-gray-700 border-gray-200' };
    return `<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold ${statusInfo.class} border">${statusInfo.text}</span>`;
}

function formatCurrency(amount) {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
}

function formatDateTime(dateString) {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', { 
        hour: '2-digit', 
        minute: '2-digit',
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
    });
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

function maskPhone(phone) {
    if (!phone || phone.length < 6) return phone;
    return phone.substring(0, 3) + '***' + phone.substring(phone.length - 3);
}

function showError(message) {
    const tbody = document.getElementById("ordersTableBody");
    tbody.innerHTML = `
        <tr>
            <td colspan="7" class="px-4 py-8 text-center text-red-500">
                <div class="flex flex-col items-center gap-2">
                    <span class="material-symbols-outlined text-4xl">error</span>
                    <p>${message}</p>
                </div>
            </td>
        </tr>
    `;
}

// Load orders when page loads
document.addEventListener("DOMContentLoaded", async () => {
    await loadOrders();
    await loadOrderTrends();
});

// Fetch all orders from API
async function loadOrders() {
    try {
        const response = await fetch(`${API_URL}/all`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        if (response.status === 401 || response.status === 403) {
            alert("Bạn không có quyền truy cập!");
            window.location.href = "../auth/login-signup.html";
            return;
        }

        const data = await response.json();
            
        if (data.success) {
            allOrders = data.orders;
            filteredOrders = [...allOrders];
            updateStatistics();
            renderOrders();
            console.log("Orders loaded:", allOrders);
        } else {
            showError("Không thể tải danh sách đơn hàng");
        }
    } catch (error) {
        console.error("Error loading orders:", error);
        showError("Lỗi khi tải dữ liệu: " + error.message);
    }
}

// Load order trends (7 days)
async function loadOrderTrends() {
    try {

        const response = await fetch(`${API_URL}/statistics/trends`, {
            headers: { "Authorization": `Bearer ${token}` }
        });

        if (!response.ok) {
            console.error("Failed to load trends");
            return;
        }

        const data = await response.json();
        if (data.success && data.trends) {
            orderTrends = data.trends;
            renderTrendsChart();
        }
    } catch (error) {
        console.error("Error loading trends:", error);
    }
}

// Render trends chart
function renderTrendsChart() {
    if (orderTrends.length === 0) return;

    const maxTotal = Math.max(...orderTrends.map(t => t.total), 1);
    const chartContainer = document.getElementById("trendsChart");
    const labelsContainer = document.getElementById("trendsLabels");

    // Render bars
    chartContainer.innerHTML = orderTrends.map(trend => {
        const heightPercent = maxTotal > 0 ? (trend.total / maxTotal) * 100 : 0;
        const isToday = trend.date === new Date().toISOString().split('T')[0];
        const barClass = isToday ? 'bg-primary-500 hover:bg-primary-400 shadow-md' : 'bg-blue-100 hover:bg-blue-200';
        
        return `
            <div class="w-full ${barClass} transition-all rounded-t relative group" style="height: ${heightPercent}%">
                <span class="absolute -top-6 left-1/2 -translate-x-1/2 text-xs bg-gray-800 text-white px-1 rounded opacity-0 group-hover:opacity-100 transition whitespace-nowrap">
                    ${trend.total} đơn
                </span>
            </div>
        `;
    }).join('');

    // Render labels
    labelsContainer.innerHTML = orderTrends.map(trend => 
        `<span>${trend.dayOfWeek}</span>`
    ).join('');
}

// Update statistics cards
function updateStatistics() {
    const total = allOrders.length;
    const completed = allOrders.filter(o => o.status === "completed").length;
    const inProgress = allOrders.filter(o => o.status === "in_progress" || o.status === "assigned" || o.status === "pending").length;
    const cancelled = allOrders.filter(o => o.status === "cancelled").length;

    document.getElementById("totalOrders").textContent = total;
    document.getElementById("completedOrders").innerHTML = `${completed} <span class="text-xs font-medium opacity-80">(${total > 0 ? Math.round(completed/total*100) : 0}%)</span>`;
    document.getElementById("ongoingOrders").innerHTML = `${inProgress} <span class="text-xs font-medium opacity-80">(${total > 0 ? Math.round(inProgress/total*100) : 0}%)</span>`;
    document.getElementById("cancelledOrders").innerHTML = `${cancelled} <span class="text-xs font-medium opacity-80">(${total > 0 ? Math.round(cancelled/total*100) : 0}%)</span>`;
    
    // Update status percentages chart
    updateStatusPercentages(total, completed, inProgress, cancelled);
}

// Update status percentage bars
function updateStatusPercentages(total, completed, inProgress, cancelled) {
    const completedPercent = total > 0 ? Math.round((completed / total) * 100) : 0;
    const inProgressPercent = total > 0 ? Math.round((inProgress / total) * 100) : 0;
    const cancelledPercent = total > 0 ? Math.round((cancelled / total) * 100) : 0;

    document.getElementById("statusCompletedPercent").textContent = `${completedPercent}%`;
    document.getElementById("statusCompletedBar").style.width = `${completedPercent}%`;

    document.getElementById("statusInProgressPercent").textContent = `${inProgressPercent}%`;
    document.getElementById("statusInProgressBar").style.width = `${inProgressPercent}%`;

    document.getElementById("statusCancelledPercent").textContent = `${cancelledPercent}%`;
    document.getElementById("statusCancelledBar").style.width = `${cancelledPercent}%`;
}

// Render orders in table
function renderOrders() {
    const tbody = document.getElementById("ordersTableBody");
    
    if (filteredOrders.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="px-4 py-8 text-center text-gray-400">
                    <div class="flex flex-col items-center gap-2">
                        <span class="material-symbols-outlined text-4xl">inbox</span>
                        <p>Không có đơn hàng nào</p>
                    </div>
                </td>
            </tr>
        `;
        updatePagination();
        return;
    }

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    const ordersToDisplay = filteredOrders.slice(startIndex, endIndex);

    tbody.innerHTML = ordersToDisplay.map(order => {
        const customerAvatar = order.customer_id?.avatar_url || `https://api.dicebear.com/9.x/bottts/svg?seed=${order.customer_id?.full_name || 'Customer'}`;
        const taskerAvatar = order.tasker_id?.avatar_url || (order.tasker_id?.full_name ? `https://api.dicebear.com/9.x/bottts/svg?seed=${order.tasker_id.full_name}` : null);
        
        return `
        <tr class="hover:bg-gray-50 transition-colors">
            <td class="px-4 py-3 font-medium text-primary-600">#${order._id?.substring(0, 8) || 'N/A'}</td>
            <td class="px-4 py-3">
                <div class="flex items-center gap-3">
                    <img src="${customerAvatar}" alt="${order.customer_id?.full_name || 'Customer'}" class="w-10 h-10 rounded-full object-cover border border-gray-200" onerror="this.src='https://api.dicebear.com/9.x/bottts/svg?seed=Customer'">
                    <div>
                        <div class="font-medium">${order.customer_id?.full_name || 'N/A'}</div>
                        <div class="text-xs text-gray-500">${maskPhone(order.customer_id?.phone_number || '')}</div>
                    </div>
                </div>
            </td>
            <td class="px-4 py-3">
                <div class="flex items-center gap-2">
                    ${order.tasker_id ? `
                        <img src="${taskerAvatar}" alt="${order.tasker_id.full_name}" class="w-8 h-8 rounded-full object-cover border border-blue-200" onerror="this.src='https://api.dicebear.com/9.x/bottts/svg?seed=Tasker'">
                    ` : ''}
                    <span>${order.task_id?.task_name || order.task_snapshot?.name || order.task_snapshot?.task_name || 'N/A'}</span>
                </div>
            </td>
            <td class="px-4 py-3 text-gray-500 text-sm">${formatDateTime(order.created_at)}</td>
            <td class="px-4 py-3 text-right font-bold">${formatCurrency(order.final_amount || order.base_amount || 0)}</td>
            <td class="px-4 py-3 text-center">${getStatusBadge(order.status)}</td>
            <td class="px-4 py-3 text-center">
                <div class="flex items-center justify-center gap-2">
                    <button onclick="viewOrderDetail('${order._id}')" class="text-gray-400 hover:text-primary-500 transition" title="Xem chi tiết">
                        <span class="material-symbols-outlined text-[20px]">visibility</span>
                    </button>
                    <button onclick="deleteOrder('${order._id}')" class="text-gray-400 hover:text-red-500 transition" title="Xóa đơn hàng">
                        <span class="material-symbols-outlined text-[20px]">delete</span>
                    </button>
                </div>
            </td>
        </tr>
    `;
    }).join('');

    updatePagination();
}

// Filter by status
function filterByStatus(status) {
    currentFilter = status;
    currentPage = 1;

    // Update button styles
    document.querySelectorAll('.filter-btn').forEach(btn => {
        if (btn.dataset.status === status) {
            btn.classList.add('bg-gray-800', 'text-white');
            btn.classList.remove('bg-white', 'text-gray-600');
        } else {
            btn.classList.remove('bg-gray-800', 'text-white');
            btn.classList.add('bg-white', 'text-gray-600');
        }
    });

    applyFilters();
}

// Search orders
function handleSearch() {
    searchQuery = document.getElementById("searchInput").value.toLowerCase();
    currentPage = 1;
    applyFilters();
}

// Apply all filters
function applyFilters() {
    filteredOrders = allOrders.filter(order => {
        const matchesStatus = !currentFilter || order.status === currentFilter;
        const matchesSearch = !searchQuery || 
            order._id?.toLowerCase().includes(searchQuery) ||
            order.customer_id?.full_name?.toLowerCase().includes(searchQuery) ||
            order.task_snapshot?.task_name?.toLowerCase().includes(searchQuery);
        
        return matchesStatus && matchesSearch;
    });

    renderOrders();
}

// View order detail
async function viewOrderDetail(orderId) {
    try {
        const response = await fetch(`${API_URL}/detail/${orderId}`, {
            method: "GET",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        const data = await response.json();
        console.log("Order detail data:", data);
        if (data.success) {
            showOrderDetailModal(data.order);
        } else {
            alert("Không thể tải thông tin đơn hàng");
        }
    } catch (error) {
        console.error("Error fetching order detail:", error);
        alert("Lỗi khi tải chi tiết đơn hàng");
    }
}

// Show order detail modal
function showOrderDetailModal(order) {
    console.log("Order detail in showOrderDetailModal:", order);
    
    const customerAvatar = order.customer_id?.avatar_url || `https://api.dicebear.com/9.x/bottts/svg?seed=${order.customer_id?.full_name || 'Customer'}`;
    const taskerAvatar = order.tasker_id?.avatar_url || (order.tasker_id?.full_name ? `https://api.dicebear.com/9.x/bottts/svg?seed=${order.tasker_id.full_name}` : null);
    
    const serviceCode = order.task_snapshot?.code || "DEFAULT";
    const renderer = serviceRenderers[serviceCode] || serviceRenderers.DEFAULT;
    const payload = order.task_payload || {};
    
    const scheduledInfo = order.scheduled_at && order.type === "scheduled"
        ? `<div class="bg-blue-50 p-3 rounded-lg border border-blue-200">
            <p class="text-sm font-semibold text-blue-700 flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">schedule</span>
                Đã lên lịch
            </p>
            <p class="text-sm text-blue-600 mt-1">
                ${formatDateTime(order.scheduled_at)}
            </p>
        </div>`
        : `<div class="bg-orange-50 p-3 rounded-lg border border-orange-200">
            <p class="text-sm font-semibold text-orange-700 flex items-center gap-1">
                <span class="material-symbols-outlined text-sm">bolt</span>
                Ngay lập tức
            </p>
        </div>`;
    
    const modal = `
        <div id="orderDetailModal" class="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onclick="closeModal(event)">
            <div class="bg-white rounded-xl shadow-xl max-w-4xl w-full max-h-[90vh] overflow-y-auto" onclick="event.stopPropagation()">
                <div class="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between z-10">
                    <h3 class="text-xl font-bold text-gray-800">Chi tiết đơn hàng #${order._id?.substring(0, 8) || 'N/A'}</h3>
                    <button onclick="closeModal()" class="text-gray-400 hover:text-gray-600 transition">
                        <span class="material-symbols-outlined">close</span>
                    </button>
                </div>
                
                <div class="p-6 space-y-6">
                    <!-- Customer & Tasker Info -->
                    <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div class="bg-gray-50 rounded-lg p-4 border border-gray-200">
                            <div class="flex items-center gap-3 mb-3">
                                <img src="${customerAvatar}" alt="Customer" class="w-12 h-12 rounded-full object-cover border-2 border-gray-300" onerror="this.src='https://api.dicebear.com/9.x/bottts/svg?seed=Customer'">
                                <div>
                                    <p class="text-xs text-gray-500 uppercase font-bold">Khách hàng</p>
                                    <p class="font-semibold text-gray-800">${order.customer_id?.full_name || 'N/A'}</p>
                                </div>
                            </div>
                            <div class="space-y-1 text-sm">
                                <p><span class="text-gray-500">📞</span> ${order.customer_id?.phone_number || 'N/A'}</p>
                            </div>
                        </div>
                        
                        ${order.tasker_id ? `
                            <div class="bg-blue-50 rounded-lg p-4 border border-blue-200">
                                <div class="flex items-center gap-3 mb-3">
                                    <img src="${taskerAvatar}" alt="Tasker" class="w-12 h-12 rounded-full object-cover border-2 border-blue-300" onerror="this.src='https://api.dicebear.com/9.x/bottts/svg?seed=Tasker'">
                                    <div>
                                        <p class="text-xs text-blue-600 uppercase font-bold">Tasker</p>
                                        <p class="font-semibold text-gray-800">${order.tasker_id.full_name || 'N/A'}</p>
                                    </div>
                                </div>
                                <div class="space-y-1 text-sm">
                                    <p><span class="text-gray-500">📞</span> ${order.tasker_id.phone_number || 'N/A'}</p>
                                </div>
                            </div>
                        ` : `
                            <div class="bg-gray-50 rounded-lg p-4 border border-gray-200 flex items-center justify-center">
                                <p class="text-gray-400 text-sm">Chưa có Tasker được gán</p>
                            </div>
                        `}
                    </div>

                    <!-- Order Info -->
                    <div class="grid grid-cols-2 md:grid-cols-4 gap-4">
                        <div>
                            <p class="text-xs text-gray-500 uppercase font-bold mb-1">Trạng thái</p>
                            ${getStatusBadge(order.status)}
                        </div>
                        <div>
                            <p class="text-xs text-gray-500 uppercase font-bold mb-1">Loại đơn</p>
                            <p class="font-semibold">${order.type === 'immediate' ? 'Ngay lập tức' : 'Đặt lịch'}</p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-500 uppercase font-bold mb-1">Giá gốc</p>
                            <p class="font-semibold">${formatCurrency(order.base_amount || 0)}</p>
                        </div>
                        <div>
                            <p class="text-xs text-gray-500 uppercase font-bold mb-1">Tổng thanh toán</p>
                            <p class="font-semibold text-primary-600 text-lg">${formatCurrency(order.final_amount || 0)}</p>
                        </div>
                    </div>

                    <!-- Service Details -->
                    <div class="bg-white border border-gray-200 rounded-lg p-4">
                        <h4 class="font-bold text-gray-800 text-lg mb-3 flex items-center gap-2">
                            <span class="material-symbols-outlined text-primary-500">design_services</span>
                            ${order.task_snapshot?.name || order.task_id?.task_name || 'Dịch vụ'}
                        </h4>
                        <div class="text-sm text-gray-700 space-y-1">
                            ${renderer(payload)}
                        </div>
                        ${scheduledInfo}
                        ${order.note ? `
                            <div class="bg-gray-50 p-3 rounded-lg mt-3 border border-gray-200">
                                <p class="text-sm font-semibold text-primary-500 mb-1">📝 Ghi chú:</p>
                                <p class="text-sm text-gray-700">${order.note}</p>
                            </div>
                        ` : ''}
                    </div>

                    <!-- Address -->
                    ${order.address_id || order.address_snapshot ? `
                        <div class="bg-white border border-gray-200 rounded-lg p-4">
                            <h4 class="font-bold text-gray-800 mb-2 flex items-center gap-2">
                                <span class="material-symbols-outlined text-primary-500">location_on</span>
                                Địa chỉ
                            </h4>
                            <p class="text-sm text-gray-700">
                                ${order.address_snapshot?.full_address || [
                                    order.address_id?.address_line, 
                                    order.address_id?.ward, 
                                    order.address_id?.district, 
                                    order.address_id?.city
                                ].filter(Boolean).join(', ') || 'N/A'}
                            </p>
                        </div>
                    ` : ''}

                    <!-- Order Metadata -->
                    <div class="grid grid-cols-2 gap-4 text-sm">
                        <div>
                            <p class="text-gray-500 mb-1">Ngày tạo</p>
                            <p class="font-semibold">${formatDateTime(order.created_at)}</p>
                        </div>
                        ${order.updatedAt ? `
                            <div>
                                <p class="text-gray-500 mb-1">Cập nhật lần cuối</p>
                                <p class="font-semibold">${formatDateTime(order.updated_at)}</p>
                            </div>
                        ` : ''}
                    </div>
                </div>
            </div>
        </div>
    `;
    
    document.body.insertAdjacentHTML('beforeend', modal);
}

// Close modal
function closeModal(event) {
    if (!event || event.target.id === 'orderDetailModal') {
        const modal = document.getElementById('orderDetailModal');
        if (modal) modal.remove();
    }
}

// Delete order
async function deleteOrder(orderId) {
    if (!confirm("Bạn có chắc chắn muốn xóa đơn hàng này?")) {
        return;
    }

    try {
        const response = await fetch(`${API_URL}/delete/${orderId}`, {
            method: "DELETE",
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
        });

        const data = await response.json();
        
        if (data.success) {
            alert("Xóa đơn hàng thành công!");
            await loadOrders(); // Reload orders
        } else {
            alert("Không thể xóa đơn hàng: " + data.message);
        }
    } catch (error) {
        console.error("Error deleting order:", error);
        alert("Lỗi khi xóa đơn hàng");
    }
}

// Pagination
function updatePagination() {
    const total = filteredOrders.length;
    const totalPages = Math.ceil(total / itemsPerPage);
    const startIndex = (currentPage - 1) * itemsPerPage + 1;
    const endIndex = Math.min(currentPage * itemsPerPage, total);

    document.getElementById("paginationInfo").innerHTML = 
        `Hiển thị <span class="font-bold">${total > 0 ? startIndex : 0}-${endIndex}</span> trên <span class="font-bold">${total}</span> đơn hàng`;

    const buttonsHTML = `
        <button onclick="previousPage()" ${currentPage === 1 ? 'disabled' : ''} class="w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed">
            <span class="material-symbols-outlined text-sm">chevron_left</span>
        </button>
        ${Array.from({length: totalPages}, (_, i) => i + 1)
            .filter(page => page === 1 || page === totalPages || Math.abs(page - currentPage) <= 1)
            .map(page => `
                <button onclick="goToPage(${page})" class="w-8 h-8 flex items-center justify-center rounded ${page === currentPage ? 'bg-primary-500 text-white' : 'border border-gray-200 hover:bg-gray-50 text-gray-600'} font-bold text-sm">
                    ${page}
                </button>
            `).join('')}
        <button onclick="nextPage()" ${currentPage === totalPages || totalPages === 0 ? 'disabled' : ''} class="w-8 h-8 flex items-center justify-center rounded border border-gray-200 hover:bg-gray-50 text-gray-500 disabled:opacity-50 disabled:cursor-not-allowed">
            <span class="material-symbols-outlined text-sm">chevron_right</span>
        </button>
    `;

    document.getElementById("paginationButtons").innerHTML = buttonsHTML;
}

function previousPage() {
    if (currentPage > 1) {
        currentPage--;
        renderOrders();
    }
}

function nextPage() {
    const totalPages = Math.ceil(filteredOrders.length / itemsPerPage);
    if (currentPage < totalPages) {
        currentPage++;
        renderOrders();
    }
}

function goToPage(page) {
    currentPage = page;
    renderOrders();
}

const logoutBtn = document.querySelectorAll(".logout-btn");
logoutBtn.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
        e.preventDefault();

        try {
            const res = await fetch(`${API_BASE}/api/auth/logout`, {
                method: "POST",
                credentials: "include",
                headers: {
                    Authorization: `Bearer ${token}`,
                },
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
});

// Expose functions to window for onclick handlers
window.openSidebar = openSidebar;
window.closeSidebar = closeSidebar;
window.filterByStatus = filterByStatus;
window.handleSearch = handleSearch;
window.viewOrderDetail = viewOrderDetail;
window.deleteOrder = deleteOrder;
window.closeModal = closeModal;
window.previousPage = previousPage;
window.nextPage = nextPage;
window.goToPage = goToPage;
