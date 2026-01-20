const API_URL = 'http://localhost:3000/api/order';

let allInvoices = [];
let filteredInvoices = [];
let currentPage = 1;
const itemsPerPage = 8;
let currentFilter = 'all';
let currentInvId = null;

const getToken = () => localStorage.getItem("token"); 

const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

const formatDate = (dateString) => {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date.toLocaleString('vi-VN', { hour: '2-digit', minute: '2-digit', day: '2-digit', month: '2-digit', year: 'numeric' });
};

const mapStatus = (backendStatus) => {
    switch (backendStatus) {
        case 'success': return 'paid';
        case 'pending': return 'unpaid';
        default: return backendStatus;
    }
};

async function fetchInvoices() {
    try {
        const token = getToken();
        if (!token) {
            alert("Vui lòng đăng nhập lại!");
            window.location.href = "../auth/login-signup.html";
            return;
        }

        const response = await axios.get(`${API_URL}/receipt/all`, {
            headers: { Authorization: `Bearer ${token}` }
        });

        const rawData = response.data.data; 

        allInvoices = rawData.map(item => {
            const order = item.order_id || {}; 
            
            return {
                id: item._id,
                code: `INV-${item._id.slice(-6).toUpperCase()}`, 
                customer: order.contact_name || order.customer_name || "Khách hàng", 
                orderRef: order._id ? `#ORD-${order._id.slice(-6).toUpperCase()}` : "N/A",
                amount: item.total_amount, 
                method: mapMethodName(item.payment_method), 
                status: mapStatus(item.status),
                date: formatDate(item.created_at),
                rawDate: item.created_at, 
                rawOrder: order 
            };
        });

        applyFilter();

    } catch (error) {
        console.error("Lỗi tải hóa đơn:", error);
    }
}

async function updateInvoiceStatus(id, newStatus) {
    try {
        const token = getToken();
        await axios.patch(`${API_URL}/receipt/${id}/status`, 
            { status: newStatus },
            { headers: { Authorization: `Bearer ${token}` } }
        );
        
        alert("Cập nhật trạng thái thành công!");
        await fetchInvoices(); 
        closeConfirmModal();
        closeDetailModal();

    } catch (error) {
        console.error("Lỗi cập nhật:", error);
        alert(error.response?.data?.message || "Có lỗi xảy ra khi cập nhật.");
    }
}

async function markInvoiceAsPaid(id) {
    try {
        const token = getToken();
        await axios.post(`${API_URL}/receipt/${id}/paid`, 
            { transaction_id: `CASH-${Date.now()}` }, 
            { headers: { Authorization: `Bearer ${token}` } }
        );
        
        alert("Xác nhận thanh toán thành công!");
        await fetchInvoices(); 
        closeConfirmModal();
        closeDetailModal();

    } catch (error) {
        console.error("Lỗi thanh toán:", error);
        alert(error.response?.data?.message || "Có lỗi xảy ra khi xác nhận thanh toán.");
    }
}

function mapMethodName(method) {
    const map = {
        'cash': 'Tiền mặt',
        'credit_card': 'Thẻ tín dụng',
        'bank_transfer': 'Chuyển khoản',
        'ewallet': 'Ví điện tử'
    };
    return map[method] || method;
}

function setFilter(status, btn) {
    document.querySelectorAll('.filter-btn').forEach(b => {
        b.classList.remove('active');
        b.classList.add('text-slate-500');
    });
    btn.classList.add('active');
    btn.classList.remove('text-slate-500');
    
    currentFilter = status; 
    applyFilter();
}

function handleSearch(e) {
    applyFilter();
}

function applyFilter() {
    const term = document.getElementById('searchInput').value.toLowerCase();
    
    filteredInvoices = allInvoices.filter(inv => {
        let matchStatus = true;
        if (currentFilter !== 'all') {
            matchStatus = inv.status === currentFilter;
        }

        const matchSearch = 
            inv.code.toLowerCase().includes(term) || 
            inv.customer.toLowerCase().includes(term) ||
            inv.orderRef.toLowerCase().includes(term);

        return matchStatus && matchSearch;
    });

    currentPage = 1;
    renderTable();
    renderPagination();
}

