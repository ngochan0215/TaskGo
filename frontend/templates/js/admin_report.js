let token = localStorage.getItem("token");
if (!token) {
  alert("Vui lòng đăng nhập");
  window.location.href = "../auth/login-signup.html";
}

const role = localStorage.getItem("system_role");
if (role !== "admin") {
  alert("Bạn không có quyền truy cập trang này.");
  window.location.href = "../auth/login-signup.html";
}

let currentPeriod = "month";
let charts = {};

const API_BASE = "http://localhost:3000/api/report";

function formatCurrency(amount) {
  return new Intl.NumberFormat("vi-VN").format(amount || 0) + "đ";
}

function formatNumber(num) {
  return new Intl.NumberFormat("vi-VN").format(num || 0);
}

function getPeriod() {
  return document.getElementById("period-select")?.value || "month";
}

async function loadOrderStatistics() {
  try {
    const period = getPeriod();
    const [ordersRes, reviewsRes] = await Promise.all([
      fetch(`${API_BASE}/orders/statistics?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` }
      }),
      fetch(`${API_BASE}/reviews/statistics?period=${period}`, {
        headers: { Authorization: `Bearer ${token}` }
      })
    ]);

    if (ordersRes.status === 401 || reviewsRes.status === 401) {
      localStorage.removeItem("token");
      alert("Phiên đăng nhập hết hạn");
      window.location.href = "../auth/login-signup.html";
      return;
    }

    const ordersData = await ordersRes.json();
    const reviewsData = await reviewsRes.json();
    
    console.log("Order stats:", ordersData);
    console.log("Review stats:", reviewsData);

    if (!ordersData.success) return;

    // Update order cards
    document.getElementById("orders-total").textContent = formatNumber(ordersData.totalOrders);
    document.getElementById("orders-success-rate").textContent = ordersData.successRate + "%";
    document.getElementById("orders-cancel-rate").textContent = ordersData.cancelRate + "%";
    document.getElementById("orders-completed").textContent = formatNumber(ordersData.completed);

    // Update review cards if data available
    if (reviewsData.success) {
      document.getElementById("reviews-total").textContent = formatNumber(reviewsData.totalReviews);
      document.getElementById("reviews-average").textContent = reviewsData.averageRating.toFixed(1) + " ⭐";
      document.getElementById("reviews-period").textContent = formatNumber(reviewsData.totalReviews);

      // Render review charts
      renderReviewCharts(reviewsData);
    }

    if (ordersData.success) {
      renderOrderCharts(ordersData);
    }

  } catch (err) {
    console.error("Load order statistics error:", err);
  }
}

const STATUS_LABELS_VI = {
  pending: "Chờ xử lý",
  cancelled: "Đã hủy",
  completed: "Hoàn thành",
  in_progress: "Đang thực hiện",
  accepted: "Đã nhận"
};

