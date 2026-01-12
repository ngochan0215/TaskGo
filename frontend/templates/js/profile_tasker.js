let isEditing = false;

const editBtn = document.getElementById("editToggle");
const updateBtn = document.getElementById("updateBtn");

const editableInputs = [
    document.getElementById("fullName"),
    document.getElementById("cccd"),
    document.getElementById("phone"),
    document.getElementById("intro"),
    document.getElementById("working-area")
];

editBtn.addEventListener("click", () => {
    isEditing = !isEditing;

    editableInputs.forEach(input => {
    input.readOnly = !isEditing;
    input.classList.toggle("bg-white", isEditing);
    });

    updateBtn.disabled = !isEditing;
    updateBtn.classList.toggle("opacity-50", !isEditing);
    updateBtn.classList.toggle("cursor-not-allowed", !isEditing);

    editBtn.innerHTML = isEditing
    ? `<span>Hủy chỉnh sửa</span>
        <span class="material-symbols-outlined ml-1">close</span>`
    : `<span>Chỉnh sửa thông tin</span>
        <span class="material-symbols-outlined ml-1">edit</span>`;
});

async function loadUserProfile() {
    try {
    const token = localStorage.getItem("token");
    if (!token) {
        alert("Chưa đăng nhập! Vui lòng đăng nhập để truy cập.");
        window.location.href = "../auth/login-signup.html";
        return;
    }

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
    const { user, role, email, working_area, working_year, hourly_rate, introduction } = data;

    // chỉ xử lý customer
    if (role !== "tasker") {
        alert("Bạn không phải là tasker! Vui lòng đăng nhập để truy cập.");
        window.location.href = "../auth/login-signup.html";
        return;
    }

    // bind data vào UI
    document.getElementById("fullName").innerText = user.full_name || "";
    document.getElementById("phone").value = user.phone_number || "";
    document.getElementById("cccd").value = user.identification || "";
    document.getElementById("email").value = email || "";
    document.getElementById("intro").value = introduction || "";
    document.getElementById("working-year").value = working_year || 1;
    document.getElementById("hourly-rate").value = hourly_rate || 1;
    document.getElementById("working-area").value = working_area || "Chưa xác định";

    // avatar
    document.getElementById("avatar").src = user.avatar_url || "https://api.dicebear.com/9.x/bottts/svg?seed=Charlie";

    } catch (error) {
        console.error("Lỗi load profile:", error);
    }
}

async function updateProfile() {
    try {
    const token = localStorage.getItem("token");

    const payload = {
        full_name: document.getElementById("fullName").innerText,
        phone_number: document.getElementById("phone").value,
        identification: document.getElementById("cccd").value,
        introduction: document.getElementById("intro").value,
        working_area: document.getElementById("working-area").value
    };

    // loại bỏ field rỗng (rất quan trọng)
    Object.keys(payload).forEach(
        key => payload[key] === "" && delete payload[key]
    );

    console.log("UPDATE PAYLOAD: ", payload);

    const res = await fetch("http://localhost:3000/api/user/profile/update", {
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

    alert("✅ Cập nhật thông tin thành công");

    if (data.success) {
        isEditing = false;

        editableInputs.forEach(input => input.readOnly = true);
        updateBtn.disabled = true;
        updateBtn.classList.add("opacity-50", "cursor-not-allowed");

        editBtn.innerHTML = `
        <span>Chỉnh sửa thông tin</span>
        <span class="material-symbols-outlined ml-1">edit</span>
        `;
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

window.updateProfile = updateProfile;
window.updateAvatar = updateAvatar;

document.addEventListener("DOMContentLoaded", loadUserProfile);