function renderTable() {
    const tbody = document.getElementById('invoiceTableBody');
    tbody.innerHTML = '';

    if (filteredInvoices.length === 0) {
        tbody.innerHTML = `<tr><td colspan="8" class="p-8 text-center text-slate-400">Không tìm thấy hóa đơn nào.</td></tr>`;
        return;
    }

    const start = (currentPage - 1) * itemsPerPage;
    const end = start + itemsPerPage;
    const pageData = filteredInvoices.slice(start, end);

    pageData.forEach((item, index) => {
        const badge = getStatusBadge(item.status);
        const methodIcon = getMethodIcon(item.method);

        const tr = document.createElement('tr');
        tr.className = "border-b border-gray-50 hover:bg-slate-50 transition-colors group";
        
        tr.innerHTML = `
            <td class="p-4 text-slate-400 font-medium">${start + index + 1}</td>
            <td class="p-4">
                <div class="font-bold text-slate-700 hover:text-indigo-600 cursor-pointer font-mono" onclick="openDetailModal('${item.id}')">${item.code}</div>
                <div class="text-xs text-slate-400">${item.orderRef}</div>
            </td>
            <td class="p-4 font-medium text-slate-700">${item.customer}</td>
            <td class="p-4 text-slate-500 text-xs">${item.date}</td>
            <td class="p-4 text-slate-600 flex items-center gap-1">
                <span class="material-symbols-outlined text-[16px] text-slate-400">${methodIcon}</span> ${item.method}
            </td>
            <td class="p-4 text-right font-bold text-slate-800">${formatCurrency(item.amount)}</td>
            <td class="p-4 text-center"><span class="px-2 py-1 rounded text-[11px] font-bold uppercase ${badge.class}">${badge.text}</span></td>
            <td class="p-4 text-center">
                <div class="flex justify-center gap-2">
                    <button onclick="openDetailModal('${item.id}')" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition" title="Xem chi tiết">
                        <span class="material-symbols-outlined text-[20px]">visibility</span>
                    </button>

                    ${item.status === 'paid' ? `
                        <button onclick="openConfirmModal('${item.id}', 'refund')" class="p-1.5 text-purple-600 hover:bg-purple-50 rounded-lg transition" title="Hoàn tiền">
                            <span class="material-symbols-outlined text-[20px]">undo</span>
                        </button>
                    ` : ''}

                    ${(item.status === 'unpaid') ? `
                        <button onclick="openConfirmModal('${item.id}', 'paid')" class="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition" title="Xác nhận thanh toán">
                            <span class="material-symbols-outlined text-[20px]">check_circle</span>
                        </button>
                        
                        <button onclick="openConfirmModal('${item.id}', 'failed')" class="p-1.5 text-red-400 hover:bg-red-50 rounded-lg transition" title="Hủy bỏ">
                            <span class="material-symbols-outlined text-[20px]">block</span>
                        </button>
                    ` : ''}
                </div>
            </td>
        `;
        tbody.appendChild(tr);
    });

    document.getElementById('paginationInfo').innerText = `Hiển thị ${pageData.length} / ${filteredInvoices.length} hóa đơn`;
}

function openDetailModal(id) {
    currentInvId = id;
    const item = allInvoices.find(i => i.id === id);
    if (!item) return;

    document.getElementById('modalInvoiceCode').innerText = item.code;
    document.getElementById('modalRefOrder').innerText = item.orderRef;
    document.getElementById('modalCustomer').innerText = item.customer;
    document.getElementById('modalDate').innerText = item.date;
    document.getElementById('modalMethod').innerText = item.method;

    const money = formatCurrency(item.amount);
    document.getElementById('modalAmountBig').innerText = money;
    document.getElementById('modalSubtotal').innerText = money;
    document.getElementById('modalFinalTotal').innerText = money;

    const badge = getStatusBadge(item.status);
    const statusEl = document.getElementById('modalStatusText');
    statusEl.innerText = badge.text;
    statusEl.className = `mt-2 inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wide ${badge.class}`;

    const btnMarkPaid = document.getElementById('btnMarkPaid');
    const btnRefund = document.getElementById('btnRefund');
    const btnVoid = document.getElementById('btnVoid');
    
    btnMarkPaid.classList.add('hidden');
    btnRefund.classList.add('hidden');
    btnVoid.classList.add('hidden');

    if (item.status === 'paid') {
        btnRefund.classList.remove('hidden');
        btnRefund.onclick = () => openConfirmModal(id, 'refund');
    } else if (item.status === 'unpaid') {
        btnMarkPaid.classList.remove('hidden');
        btnMarkPaid.onclick = () => openConfirmModal(id, 'paid');

        btnVoid.classList.remove('hidden');
        btnVoid.onclick = () => openConfirmModal(id, 'failed');
    }

    document.getElementById('detailModal').classList.remove('hidden');
}