function renderOrderCharts(data) {
  // Chart: Orders by status (pie)
  const statusCtx = document.getElementById("chart-orders-status");
  if (charts.ordersStatus) 
    charts.ordersStatus.destroy();

  charts.ordersStatus = new Chart(statusCtx, {
    type: "pie",
    data: {
      labels: data.statusStats.map(s => STATUS_LABELS_VI[s.status] || s.status),
      datasets: [
        {
        data: data.statusStats.map(s => s.count),
        backgroundColor: [
          "#3b5f43", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899"
        ]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" }
      }
    }
  });

  // Chart: Daily orders (line)
  const dailyCtx = document.getElementById("chart-orders-daily");
  if (charts.ordersDaily) charts.ordersDaily.destroy();
  charts.ordersDaily = new Chart(dailyCtx, {
    type: "line",
    data: {
      labels: data.dailyOrders.map(d => d._id),
      datasets: [
        {
          label: "Tổng đơn",
          data: data.dailyOrders.map(d => d.count),
          borderColor: "#3b5f43",
          backgroundColor: "rgba(59, 95, 67, 0.1)"
        },
        {
          label: "Hoàn thành",
          data: data.dailyOrders.map(d => d.completed),
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)"
        },
        {
          label: "Hủy",
          data: data.dailyOrders.map(d => d.cancelled),
          borderColor: "#ef4444",
          backgroundColor: "rgba(239, 68, 68, 0.1)"
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  // Chart: Revenue by status (bar)
  const revenueCtx = document.getElementById("chart-orders-revenue");
  if (charts.ordersRevenue) charts.ordersRevenue.destroy();
  charts.ordersRevenue = new Chart(revenueCtx, {
    type: "bar",
    data: {
      labels: data.revenueByStatus.map(r => r._id),
      datasets: [{
        label: "Doanh thu (VNĐ)",
        data: data.revenueByStatus.map(r => r.total),
        backgroundColor: "#3b5f43"
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (context) => formatCurrency(context.parsed.y)
          }
        }
      },
      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            callback: (value) => formatCurrency(value)
          }
        }
      }
    }
  });
}

function renderReviewCharts(data) {
  // Chart: Rating distribution (bar)
  const distCtx = document.getElementById("chart-reviews-distribution");
  if (charts.reviewsDistribution) charts.reviewsDistribution.destroy();
  charts.reviewsDistribution = new Chart(distCtx, {
    type: "bar",
    data: {
      labels: data.ratingDistribution.map(r => r.rating + " sao"),
      datasets: [{
        label: "Số lượng",
        data: data.ratingDistribution.map(r => r.count),
        backgroundColor: ["#ef4444", "#f59e0b", "#eab308", "#84cc16", "#10b981"]
      }]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });

  // Chart: Daily reviews (line)
  const dailyCtx = document.getElementById("chart-reviews-daily");
  if (charts.reviewsDaily) charts.reviewsDaily.destroy();
  charts.reviewsDaily = new Chart(dailyCtx, {
    type: "line",
    data: {
      labels: data.dailyReviews.map(d => d._id),
      datasets: [
        {
          label: "Số đánh giá",
          data: data.dailyReviews.map(d => d.count),
          borderColor: "#3b5f43",
          backgroundColor: "rgba(59, 95, 67, 0.1)",
          yAxisID: "y"
        },
        {
          label: "Điểm TB",
          data: data.dailyReviews.map(d => d.avgRating),
          borderColor: "#f59e0b",
          backgroundColor: "rgba(245, 158, 11, 0.1)",
          yAxisID: "y1"
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" }
      },
      scales: {
        y: {
          beginAtZero: true,
          position: "left"
        },
        y1: {
          beginAtZero: true,
          max: 5,
          position: "right",
          grid: { drawOnChartArea: false }
        }
      }
    }
  });

  // Chart: Reviews by role (bar)
  const roleCtx = document.getElementById("chart-reviews-by-role");
  if (charts.reviewsByRole) charts.reviewsByRole.destroy();
  charts.reviewsByRole = new Chart(roleCtx, {
    type: "bar",
    data: {
      labels: data.reviewByRole.map(r => r.role === "customer" ? "Đánh giá Customer" : "Đánh giá Tasker"),
      datasets: [
        {
          label: "Số lượng",
          data: data.reviewByRole.map(r => r.count),
          backgroundColor: "#3b5f43"
        },
        {
          label: "Điểm TB",
          data: data.reviewByRole.map(r => r.avgRating),
          backgroundColor: "#f59e0b",
          yAxisID: "y1"
        }
      ]
    },
    options: {
      responsive: true,
      plugins: {
        legend: { position: "bottom" }
      },
      scales: {
        y: {
          beginAtZero: true,
          position: "left"
        },
        y1: {
          beginAtZero: true,
          max: 5,
          position: "right",
          grid: { drawOnChartArea: false }
        }
      }
    }
  });
}

async function loadServiceStatistics() {
  try {
    const res = await fetch(`${API_BASE}/services/statistics?limit=10`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401) {
      localStorage.removeItem("token");
      alert("Phiên đăng nhập hết hạn");
      window.location.href = "../auth/login-signup.html";
      return;
    }

    const data = await res.json();
    if (!data.success) return;

    // Update Service (danh mục) cards
    document.getElementById("services-total-orders").textContent = formatNumber(data.totals.totalOrders);
    document.getElementById("services-total-revenue").textContent = formatCurrency(data.totals.totalRevenue);
    document.getElementById("services-count").textContent = formatNumber(data.topByOrders.length);

    // Chart: Top services (danh mục) by orders (bar)
    const ordersCtx = document.getElementById("chart-services-orders");
    if (charts.servicesOrders) charts.servicesOrders.destroy();
    charts.servicesOrders = new Chart(ordersCtx, {
      type: "bar",
      data: {
        labels: data.topByOrders.map(s => s.name),
        datasets: [{
          label: "Số đơn",
          data: data.topByOrders.map(s => s.orderCount),
          backgroundColor: "#3b5f43"
        }]
      },
      options: {
        responsive: true,
        indexAxis: "y",
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { beginAtZero: true }
        }
      }
    });

    // Chart: Top services (danh mục) by revenue (bar)
    const revenueCtx = document.getElementById("chart-services-revenue");
    if (charts.servicesRevenue) charts.servicesRevenue.destroy();
    charts.servicesRevenue = new Chart(revenueCtx, {
      type: "bar",
      data: {
        labels: data.topByRevenue.map(s => s.name),
        datasets: [{
          label: "Doanh thu",
          data: data.topByRevenue.map(s => s.revenue),
          backgroundColor: "#10b981"
        }]
      },
      options: {
        responsive: true,
        indexAxis: "y",
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => formatCurrency(context.parsed.x)
            }
          }
        },
        scales: {
          x: {
            beginAtZero: true,
            ticks: {
              callback: (value) => formatCurrency(value)
            }
          }
        }
      }
    });

    // Chart: Service (danh mục) distribution (pie)
    // const distCtx = document.getElementById("chart-services-distribution");
    // if (charts.tasksOrders) charts.tasksOrders.destroy();
    //   charts.tasksOrders = new Chart(distCtx, {
    //     type: "pie",
    //     data: {
    //       labels: data.topTasksByOrders.map(t => `${t.taskName} - ${t.serviceName}`),
    //       datasets: [{
    //         label: "Số đơn",
    //         data: data.topTasksByOrders.map(t => t.orderCount),
    //         backgroundColor: [
    //           "#3b5f43", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#f97316"
    //         ]
    //       }]
    //     },
    //     options: {
    //       responsive: true,
    //       plugins: {
    //         legend: { position: "bottom" }
    //       }
    //     }
    //   });
    // if (charts.servicesDistribution) charts.servicesDistribution.destroy();
    // charts.servicesDistribution = new Chart(distCtx, {
    //   type: "pie",
    //   data: {
    //     labels: data.serviceDistribution.map(s => s.name),
    //     datasets: [{
    //       data: data.serviceDistribution.map(s => s.count),
    //       backgroundColor: [
    //         "#3b5f43", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#f97316"
    //       ]
    //     }]
    //   },
    //   options: {
    //     responsive: true,
    //     plugins: {
    //       legend: { position: "bottom" }
    //     }
    //   }
    // });

    // Update Task (dịch vụ cụ thể) cards
    if (data.topTasksByOrders && data.topTasksByOrders.length > 0) {
      // document.getElementById("tasks-total-orders").textContent = formatNumber(data.totals.totalOrders);
      // document.getElementById("tasks-total-revenue").textContent = formatCurrency(data.totals.totalRevenue);
      // document.getElementById("tasks-count").textContent = formatNumber(data.topTasksByOrders.length);

      // Chart: Top tasks (dịch vụ cụ thể) 
      const tasksOrdersCtx = document.getElementById("chart-tasks-orders");
      if (charts.tasksOrders) charts.tasksOrders.destroy();
      charts.tasksOrders = new Chart(tasksOrdersCtx, {
        type: "pie",
        data: {
          labels: data.topTasksByOrders.map(t => `${t.taskName} - ${t.serviceName}`),
          datasets: [{
            label: "Số đơn",
            data: data.topTasksByOrders.map(t => t.orderCount),
            backgroundColor: [
              "#3b5f43", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6", "#06b6d4", "#ec4899", "#f97316"
            ]
          }]
        },
        options: {
          responsive: true,
          plugins: {
            legend: { position: "bottom" }
          }
        }
      });

      // Chart: Top tasks (dịch vụ cụ thể) by revenue (bar)
      const tasksRevenueCtx = document.getElementById("chart-tasks-revenue");
      if (charts.tasksRevenue) charts.tasksRevenue.destroy();
      charts.tasksRevenue = new Chart(tasksRevenueCtx, {
        type: "bar",
        data: {
          labels: data.topTasksByRevenue.map(t => `${t.taskName}`),
          datasets: [{
            label: "Doanh thu",
            data: data.topTasksByRevenue.map(t => t.revenue),
            backgroundColor: "#06b6d4"
          }]
        },
        options: {
          responsive: true,
          indexAxis: "y",
          plugins: {
            legend: { display: false },
            tooltip: {
              callbacks: {
                label: (context) => formatCurrency(context.parsed.x)
              }
            }
          },
          scales: {
            x: {
              beginAtZero: true,
              ticks: {
                callback: (value) => formatCurrency(value)
              }
            }
          }
        }
      });
    }
  } catch (err) {
    console.error("Load service statistics error:", err);
  }
}

