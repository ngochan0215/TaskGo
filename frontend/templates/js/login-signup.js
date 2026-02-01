const API_BASE = (typeof window.CONFIG !== "undefined" && window.CONFIG.API_BASE_URL) 
? window.CONFIG.API_BASE_URL : "http://localhost:3000";

console.log("api url: ", window.CONFIG);

// ====== DOM ELEMENTS =====`=
const tabLogin = document.getElementById('tab-login');
const tabSignup = document.getElementById('tab-signup');
const gotoSignup = document.getElementById('goto-signup');
const formSlider = document.getElementById('form-slider');

const passwordInputLogin = document.getElementById('login-password');
const passwordInputSignup = document.getElementById('signup-password');
const togglePasswordLogin = document.getElementById('toggle-password-login');
const togglePasswordSignup = document.getElementById('toggle-password-signup');

const eyeOpenIcon = document.getElementById('eye-open-icon');
const eyeSlashIcon = document.getElementById('eye-slash-icon');

const loginErrorMsg = document.getElementById('login-error');
const signupErrorMsg = document.getElementById('signup-error');

function showSignupForm() {
  formSlider.classList.add('-translate-x-full');

  tabSignup.classList.add('text-primary-400', 'border-primary-400', 'border-b-2');
  tabSignup.classList.remove('text-gray-400');

  tabLogin.classList.remove('text-primary-400', 'border-primary-400', 'border-b-2');
  tabLogin.classList.add('text-gray-400');
}


function showLoginForm() {
  formSlider.classList.remove('-translate-x-full');

  tabLogin.classList.add('text-primary-400', 'border-primary-400', 'border-b-2');
  tabLogin.classList.remove('text-gray-400');

  tabSignup.classList.remove('text-primary-400', 'border-primary-400', 'border-b-2');
  tabSignup.classList.add('text-gray-400');
}


// ====== PASSWORD TOGGLE ======
function togglePassword(input) {
  const isPassword = input.type === 'password';
  input.type = isPassword ? 'text' : 'password';

  eyeOpenIcon.classList.toggle('hidden', !isPassword);
  eyeSlashIcon.classList.toggle('hidden', isPassword);
}

togglePasswordLogin.addEventListener('click', () => togglePassword(passwordInputLogin));
togglePasswordSignup.addEventListener('click', () => togglePassword(passwordInputSignup));

// ====== EVENTS ======
tabSignup.addEventListener('click', showSignupForm);
gotoSignup.addEventListener('click', showSignupForm);
tabLogin.addEventListener('click', showLoginForm);

// ====== ERROR HANDLING ======
function showErrorMessage(message) {
  loginErrorMsg.textContent = message;
  signupErrorMsg.textContent = message;
  loginErrorMsg.classList.remove('hidden');
  signupErrorMsg.classList.remove('hidden');
}

function hideErrorMessage() {
  loginErrorMsg.classList.add('hidden');
  signupErrorMsg.classList.add('hidden');
  loginErrorMsg.textContent = '';
  signupErrorMsg.textContent = '';
}

// ====== VALIDATION ======
function validateInput({ email, password, phone_number, identification }) {
  const errors = {};

  if (phone_number !== undefined) {
    const phoneRegex = /^(0|\+84)(3|5|7|8|9)[0-9]{8}$/;
    if (!phone_number) 
        errors.phone = "Vui lòng nhập số điện thoại.";
    else if (!phoneRegex.test(phone_number))
        errors.phone = "Số điện thoại không hợp lệ.";
  }

  if (!identification) 
    errors.CCCD = "Vui lòng nhập CCCD.";
  else if (!/^\d{12}$/.test(identification))
    errors.CCCD = "CCCD phải gồm 12 số.";

  if (!email) 
    errors.email = "Vui lòng nhập email.";
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email))
    errors.email = "Email không hợp lệ.";

  if (!password) 
    errors.password = "Vui lòng nhập mật khẩu.";
  else if (!/^(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&]).{8,}$/.test(password))
    errors.password = "Mật khẩu phải có tối thiểu 8 ký tự, ít nhất một chữ hoa, một chữ thường, một ký tự đặc biệt và một số.";

  return {
    isValid: Object.keys(errors).length === 0,
    errors
  };
}

// ====== LOGIN ======
function handleLogin() {
  document.getElementById("login-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    hideErrorMessage();

    const email = document.getElementById("login-email").value;
    const password = document.getElementById("login-password").value;

    try {
      const res = await fetch(`${API_BASE}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });

      const data = await res.json();
      console.log("data: ", data);
      if (!res.ok) return showErrorMessage(data.message);

      localStorage.setItem("token", data.token);
      localStorage.setItem("user_id", data.user_id);
      localStorage.setItem("system_role", data.system_role);

      const system_role = data.system_role;

      if (system_role === "admin") {
        window.location.href = "../admin/admin_home.html";
      } else if (system_role === "tasker") {
        window.location.href = "../tasker/tasker_home.html";
      } else {
        window.location.href = "../customer/customer_home.html";
      }

    } catch {
      showErrorMessage("Không thể kết nối máy chủ.");
    }
  });
}

// ====== SIGNUP ======
function handleSignup() {
  document.getElementById("signup-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    hideErrorMessage();

    const payload = {
      phone_number: document.getElementById("signup-phone").value,
      email: document.getElementById("signup-email").value,
      full_name: document.getElementById("signup-fullname").value,
      identification: document.getElementById("signup-CCCD").value,
      password: document.getElementById("signup-password").value,
      role: "customer"
    };

    const result = validateInput(payload);
    if (!result.isValid) {
      Object.values(result.errors).forEach(showErrorMessage);
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/auth/signup/customer`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });

      const data = await res.json();
      if (!res.ok) return showErrorMessage(data.message);

      alert("Đăng ký thành công! Vui lòng xác thực email.");
      window.location.href = "otp_verifyEmail.html";
    } catch (error) {
      showErrorMessage("Không thể kết nối máy chủ.", error.message);
    }
  });
}

// ====== INIT ======
handleLogin();
handleSignup();
