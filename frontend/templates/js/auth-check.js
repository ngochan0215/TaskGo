(function checkAuth() {
  const token = localStorage.getItem("token");

  if (!token) {
    alert("Chưa đăng nhập! Vui lòng đăng nhập để tiếp tục.");
    window.location.href = "../../auth/login-signup.html";
  }
})();