async function loadUserStatistics() {
  try {
    const period = getPeriod();
    const res = await fetch(`${API_BASE}/users/statistics?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401) {
      localStorage.removeItem("token");
      alert("Phiên đăng nhập hết hạn");
      window.location.href = "../auth/login-signup.html";
      return;
    }

    const data = await res.json();
    if (!data.success) return;

    // Update cards
    document.getElementById("users-total-customers").textContent = formatNumber(data.totalCustomers);
    document.getElementById("users-total-taskers").textContent = formatNumber(data.totalTaskers);
    document.getElementById("users-new-customers").textContent = formatNumber(data.newCustomers);
    document.getElementById("users-new-taskers").textContent = formatNumber(data.newTaskers);
    document.getElementById("users-customer-growth").textContent = 
      `${data.customerGrowth >= 0 ? "+" : ""}${data.customerGrowth}% so với kỳ trước`;
    document.getElementById("users-tasker-growth").textContent = 
      `${data.taskerGrowth >= 0 ? "+" : ""}${data.taskerGrowth}% so với kỳ trước`;

    // Chart: Customer tiers (pie)
    const customerTiersCtx = document.getElementById("chart-users-customer-tiers");
    if (charts.usersCustomerTiers) charts.usersCustomerTiers.destroy();
    charts.usersCustomerTiers = new Chart(customerTiersCtx, {
      type: "pie",
      data: {
        labels: data.customerTiers.map(t => {
          const tierMap = { new: "Mới", loyal: "Thân thiết", vip: "VIP" };
          return tierMap[t.tier] || t.tier;
        }),
        datasets: [{
          data: data.customerTiers.map(t => t.count),
          backgroundColor: ["#3b5f43", "#10b981", "#f59e0b"]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" }
        }
      }
    });

    // Chart: Tasker status (pie)
    const taskerStatusCtx = document.getElementById("chart-users-tasker-status");
    if (charts.usersTaskerStatus) charts.usersTaskerStatus.destroy();
    charts.usersTaskerStatus = new Chart(taskerStatusCtx, {
      type: "pie",
      data: {
        labels: data.taskerStatus.map(s => {
          const statusMap = { pending: "Chờ duyệt", working: "Đang làm", resign: "Nghỉ việc" };
          return statusMap[s.status] || s.status;
        }),
        datasets: [{
          data: data.taskerStatus.map(s => s.count),
          backgroundColor: ["#f59e0b", "#10b981", "#ef4444"]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" }
        }
      }
    });

    // Chart: Customer growth (line)
    const customerGrowthCtx = document.getElementById("chart-users-customer-growth");
    if (charts.usersCustomerGrowth) charts.usersCustomerGrowth.destroy();
    charts.usersCustomerGrowth = new Chart(customerGrowthCtx, {
      type: "line",
      data: {
        labels: data.customerGrowthDaily.map(d => d._id),
        datasets: [{
          label: "Customer mới",
          data: data.customerGrowthDaily.map(d => d.count),
          borderColor: "#3b5f43",
          backgroundColor: "rgba(59, 95, 67, 0.1)",
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });

    // Chart: Tasker growth (line)
    const taskerGrowthCtx = document.getElementById("chart-users-tasker-growth");
    if (charts.usersTaskerGrowth) charts.usersTaskerGrowth.destroy();
    charts.usersTaskerGrowth = new Chart(taskerGrowthCtx, {
      type: "line",
      data: {
        labels: data.taskerGrowthDaily.map(d => d._id),
        datasets: [{
          label: "Tasker mới",
          data: data.taskerGrowthDaily.map(d => d.count),
          borderColor: "#10b981",
          backgroundColor: "rgba(16, 185, 129, 0.1)",
          fill: true
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { beginAtZero: true }
        }
      }
    });
  } catch (err) {
    console.error("Load user statistics error:", err);
  }
}

async function loadRevenueStatistics() {
  try {
    const period = getPeriod();
    const res = await fetch(`${API_BASE}/revenue/statistics?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401) {
      localStorage.removeItem("token");
      alert("Phiên đăng nhập hết hạn");
      window.location.href = "../auth/login-signup.html";
      return;
    }

    const data = await res.json();
    if (!data.success) return;

    // Update cards
    document.getElementById("revenue-total").textContent = formatCurrency(data.revenue.total);
    document.getElementById("revenue-change").textContent = 
      `${data.revenue.change >= 0 ? "+" : ""}${data.revenue.change}% so với kỳ trước`;
    document.getElementById("revenue-payouts").textContent = formatCurrency(data.payouts.total);
    document.getElementById("revenue-payouts-change").textContent = 
      `${data.payouts.change >= 0 ? "+" : ""}${data.payouts.change}% so với kỳ trước`;
    document.getElementById("revenue-pending").textContent = formatCurrency(data.pendingEarnings.total);
    document.getElementById("revenue-profit").textContent = formatCurrency(data.netProfit.total);
    document.getElementById("revenue-profit-percent").textContent = 
      `${data.netProfit.percentage}% của doanh thu`;

    // Chart: Payment methods (pie)
    const paymentCtx = document.getElementById("chart-revenue-payment-methods");
    if (charts.revenuePaymentMethods) charts.revenuePaymentMethods.destroy();
    charts.revenuePaymentMethods = new Chart(paymentCtx, {
      type: "pie",
      data: {
        labels: data.revenue.byPaymentMethod.map(p => p.methodLabel),
        datasets: [{
          data: data.revenue.byPaymentMethod.map(p => p.total),
          backgroundColor: ["#3b5f43", "#10b981", "#f59e0b", "#8b5cf6"]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (context) => {
                const label = context.label || "";
                const value = formatCurrency(context.parsed);
                const percent = data.revenue.byPaymentMethod[context.dataIndex].percentage;
                return `${label}: ${value} (${percent}%)`;
              }
            }
          }
        }
      }
    });

    // Chart: Daily revenue and payouts (line)
    const dailyCtx = document.getElementById("chart-revenue-daily");
    if (charts.revenueDaily) charts.revenueDaily.destroy();
    
    // Merge revenue and payouts by date
    const revenueMap = new Map(data.revenue.daily.map(r => [r._id, r.total]));
    const payoutMap = new Map(data.payouts.daily.map(p => [p._id, p.total]));
    const allDates = [...new Set([...revenueMap.keys(), ...payoutMap.keys()])].sort();
    
    charts.revenueDaily = new Chart(dailyCtx, {
      type: "line",
      data: {
        labels: allDates,
        datasets: [
          {
            label: "Doanh thu",
            data: allDates.map(d => revenueMap.get(d) || 0),
            borderColor: "#10b981",
            backgroundColor: "rgba(16, 185, 129, 0.1)",
            fill: true
          },
          {
            label: "Trả lương",
            data: allDates.map(d => payoutMap.get(d) || 0),
            borderColor: "#ef4444",
            backgroundColor: "rgba(239, 68, 68, 0.1)",
            fill: true
          }
        ]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" },
          tooltip: {
            callbacks: {
              label: (context) => {
                return `${context.dataset.label}: ${formatCurrency(context.parsed.y)}`;
              }
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => formatCurrency(value)
            }
          }
        }
      }
    });

    // Chart: Revenue overview (bar)
    const overviewCtx = document.getElementById("chart-revenue-overview");
    if (charts.revenueOverview) charts.revenueOverview.destroy();
    charts.revenueOverview = new Chart(overviewCtx, {
      type: "bar",
      data: {
        labels: ["Doanh thu", "Trả lương", "Chưa trả", "Lợi nhuận"],
        datasets: [{
          label: "Số tiền (VNĐ)",
          data: [
            data.revenue.total,
            data.payouts.total,
            data.pendingEarnings.total,
            data.netProfit.total
          ],
          backgroundColor: ["#10b981", "#ef4444", "#f59e0b", "#3b5f43"]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => formatCurrency(context.parsed.y)
            }
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              callback: (value) => formatCurrency(value)
            }
          }
        }
      }
    });
  } catch (err) {
    console.error("Load revenue statistics error:", err);
  }
}