function openConfirmModal(id, actionType) {
    currentInvId = id;
    const container = document.getElementById('confirmIconContainer');
    const icon = document.getElementById('confirmIcon');
    const btn = document.getElementById('confirmBtnAction');
    const desc = document.getElementById('confirmDesc');
    const title = document.getElementById('confirmTitle');

    document.getElementById('actionType').value = actionType;

    if (actionType === 'refund') {
        title.innerText = "Xác nhận hoàn tiền?";
        desc.innerText = "Trạng thái hóa đơn sẽ chuyển thành 'Đã hoàn tiền'.";
        container.className = "w-12 h-12 rounded-full bg-purple-100 flex items-center justify-center mx-auto mb-3";
        icon.innerText = "undo";
        btn.className = "py-2.5 rounded-lg bg-purple-600 text-white font-semibold shadow-lg hover:bg-purple-700 transition";
        btn.innerText = "Hoàn tiền ngay";
    } else if (actionType === 'failed') {
        title.innerText = "Hủy bỏ hóa đơn?";
        desc.innerText = "Hóa đơn sẽ bị hủy và không thể khôi phục.";
        container.className = "w-12 h-12 rounded-full bg-red-100 flex items-center justify-center mx-auto mb-3";
        icon.innerText = "block";
        btn.className = "py-2.5 rounded-lg bg-red-600 text-white font-semibold shadow-lg hover:bg-red-700 transition";
        btn.innerText = "Xác nhận hủy";
    } else if (actionType === 'paid') {
        title.innerText = "Xác nhận thanh toán?";
        desc.innerText = "Hóa đơn sẽ được đánh dấu là 'Đã thanh toán'.";
        container.className = "w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3";
        icon.innerText = "check_circle";
        btn.className = "py-2.5 rounded-lg bg-green-600 text-white font-semibold shadow-lg hover:bg-green-700 transition";
        btn.innerText = "Xác nhận";
    }

    document.getElementById('confirmModal').classList.remove('hidden');
}

async function executeAction() {
    const type = document.getElementById('actionType').value;
    
    if (type === 'paid') {
        if (currentInvId) await markInvoiceAsPaid(currentInvId);
        return;
    }

    let backendStatus = '';
    if (type === 'refund') backendStatus = 'refunded';
    if (type === 'failed') backendStatus = 'failed';

    if (currentInvId && backendStatus) {
        await updateInvoiceStatus(currentInvId, backendStatus);
    }
}

function getStatusBadge(status) {
    const map = {
        'paid': { text: 'Đã thanh toán', class: 'badge-paid' },
        'unpaid': { text: 'Chờ thanh toán', class: 'badge-unpaid' },
        'refunded': { text: 'Đã hoàn tiền', class: 'badge-refunded' },
        'failed': { text: 'Thất bại/Hủy', class: 'badge-failed' }
    };
    return map[status] || { text: status, class: 'bg-gray-100' };
}

function getMethodIcon(method) {
    if (method.includes("Tiền mặt")) return "attach_money";
    if (method.includes("Ví") || method.includes("Momo") || method.includes("Zalo")) return "smartphone";
    if (method.includes("Thẻ") || method.includes("Chuyển khoản")) return "credit_card";
    return "payments";
}

function renderPagination() {
    const totalPages = Math.ceil(filteredInvoices.length / itemsPerPage);
    const container = document.getElementById('paginationControls');
    container.innerHTML = '';
    
    if (totalPages <= 1) return;

    for (let i = 1; i <= totalPages; i++) {
        const btn = document.createElement('button');
        btn.className = `w-8 h-8 rounded-lg text-xs font-bold transition ${i === currentPage ? 'bg-slate-800 text-white' : 'bg-white border border-gray-200 text-slate-600 hover:bg-gray-50'}`;
        btn.innerText = i;
        btn.onclick = () => {
            currentPage = i;
            renderTable();
            renderPagination();
        };
        container.appendChild(btn);
    }
}

function closeDetailModal() { document.getElementById('detailModal').classList.add('hidden'); }
function closeConfirmModal() { document.getElementById('confirmModal').classList.add('hidden'); }

document.addEventListener('DOMContentLoaded', () => {
    fetchInvoices();
});
