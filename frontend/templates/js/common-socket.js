// js/common-socket.js
document.addEventListener("DOMContentLoaded", () => {
  const token = localStorage.getItem("token");
  if (!token) return;

  const socket = io("http://localhost:3000", {
    auth: { token: `Bearer ${token}` },
    transporter: ["websocket", "polling"],
  });

  socket.on("system_notification", (data) => {
    console.log("Thông báo hệ thống:", data.message);
    showToast(data.message, "bg-blue-500");
  });

  // --- 2. Lắng nghe thông báo ĐƠN HÀNG (Chỉ mình mình nhận) ---
  socket.on("new_order", (data) => {
    console.log("Đơn hàng mới:", data.data);
    // Hiển thị thông báo nổi bật hơn hoặc âm thanh
    showOrderModal(data);
  });

  // Hàm hiển thị Toast (Dùng Tailwind CSS giống code bạn gửi)
  function showToast(message, bgColor) {
    const toast = document.createElement("div");
    toast.className = `fixed bottom-5 left-5 ${bgColor} text-white px-6 py-3 rounded-xl shadow-2xl z-[9999] transition-all`;
    toast.innerHTML = `<div class="flex items-center gap-2">
            <span class="material-symbols-outlined">notifications</span>
            <span class="font-bold">${message}</span>
        </div>`;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 5000);
  }

  // Hàm hiển thị Modal khi có đơn hàng
  function showOrderModal(orderData) {
    // Bạn có thể dùng một thẻ div ẩn sẵn trong HTML hoặc tạo mới
    alert("CÓ ĐƠN HÀNG MỚI: " + orderData.message);
    // Hoặc cập nhật số lượng thông báo trên icon chuông
    const badge = document.getElementById("notification-badge");
    if (badge) badge.classList.remove("hidden");
  }
});
