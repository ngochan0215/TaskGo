let isEditing = false;
let currentSkills = [];
let longitude = 0;
let latitude = 0;

let token = localStorage.getItem("token");
if (!token) {
    alert("Chưa đăng nhập! Vui lòng đăng nhập để truy cập.");
    window.location.href = "../auth/login-signup.html";
}
console.log("TOKEN: ", token);

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

    renderSkills(currentSkills);
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

    console.log("PROFILE DATA: ", data.user);

    // chỉ xử lý customer
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

    document.getElementById("bin").value = BIN || "Chưa xác định";
    document.getElementById("account-number").value = account_number || "Chưa xác định";

    // avatar
    document.getElementById("avatar").src = user.avatar_url || "https://api.dicebear.com/9.x/bottts/svg?seed=Charlie";

    } catch (error) {
        console.error("Lỗi load profile:", error);
    }
}

async function updateProfile() {
    try {
    const token = localStorage.getItem("token");

    const full_name = document.getElementById("full-name-input").value;
    const phone_number =  document.getElementById("phone").value;
    const identification = document.getElementById("cccd").value;
    
    const introduction = document.getElementById("intro").value;

    const areaInput = document.getElementById("working-area").value;
    const working_area = areaInput ? {
        full_address: areaInput,
        longitude, 
        latitude,
    } : {
        full_address: "Hàn Thuyên, Khu phố 6, Phường Thủ Đức, Thành phố Hồ Chí Minh, Việt Nam",
        longitude: 10.870219615908955,
        latitude: 106.80305409412628
    };

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

window.updateProfile = updateProfile;
window.updateAvatar = updateAvatar;

document.addEventListener("DOMContentLoaded", loadUserProfile);