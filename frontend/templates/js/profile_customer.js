let isEditing = false;
let addresses = [];

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

async function loadUserAddresses() {
    try {
        const res = await fetch("http://localhost:3000/api/user/addresses/my", {
            headers: {
                "Authorization": `Bearer ${token}`,
                "Content-Type": "application/json"
            }
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

    addresses.forEach(addr => {
        const div = document.createElement("div");
        div.className = `
            flex items-center gap-2 px-3 py-2 rounded-lg border
            ${addr.is_default ? "border-primary-500 bg-primary-50" : "border-gray-300 bg-gray-50"}
        `;

        div.innerHTML = `
            <span class="text-sm">${addr.full_address}</span>

            ${addr.is_default ? `
              <span class="material-symbols-outlined text-primary-500 text-sm">
                check_circle
              </span>
            ` : ""}

            ${isEditing ? `
              <button onclick="deleteAddress('${addr._id}')"
                class="material-symbols-outlined text-red-500 text-sm">
                delete
              </button>
            ` : ""}
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
            `http://localhost:3000/api/user/addresses/${addressId}`,
            {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${token}`,
                }
            }
        );

        const data = await res.json();

        if (!res.ok || !data.success) {
            alert(data.message || "Xóa địa chỉ thất bại");
            return;
        }

        addresses = addresses.filter(a => a._id !== addressId);
        renderAddresses();
        location.reload();

    } catch (err) {
        console.error("Delete address error:", err);
        alert("Có lỗi khi xóa địa chỉ");
    }
}


// TODO: FE sửa lại cho đẹp
async function openAddAddressModal() {
    const full_address = prompt("Nhập địa chỉ mới:");
    if (!full_address) return;

    const payload = {
        full_address, street, ward, district, city,
        longitude, latitude
    }

    try {
        const res = await fetch(
            "http://localhost:3000/api/user/addresses",
            {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ payload })
            }
        );

        const data = await res.json();

        if (!res.ok || !data.success) {
            alert(data.message || "Thêm địa chỉ thất bại");
            return;
        }

        // backend trả address vừa tạo
        addresses.push(data.address);
        renderAddresses();

    } catch (err) {
        console.error("Add address error:", err);
        alert("Có lỗi khi thêm địa chỉ");
    }
}

async function loadUserProfile() {
    try {
        const res = await fetch("http://localhost:3000/api/user/profile", {
            method: "GET",
            headers: {
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
            }
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

        // chỉ xử lý customer
        if (role !== "customer") return;

        // bind data vào UI
        document.getElementById("full-name").innerText = user.full_name || "";
        document.getElementById("full-name-input").value = user.full_name || "";
        document.getElementById("phone").value = user.phone_number || "";
        document.getElementById("cccd").value = user.identification || "";
        document.getElementById("email").value = email || "";
        document.getElementById("rank").value = mapCustomerType(type) || "Khách hàng mới";
        document.getElementById("bin").value = BIN;
        document.getElementById("account-number").value = account_number;

        // avatar
        document.getElementById("avatar").src = user.avatar_url || "https://api.dicebear.com/9.x/bottts/svg?seed=Julia";

        await loadUserAddresses();

    } catch (error) {
        console.error("Lỗi load profile:", error);
    }
}

async function updateProfile() {
    try {
        const full_name = document.getElementById("full-name-input").value;
        const phone_number =  document.getElementById("phone").value;
        const identification = document.getElementById("cccd").value;
        
        const BIN = document.getElementById("bin").value;
        const account_number = document.getElementById("account-number").value;

        if (!BIN || !account_number) {
        return alert("Yêu cầu nhập đầy đủ thông tin tài khoản ngân hàng.");
        }
        
        const payload = {
            full_name, phone_number, identification, BIN, account_number,
        };

        Object.keys(payload).forEach(
            key => payload[key] === "" && delete payload[key]
        );

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