
const API_BASE_URL = 'http://localhost:3000/api/admin'; 
const getToken = () => localStorage.getItem('token'); 

// Format tiền tệ VND
const formatCurrency = (amount) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(amount);
};

// Hàm gọi API chung để tái sử dụng
async function apiCall(endpoint, method = 'GET', body = null) {
    const token = getToken();
    const headers = {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` })
    };

    const config = { method, headers };
    if (body) config.body = JSON.stringify(body);

    try {
        const response = await fetch(`${API_BASE_URL}${endpoint}`, config);
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Có lỗi xảy ra');
        }
        return data;
    } catch (error) {
        console.error("API Error:", error);
        alert(error.message); // Thông báo lỗi đơn giản
        return null;
    }
}

async function loadTaskers() {
    const tableBody = document.getElementById('data-table-body');
    
    // Hiển thị loading trong lúc chờ
    tableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center">Đang tải dữ liệu...</td></tr>`;

    // Gọi API: GET /taskers/all
    const taskers = await apiCall('/taskers/all');

    if (!taskers || taskers.length === 0) {
        tableBody.innerHTML = `<tr><td colspan="6" class="p-4 text-center">Không có dữ liệu</td></tr>`;
        return;
    }

    tableBody.innerHTML = ''; // Xóa loading

    taskers.forEach(tasker => {
        // Mapping dữ liệu an toàn (tránh lỗi null/undefined)
        // Lưu ý: User model không được cung cấp, giả định có field full_name hoặc lấy email
        const user = tasker.user_id || {};
        const account = user.account_id || {};
        
        const name = user.full_name || account.email || "Không xác định";
        const experience = `${tasker.working_year || 0} năm`;
        const rate = formatCurrency(tasker.hourly_rate || 0) + "/h";
        
        // Status từ backend
        const accStatus = account.status || 'inactive'; // active, inactive, banned...
        const workStatus = tasker.working_status || 'pending'; // pending, available, busy, inactive
        const mainStatus = tasker.status || 'pending'; // pending, working, resign

        // Tạo dòng HTML giữ nguyên class thiết kế
        const tr = document.createElement('tr');
        tr.className = "border-b border-gray-50 hover:bg-slate-50 transition-colors";
        
        // Logic hiển thị nút bấm:
        // Nếu đang chờ duyệt (pending) -> Hiện nút Approve/Reject
        // Nếu đã duyệt (working) -> Hiện nút Edit/Save
        let actionButtons = '';
        
        if (mainStatus === 'pending') {
            actionButtons = `
                <button onclick="approveTasker('${tasker._id}')" title="Chấp nhận" class="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition-colors">
                    <span class="material-symbols-outlined">verified</span>
                </button>
                <button onclick="rejectTasker('${tasker._id}')" title="Từ chối" class="p-1.5 text-red-600 hover:bg-red-50 rounded-lg transition-colors">
                    <span class="material-symbols-outlined">verified_off</span>
                </button>
            `;
        } else {
            actionButtons = `
                <button onclick="updateTasker('${tasker._id}')" title="Lưu thay đổi" class="p-1.5 text-yellow-600 hover:bg-yellow-50 rounded-lg transition-colors">
                    <span class="material-symbols-outlined">save</span>
                </button>
            `;
        }

        // Render HTML
        tr.innerHTML = `
            <td class="p-4 font-medium text-slate-800">${name}</td>
            <td class="p-4 max-w-[100px] font-medium text-slate-800">${experience}</td>
            <td class="p-4 font-medium text-slate-800">${rate}</td>
            
            <td class="p-4 text-sm text-slate-600">
                <select id="acc-status-${tasker._id}" class="text-xs font-bold w-full px-3 py-1.5 rounded-lg border-none bg-slate-50 focus:ring-2 focus:ring-gray-200 cursor-pointer transition-all">
                    <option value="active" ${accStatus === 'active' ? 'selected' : ''}>ACTIVE</option>
                    <option value="inactive" ${accStatus === 'inactive' ? 'selected' : ''}>INACTIVE</option>
                    <option value="banned" ${accStatus === 'banned' ? 'selected' : ''}>BANNED</option>
                </select>
            </td>
            
            <td class="p-4 text-sm text-slate-600">
                <select id="work-status-${tasker._id}" class="text-xs font-bold w-full px-3 py-1.5 min-w-[170px] rounded-lg border-none bg-slate-50 focus:ring-2 focus:ring-gray-200 cursor-pointer transition-all">
                    <option value="pending" ${workStatus === 'pending' ? 'selected' : ''}>ĐANG CHỜ</option>
                    <option value="available" ${workStatus === 'available' ? 'selected' : ''}>ĐANG RẢNH</option>
                    <option value="busy" ${workStatus === 'busy' ? 'selected' : ''}>ĐANG BẬN</option>
                    <option value="inactive" ${workStatus === 'inactive' ? 'selected' : ''}>KHÔNG HOẠT ĐỘNG</option>
                </select>
            </td>
            
            <td class="p-4 text-center">
                <div class="flex justify-center space-x-2">
                    <button title="Xem chi tiết" class="p-1.5 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors">
                        <span class="material-symbols-outlined">visibility</span>
                    </button>
                    ${actionButtons}
                </div>
            </td>
        `;

        tableBody.appendChild(tr);
    });
}

/**
 * ACTIONS: XỬ LÝ SỰ KIỆN
 */

// 1. Approve Tasker
async function approveTasker(taskerId) {
    if (!confirm('Bạn có chắc chắn muốn duyệt Tasker này?')) return;

    // API: PATCH /taskers/approve/:id
    const result = await apiCall(`/taskers/approve/${taskerId}`, 'PATCH');
    if (result) {
        alert('Duyệt thành công!');
        loadTaskers(); // Reload lại bảng
    }
}

// 2. Reject Tasker
async function rejectTasker(taskerId) {
    if (!confirm('Bạn có chắc chắn muốn từ chối Tasker này?')) return;

    // API: PATCH /taskers/reject/:id
    const result = await apiCall(`/taskers/reject/${taskerId}`, 'PATCH');
    if (result) {
        alert('Đã từ chối Tasker!');
        loadTaskers();
    }
}

// 3. Update Tasker Profile (Sử dụng 2 select box)
async function updateTasker(taskerId) {
    // Lấy giá trị từ các ô select
    const accStatusVal = document.getElementById(`acc-status-${taskerId}`).value;
    const workStatusVal = document.getElementById(`work-status-${taskerId}`).value;

    // Chuẩn bị body theo yêu cầu của controller updateTaskerProfile
    // Controller yêu cầu: { account_status, tasker_status }
    const body = {
        account_status: accStatusVal,
        tasker_status: workStatusVal
        // hourly_rate: ... (Nếu muốn sửa giá thì cần thêm input field vào HTML, hiện tại HTML không có input edit giá)
    };

    if (!confirm('Lưu các thay đổi trạng thái?')) return;

    // API: PATCH /taskers/update/:id
    const result = await apiCall(`/taskers/update/${taskerId}`, 'PATCH', body);
    if (result) {
        alert('Cập nhật thành công!');
        loadTaskers();
    }
}

// Khởi chạy khi trang load xong
document.addEventListener('DOMContentLoaded', loadTaskers);
