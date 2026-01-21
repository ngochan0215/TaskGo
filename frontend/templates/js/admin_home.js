(function () {
  const API_BASE = "http://localhost:3000/api/report";

  const token = localStorage.getItem("token");
  if (!token) {
    alert("Chưa đăng nhập! Vui lòng đăng nhập để truy cập.");
    window.location.href = "../auth/login-signup.html";
    return;
  }
  const role = localStorage.getItem("system_role");
  if (role !== "admin") {
    alert("Bạn không phải Admin. Không có quyền truy cập.");
    window.location.href = "../auth/login-signup.html";
    return;
  }

  const sidebarMobile = document.getElementById("sidebarMobile");
  const backdrop = document.getElementById("backdrop");
  if (sidebarMobile) {
    window.openSidebar = function () {
      sidebarMobile.classList.remove("-translate-x-full");
      if (backdrop) backdrop.classList.remove("hidden");
    };
  }
  if (backdrop) {
    window.closeSidebar = function () {
      if (sidebarMobile) sidebarMobile.classList.add("-translate-x-full");
      backdrop.classList.add("hidden");
    };
  }

  // logic đăng xuất
  const logoutBtn = document.querySelectorAll(".logout-btn");
  logoutBtn.forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.preventDefault();

      try {
        const res = await fetch("http://localhost:3000/api/auth/logout", {
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

  function formatCurrency(n) {
    if (n >= 1e9) return (n / 1e9).toFixed(1).replace(/\.0$/, "") + " Tỷ";
    if (n >= 1e6) return (n / 1e6).toFixed(1).replace(/\.0$/, "") + " Tr";
    if (n >= 1e3) return (n / 1e3).toFixed(0) + " K";
    return Number(n).toLocaleString("vi-VN");
  }

  function formatVND(n) {
    return Number(n).toLocaleString("vi-VN") + "đ";
  }

  function formatUpdatedAt(iso) {
    if (!iso) return "";
    const d = new Date(iso);
    return (
      String(d.getHours()).padStart(2, "0") +
      ":" +
      String(d.getMinutes()).padStart(2, "0") +
      " - " +
      String(d.getDate()).padStart(2, "0") +
      "/" +
      String(d.getMonth() + 1).padStart(2, "0") +
      "/" +
      d.getFullYear()
    );
  }

  function changeBadgeClass(pct) {
    if (pct > 0) return "text-green-600 bg-green-50";
    if (pct < 0) return "text-red-500 bg-red-50";
    return "text-gray-400 bg-gray-200";
  }

  function changeBadgeText(pct) {
    if (pct > 0) return "+" + pct + "%";
    if (pct < 0) return pct + "%";
    return "0%";
  }

  function statusBadgeClass(statusKey) {
    const m = {
      pending: "bg-yellow-100 text-yellow-700",
      assigned: "bg-blue-100 text-blue-700",
      accepted: "bg-blue-100 text-blue-700",
      departed: "bg-blue-100 text-blue-700",
      arrived: "bg-blue-100 text-blue-700",
      in_progress: "bg-blue-100 text-blue-700",
      awaiting_payment: "bg-amber-100 text-amber-700",
      completed: "bg-green-100 text-green-700",
      cancelled: "bg-red-100 text-red-700",
    };
    return m[statusKey] || "bg-gray-100 text-gray-700";
  }

  const TOP_SERVICE_COLORS = [
    "bg-primary-500",
    "bg-blue-500",
    "bg-orange-500",
    "bg-purple-500",
    "bg-pink-500",
  ];

  function renderCards(d) {
    const u = document.getElementById("dashboard-updated");
    if (u) u.textContent = "Cập nhật lúc: " + formatUpdatedAt(d.updatedAt);

    const cards = [
      {
        value: d.totalRevenue,
        change: d.revenueChangePercent,
        valueEl: "card-revenue",
        changeEl: "card-revenue-change",
        format: function (v) {
          return formatCurrency(v);
        },
      },
      {
        value: d.newOrders,
        change: d.newOrdersChangePercent,
        valueEl: "card-orders",
        changeEl: "card-orders-change",
        format: function (v) {
          return String(v);
        },
      },
      {
        value: d.totalCustomers,
        change: d.customersChangePercent,
        valueEl: "card-customers",
        changeEl: "card-customers-change",
        format: function (v) {
          return String(v);
        },
      },
      {
        value: d.activeTaskers,
        change: d.activeTaskersChangePercent,
        valueEl: "card-taskers",
        changeEl: "card-taskers-change",
        format: function (v) {
          return String(v);
        },
      },
    ];
    cards.forEach(function (c) {
      const ve = document.getElementById(c.valueEl);
      const ce = document.getElementById(c.changeEl);
      if (ve) ve.textContent = c.format(c.value);
      if (ce) {
        ce.textContent = changeBadgeText(c.change);
        ce.className =
          "text-xs font-bold px-2 py-0.5 rounded-full " +
          changeBadgeClass(c.change);
      }
    });
  }

  function renderChart(revenueByWeek) {
    const wrap = document.getElementById("chart-revenue-bars");
    const labelWrap = document.getElementById("chart-revenue-labels");
    if (!wrap) return;

    const amounts = (revenueByWeek || []).map(function (x) {
      return x.amount || 0;
    });
    const max = Math.max.apply(null, amounts.concat(1));
    const labels = (revenueByWeek || []).map(function (x) {
      return x.label;
    });

    wrap.innerHTML = (revenueByWeek || [])
      .map(function (r, i) {
        var h = max > 0 ? Math.max(4, (r.amount / max) * 100) : 4;
        var isMax = r.amount > 0 && r.amount >= max;
        return (
          '<div class="w-full bg-primary-200 hover:bg-primary-400 transition-all rounded-t relative group" style="height:' +
          h +
          '%">' +
          (isMax
            ? '<div class="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs py-1 px-2 rounded opacity-0 group-hover:opacity-100 transition">' +
              formatCurrency(r.amount) +
              "</div>"
            : "") +
          "</div>"
        );
      })
      .join("");

    if (labelWrap) {
      labelWrap.innerHTML = labels
        .map(function (l) {
          return "<span>" + l + "</span>";
        })
        .join("");
    }
  }

  function renderTopServices(topServices) {
    const container = document.getElementById("top-services");
    if (!container) return;

    if (!topServices || topServices.length === 0) {
      container.innerHTML =
        '<div class="text-sm text-gray-400 text-center py-4">Chưa có dữ liệu</div>';
      return;
    }

    container.innerHTML = topServices
      .map(function (s, i) {
        var color = TOP_SERVICE_COLORS[i % TOP_SERVICE_COLORS.length];
        return (
          '<div><div class="flex justify-between text-sm mb-1">' +
          '<span class="text-gray-700 font-medium">' +
          (s.name || "N/A") +
          "</span>" +
          '<span class="font-bold">' +
          (s.percent || 0) +
          "%</span></div>" +
          '<div class="w-full bg-gray-200 h-2 rounded-full overflow-hidden">' +
          '<div class="' +
          color +
          ' h-full" style="width:' +
          (s.percent || 0) +
          '%"></div></div></div>'
        );
      })
      .join("");
  }

  function renderLatestOrders(latestOrders) {
    const tbody = document.getElementById("table-latest-orders");
    if (!tbody) return;

    if (!latestOrders || latestOrders.length === 0) {
      tbody.innerHTML =
        '<tr><td colspan="5" class="px-4 py-6 text-center text-gray-400">Chưa có đơn hàng</td></tr>';
      return;
    }

    tbody.innerHTML = latestOrders
      .map(function (o) {
        return (
          '<tr class="hover:bg-gray-50">' +
          '<td class="px-4 py-3 font-medium">' +
          (o.idDisplay || o.id) +
          "</td>" +
          '<td class="px-4 py-3">' +
          (o.customerName || "N/A") +
          "</td>" +
          '<td class="px-4 py-3">' +
          (o.serviceName || "N/A") +
          "</td>" +
          '<td class="px-4 py-3"><span class="px-2 py-0.5 rounded text-xs font-bold ' +
          statusBadgeClass(o.statusKey) +
          '">' +
          (o.status || "N/A") +
          "</span></td>" +
          '<td class="px-4 py-3 text-right font-bold">' +
          formatVND(o.amount) +
          "</td></tr>"
        );
      })
      .join("");
  }

  function loadDashboard(period) {
    var p =
      period ||
      (document.getElementById("period-select") &&
        document.getElementById("period-select").value) ||
      "month";
    var url = API_BASE + "/dashboard?period=" + encodeURIComponent(p);

    fetch(url, {
      headers: { Authorization: "Bearer " + token },
    })
      .then(function (r) {
        if (r.status === 401) {
          localStorage.removeItem("token");
          window.location.href = "../auth/login-signup.html";
          return null;
        }
        return r.json();
      })
      .then(function (data) {
        if (!data || !data.success) return;
        renderCards(data);
        renderChart(data.revenueByWeek || []);
        renderTopServices(data.topServices || []);
        renderLatestOrders(data.latestOrders || []);
      })
      .catch(function (e) {
        console.error("loadDashboard error:", e);
      });
  }

  function exportReport() {
    fetch(API_BASE + "/export-pdf", {
      headers: { Authorization: "Bearer " + token },
    })
      .then(function (r) {
        if (r.status === 401) {
          localStorage.removeItem("token");
          window.location.href = "../auth/login-signup.html";
          return null;
        }
        return r.blob();
      })
      .then(function (blob) {
        if (!blob) return;
        var a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        a.download = "report.pdf";
        a.click();
        URL.revokeObjectURL(a.href);
      })
      .catch(function (e) {
        console.error("export error:", e);
      });
  }

  function onPeriodChange() {
    var s = document.getElementById("period-select");
    if (s) loadDashboard(s.value);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", function () {
      loadDashboard("month");
      var sel = document.getElementById("period-select");
      if (sel) sel.addEventListener("change", onPeriodChange);
      var btn = document.getElementById("btn-export");
      if (btn) btn.addEventListener("click", exportReport);
    });
  } else {
    loadDashboard("month");
    var sel = document.getElementById("period-select");
    if (sel) sel.addEventListener("change", onPeriodChange);
    var btn = document.getElementById("btn-export");
    if (btn) btn.addEventListener("click", exportReport);
  }
})();