async function loadPromotionStatistics() {
  try {
    const period = getPeriod();
    const res = await fetch(`${API_BASE}/promotions/statistics?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401) {
      localStorage.removeItem("token");
      alert("Phiên đăng nhập hết hạn");
      window.location.href = "../auth/login-signup.html";
      return;
    }

    const data = await res.json();
    if (!data.success) return;

    // Update cards
    document.getElementById("promo-discount-total").textContent = formatNumber(data.discounts.total);
    document.getElementById("promo-discount-active").textContent = `Đang hoạt động: ${data.discounts.active}`;
    document.getElementById("promo-voucher-total").textContent = formatNumber(data.vouchers.total);
    document.getElementById("promo-voucher-active").textContent = `Đang hoạt động: ${data.vouchers.active}`;
    document.getElementById("promo-discount-usage").textContent = data.usage.discountUsageRate + "%";
    document.getElementById("promo-total-discount-amount").textContent = formatCurrency(data.usage.totalDiscountAmount);

    // Chart: Top discounts (bar)
    const discountUsageCtx = document.getElementById("chart-promo-discount-usage");
    if (charts.promoDiscountUsage) charts.promoDiscountUsage.destroy();
    charts.promoDiscountUsage = new Chart(discountUsageCtx, {
      type: "bar",
      data: {
        labels: data.discounts.topUsed.map(d => d.code),
        datasets: [{
          label: "Số lần sử dụng",
          data: data.discounts.topUsed.map(d => d.usageCount),
          backgroundColor: "#3b5f43"
        }]
      },
      options: {
        responsive: true,
        indexAxis: "y",
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { beginAtZero: true }
        }
      }
    });

    // Chart: Top vouchers (bar)
    const voucherUsageCtx = document.getElementById("chart-promo-voucher-usage");
    if (charts.promoVoucherUsage) charts.promoVoucherUsage.destroy();
    charts.promoVoucherUsage = new Chart(voucherUsageCtx, {
      type: "bar",
      data: {
        labels: data.vouchers.topUsed.map(v => v.code),
        datasets: [{
          label: "Số lần sử dụng",
          data: data.vouchers.topUsed.map(v => v.usageCount),
          backgroundColor: "#10b981"
        }]
      },
      options: {
        responsive: true,
        indexAxis: "y",
        plugins: {
          legend: { display: false }
        },
        scales: {
          x: { beginAtZero: true }
        }
      }
    });

    // Chart: Discount status (pie)
    const discountStatusCtx = document.getElementById("chart-promo-discount-status");
    if (charts.promoDiscountStatus) charts.promoDiscountStatus.destroy();
    charts.promoDiscountStatus = new Chart(discountStatusCtx, {
      type: "pie",
      data: {
        labels: data.discounts.statusDistribution.map(s => {
          const statusMap = { upcoming: "Sắp diễn ra", ongoing: "Đang diễn ra", finished: "Đã kết thúc" };
          return statusMap[s.status] || s.status;
        }),
        datasets: [{
          data: data.discounts.statusDistribution.map(s => s.count),
          backgroundColor: ["#f59e0b", "#10b981", "#6b7280"]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" }
        }
      }
    });

    // Chart: Voucher status (pie)
    const voucherStatusCtx = document.getElementById("chart-promo-voucher-status");
    if (charts.promoVoucherStatus) charts.promoVoucherStatus.destroy();
    charts.promoVoucherStatus = new Chart(voucherStatusCtx, {
      type: "pie",
      data: {
        labels: data.vouchers.statusDistribution.map(s => {
          const statusMap = { upcoming: "Sắp diễn ra", ongoing: "Đang diễn ra", finished: "Đã kết thúc" };
          return statusMap[s.status] || s.status;
        }),
        datasets: [{
          data: data.vouchers.statusDistribution.map(s => s.count),
          backgroundColor: ["#f59e0b", "#10b981", "#6b7280"]
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: { position: "bottom" }
        }
      }
    });
  } catch (err) {
    console.error("Load promotion statistics error:", err);
  }
}

window.loadTabData = function(tabName) {
  switch(tabName) {
    case "orders":
      loadOrderStatistics();
      break;
    case "services":
      loadServiceStatistics();
      break;
    case "revenue":
      loadRevenueStatistics();
      break;
    case "users":
      loadUserStatistics();
      break;
    case "promotions":
      loadPromotionStatistics();
      break;
  }
};

async function exportReportPDF() {
  try {
    const period = getPeriod();
    const periodLabel = period === "7days" ? "7 ngày qua" : period === "year" ? "Năm nay" : "Tháng này";
    
    if (!confirm(`Bạn có muốn xuất báo cáo PDF cho kỳ "${periodLabel}"?`)) {
      return;
    }

    // Show loading
    const btn = document.getElementById("btn-export-pdf");
    const originalText = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = '<span class="material-symbols-outlined text-sm animate-spin">sync</span> Đang tạo PDF...';

    const res = await fetch(`${API_BASE}/export-full-pdf?period=${period}`, {
      headers: { Authorization: `Bearer ${token}` }
    });

    if (res.status === 401) {
      localStorage.removeItem("token");
      alert("Phiên đăng nhập hết hạn");
      window.location.href = "../auth/login-signup.html";
      return;
    }

    if (!res.ok) {
      throw new Error("Không thể tạo PDF");
    }

    // Download PDF
    const blob = await res.blob();
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `bao-cao-thong-ke-${period}-${Date.now()}.pdf`;
    document.body.appendChild(a);
    a.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(a);

    alert("Xuất PDF thành công!");
  } catch (err) {
    console.error("Export PDF error:", err);
    alert("Không thể xuất PDF. Vui lòng thử lại.");
  } finally {
    const btn = document.getElementById("btn-export-pdf");
    btn.disabled = false;
    btn.innerHTML = '<span class="material-symbols-outlined text-sm">picture_as_pdf</span> Xuất PDF';
  }
}

document.addEventListener("DOMContentLoaded", () => {
  // Load initial tab
  loadOrderStatistics();

  // Period change
  document.getElementById("period-select")?.addEventListener("change", () => {
    const activeTab = document.querySelector(".tab-content.active");
    if (activeTab) {
      const tabId = activeTab.id.replace("tab-", "");
      loadTabData(tabId);
    }
  });

  // Refresh button
  document.getElementById("btn-refresh")?.addEventListener("click", () => {
    const activeTab = document.querySelector(".tab-content.active");
    if (activeTab) {
      const tabId = activeTab.id.replace("tab-", "");
      loadTabData(tabId);
    }
  });

  // Export PDF button
  document.getElementById("btn-export-pdf")?.addEventListener("click", exportReportPDF);
});
