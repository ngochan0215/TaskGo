const API_BASE = window.API_BASE || (typeof CONFIG !== 'undefined' ? CONFIG.API_BASE_URL : "http://localhost:3000");
const API_URL = `${API_BASE}/api/notification`;

let notifications = [];
let currentFilter = "all";

const token = localStorage.getItem("token");
if (!token) {
    alert("Vui lòng đăng nhập");
    location.href = "../auth/login-signup.html";
}

function mapIcon(type) {
    if (type === "order") return "work";
    if (type === "discount" || type === "promo") return "account_balance_wallet";
    if (type === "system") return "settings_alert";
    if (type === "message") return "chat";
    return "notifications";
}

function timeAgo(input) {
    if (!input) return "";
    const now = new Date();
    const time = new Date(input);
    const diffMs = now - time;
    if (diffMs < 0) return "vừa xong";

    const seconds = Math.floor(diffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 10) return "vừa xong";
    if (seconds < 60) return `${seconds} giây trước`;
    if (minutes < 60) return `${minutes} phút trước`;
    if (hours < 24) return `${hours} giờ trước`;
    if (days < 7) return `${days} ngày trước`;
    return time.toLocaleDateString('vi-VN');
}

async function loadNotifications() {
    try {
        const res = await fetch(`${API_URL}/all`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        if (res.status === 401) {
            localStorage.removeItem("token");
            alert("Token đã hết hạn hoặc không hợp lệ!");
            window.location.href = "../auth/login-signup.html";
            return;
        }

        if (!res.ok) throw new Error("Load failed");

        const data = await res.json();

        notifications = data.map(n => ({
            id: n._id,
            type: n.type,
            title: n.title,
            desc: n.content,
            time: timeAgo(n.created_at || n.createdAt),
            icon: mapIcon(n.type),
            isRead: n.status === "read",
            reference: n.reference
        }));

        render();
    } catch (error) {
        console.error(error);
    }
}

function render() {
    const container = document.getElementById('notification-list');
    if (!container) return;

    container.innerHTML = '';

    const filtered = notifications.filter(n => {
        if (currentFilter === 'all') return true;
        if (currentFilter === 'promo' || currentFilter === 'discount') {
            return n.type === 'discount' || n.type === 'promo';
        }
        return n.type === currentFilter;
    });

    const unreadCount = notifications.filter(n => !n.isRead).length;

    const badge = document.getElementById('badge-count');
    const btnRead = document.getElementById('btn-read-all');

    if (badge) {
        if (unreadCount > 0) {
            badge.style.display = 'flex';
            badge.innerText = unreadCount;
        } else {
            badge.style.display = 'none';
        }
    }

    if (btnRead) {
        if (unreadCount > 0) {
            btnRead.classList.remove('opacity-50', 'cursor-not-allowed');
            btnRead.disabled = false;
        } else {
            btnRead.classList.add('opacity-50', 'cursor-not-allowed');
            btnRead.disabled = true;
        }
    }

    if (filtered.length === 0) {
        container.innerHTML = `
            <div class="flex flex-col items-center justify-center h-[400px] text-slate-400">
                <div class="w-24 h-24 bg-slate-100 rounded-full flex items-center justify-center mb-4">
                    <span class="material-symbols-outlined text-[48px] text-slate-300">notifications_off</span>
                </div>
                <p class="font-medium text-lg text-slate-500">Hộp thư trống</p>
                <p class="text-sm">Bạn chưa có thông báo mới nào</p>
            </div>`;
        return;
    }

    filtered.forEach((item) => {
        const isUnread = !item.isRead;

        const cardClass = isUnread
            ? 'bg-white shadow-[0_2px_8px_-2px_rgba(0,0,0,0.1)] border-l-[6px] border-[#3730A3]'
            : 'bg-white border border-slate-100 opacity-80 hover:opacity-100 hover:shadow-sm';

        const iconStyle = isUnread ? 'bg-[#EEF2FF] text-[#3730A3]' : 'bg-slate-100 text-slate-400';
        const titleStyle = isUnread ? 'text-slate-900 font-bold' : 'text-slate-600 font-semibold';
        const timeStyle = isUnread ? 'text-[#3730A3] font-medium' : 'text-slate-400';

        const html = `
            <div class="group relative flex gap-4 p-4 rounded-lg fade-in ${cardClass}">
                <div onclick="readItem('${item.id}')" class="flex-1 flex gap-4 cursor-pointer">
                    <div class="w-12 h-12 rounded-xl ${iconStyle} flex items-center justify-center">
                        <span class="material-symbols-outlined">${item.icon}</span>
                    </div>
                    <div class="flex-1 min-w-0">
                        <h3 class="${titleStyle}">${item.title}</h3>
                        <p class="text-sm text-slate-500">${item.desc}</p>
                        <p class="text-xs ${timeStyle} mt-1">${item.time}</p>
                    </div>
                </div>
                <button onclick="deleteItem(event, '${item.id}')" class="absolute top-1/2 -translate-y-1/2 right-4 w-8 h-8 z-20 opacity-0 group-hover:opacity-100 transition-opacity hover:bg-slate-100 rounded-full flex items-center justify-center">
                    <span class="material-symbols-outlined text-slate-400 hover:text-red-500 text-[20px]">delete</span>
                </button>
            </div>
        `;
        container.insertAdjacentHTML('beforeend', html);
    });
}

function filterNotifs(type) {
    currentFilter = type;

    const tabs = ['all', 'order', 'discount', 'system'];

    tabs.forEach(t => {
        const btn = document.getElementById(`tab-${t}`);
        if (!btn) return;

        if (t === type) {
            btn.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-[#EEF2FF] text-[#3730A3] font-bold transition-all border border-[#C7D2FE] shadow-sm";
        } else {
            btn.className = "w-full flex items-center gap-3 px-4 py-3 rounded-xl text-slate-500 font-medium hover:bg-slate-50 hover:text-slate-700 transition-all";
        }
    });

    const titles = {
        'all': 'Tất cả thông báo',
        'order': 'Việc làm & Đơn hàng',
        'discount': 'Thưởng & Thu nhập',
        'promo': 'Thưởng & Thu nhập',
        'system': 'Tin hệ thống'
    };
    document.getElementById('page-title').innerText = titles[type] || 'Thông báo';
    render();
}

async function readItem(id) {
    const item = notifications.find(n => n.id === id);
    if (!item) return;
    if (!item.isRead) {
        try {
            const res = await fetch(`${API_URL}/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
                method: "PATCH"
            });
            if (!res.ok) throw new Error();

            item.isRead = true;
            render();
        } catch (e) {
            console.error(e);
        }
    }

    if (item.reference?.kind === "Order" && item.reference.refId) {
        window.location.href = `./tasker_order_progress.html?orderId=${item.reference.refId}`;
    }
}

async function markAllRead() {
    try {
        const res = await fetch(`${API_URL}/read-all`, {
            headers: { Authorization: `Bearer ${token}` },
            method: "PATCH"
        });
        if (!res.ok) throw new Error();

        notifications.forEach(n => n.isRead = true);
        render();
    } catch (e) {
        alert("Có lỗi xảy ra.");
    }
}

async function deleteItem(e, id) {
    e.stopPropagation();
    if (confirm('Bạn có chắc muốn xóa không?')) {
        try {
            const res = await fetch(`${API_URL}/${id}`, {
                headers: { Authorization: `Bearer ${token}` },
                method: "DELETE"
            });
            if (!res.ok) throw new Error();

            notifications = notifications.filter(n => n.id !== id);
            render();
        } catch (error) {
            alert("Không thể xóa thông báo.");
        }
    }
}

function showToast(item) {
    const container = document.getElementById("toast-container");
    if (!container) return;

    const toast = document.createElement("div");
    toast.className = `bg-white border-l-4 border-[#3730A3] shadow-lg rounded-lg p-4 w-80 animate-slide-in transition-all duration-300`;
    toast.innerHTML = `
        <p class="font-semibold text-slate-800">${item.title}</p>
        <p class="text-sm text-slate-500 mt-1">${item.desc}</p>
    `;

    container.appendChild(toast);
    setTimeout(() => {
        toast.style.opacity = '0';
        setTimeout(() => toast.remove(), 300);
    }, 15000);
}

document.addEventListener("DOMContentLoaded", () => {
    loadNotifications();

    if (typeof io !== 'undefined') {
        const socket = io(API_BASE);
        const userIdStr = localStorage.getItem("user_id");
        const roleStr = localStorage.getItem("system_role");
        let user_id = userIdStr;
        try { user_id = JSON.parse(userIdStr); } catch(e) {}

        let role = roleStr;
        try { role = JSON.parse(roleStr); } catch(e) {}

        if (user_id) {
            socket.emit("join", { userId: user_id, role });

            socket.on("notification", async () => {
                await loadNotifications();

                if(notifications.length > 0) {
                    showToast(notifications[0]);
                }
            });
        }
    }
});