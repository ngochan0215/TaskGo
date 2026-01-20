import Order from "../models/orders.js";
import Receipt from "../models/receipts.js";
import Customer from "../models/customers.js";
import Tasker from "../models/taskers.js";
import Review from "../models/reviews.js";
import Service from "../models/services.js";
import Task from "../models/tasks.js";
import Discount from "../models/discounts.js";
import Voucher from "../models/vouchers.js";
import TaskerEarning from "../models/earningTasker.js";
import PayoutTasker from "../models/payoutTasker.js";
import PDFDocument from "pdfkit";

const WEEKDAY_LABELS = ["CN", "T2", "T3", "T4", "T5", "T6", "T7"];

function getPeriodRange(period) {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  if (period === "7days") {
    const currentStart = new Date(todayStart);
    currentStart.setDate(currentStart.getDate() - 6);
    currentStart.setHours(0, 0, 0, 0);
    const currentEnd = new Date(todayStart);
    currentEnd.setDate(currentEnd.getDate() + 1);
    currentEnd.setHours(0, 0, 0, 0);
    const previousEnd = currentStart;
    const previousStart = new Date(previousEnd);
    previousStart.setDate(previousStart.getDate() - 7);
    return {
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
    };
  }

  if (period === "year") {
    const currentStart = new Date(now.getFullYear(), 0, 1);
    currentStart.setHours(0, 0, 0, 0);
    const currentEnd = new Date(now);
    currentEnd.setDate(currentEnd.getDate() + 1);
    currentEnd.setHours(0, 0, 0, 0);
    const previousStart = new Date(now.getFullYear() - 1, 0, 1);
    const previousEnd = currentStart;
    return {
      currentStart,
      currentEnd,
      previousStart,
      previousEnd,
    };
  }

  // month (default)
  const currentStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const currentEnd = new Date(now);
  currentEnd.setDate(currentEnd.getDate() + 1);
  currentEnd.setHours(0, 0, 0, 0);
  const previousStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
  const previousEnd = currentStart; // exclusive end: 1st of this month 00:00
  return {
    currentStart,
    currentEnd,
    previousStart,
    previousEnd,
  };
}

/**
 * Dashboard tổng hợp cho admin home
 * GET /api/report/dashboard?period=month|7days
 */
export async function getDashboard(req, res) {
  try {
    const period = (req.query.period || "month") === "7days" ? "7days" : "month";
    const { currentStart, currentEnd, previousStart, previousEnd } = getPeriodRange(period);

    // ---- 1. Revenue: từ Receipt status=success ----
    const [revCur, revPrev, revChart] = await Promise.all([
      Receipt.aggregate([
        { $match: { status: "success", created_at: { $gte: currentStart, $lt: currentEnd } } },
        { $group: { _id: null, total: { $sum: "$total_amount" } } },
      ]),
      Receipt.aggregate([
        { $match: { status: "success", created_at: { $gte: previousStart, $lt: previousEnd } } },
        { $group: { _id: null, total: { $sum: "$total_amount" } } },
      ]),
      (() => {
        const end = new Date();
        const start = new Date(end);
        start.setDate(start.getDate() - 6);
        start.setHours(0, 0, 0, 0);
        return Receipt.aggregate([
          { $match: { status: "success", created_at: { $gte: start, $lte: end } } },
          {
            $group: {
              _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
              amount: { $sum: "$total_amount" },
            },
          },
        ]);
      })(),
    ]);

    const totalRevenue = revCur[0]?.total ?? 0;
    const prevRevenue = revPrev[0]?.total ?? 0;
    const revenueChangePercent =
      prevRevenue > 0 ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) : (totalRevenue > 0 ? 100 : 0);

    // 7 ngày cho biểu đồ (điền 0 cho ngày không có dữ liệu)
    const chartMap = new Map((revChart || []).map((r) => [r._id, r.amount]));
    const revenueByWeek = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      d.setHours(0, 0, 0, 0);
      const key = d.toISOString().slice(0, 10);
      const day = d.getDay();
      revenueByWeek.push({
        date: key,
        label: WEEKDAY_LABELS[day],
        amount: chartMap.get(key) ?? 0,
      });
    }

    // ---- 2. Đơn hàng mới (trong kỳ, bỏ cancelled) ----
    const [ordersCur, ordersPrev] = await Promise.all([
      Order.countDocuments({
        created_at: { $gte: currentStart, $lt: currentEnd },
        status: { $ne: "cancelled" },
      }),
      Order.countDocuments({
        created_at: { $gte: previousStart, $lt: previousEnd },
        status: { $ne: "cancelled" },
      }),
    ]);
    const newOrders = ordersCur;
    const newOrdersChangePercent =
      ordersPrev > 0 ? Math.round(((ordersCur - ordersPrev) / ordersPrev) * 100) : (ordersCur > 0 ? 100 : 0);

    // ---- 3. Khách hàng: tổng + % thay đổi (khách mới trong kỳ vs kỳ trước) ----
    const [totalCustomers, custCur, custPrev] = await Promise.all([
      Customer.countDocuments(),
      Customer.countDocuments({ created_at: { $gte: currentStart, $lt: currentEnd } }),
      Customer.countDocuments({ created_at: { $gte: previousStart, $lt: previousEnd } }),
    ]);
    const customersChangePercent =
      custPrev > 0 ? Math.round(((custCur - custPrev) / custPrev) * 100) : (custCur > 0 ? 100 : 0);

    // ---- 4. Tasker hoạt động: status=working ----
    const activeTaskers = await Tasker.countDocuments({ status: "working" });
    const activeTaskersChangePercent = 0; // không lưu lịch sử trạng thái nên giữ 0

    // ---- 5. Top dịch vụ (nhóm theo Service qua task_id -> Task -> service_id) ----
    const topAgg = await Order.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      { $lookup: { from: "tasks", localField: "task_id", foreignField: "_id", as: "t" } },
      { $unwind: { path: "$t", preserveNullAndEmptyArrays: false } },
      { $lookup: { from: "services", localField: "t.service_id", foreignField: "_id", as: "s" } },
      { $unwind: { path: "$s", preserveNullAndEmptyArrays: false } },
      { $group: { _id: "$s._id", name: { $first: "$s.category_name" }, count: { $sum: 1 } } },
      { $sort: { count: -1 } },
      { $limit: 5 },
    ]);
    const totalOrdersForTop = topAgg.reduce((s, x) => s + x.count, 0);
    const topServices = topAgg.map((x) => ({
      name: x.name,
      percent: totalOrdersForTop > 0 ? Math.round((x.count / totalOrdersForTop) * 100) : 0,
    }));

    // ---- 6. Đơn hàng mới nhất (bỏ cancelled) ----
    const latest = await Order.find({ status: { $ne: "cancelled" } })
      .sort({ created_at: -1 })
      .limit(10)
      .populate("customer_id", "full_name")
      .select("_id task_snapshot status final_amount")
      .lean();

    const statusMap = {
      pending: "Tìm tasker",
      assigned: "Đã gán",
      accepted: "Đang thực hiện",
      departed: "Đang thực hiện",
      arrived: "Đang thực hiện",
      in_progress: "Đang thực hiện",
      awaiting_payment: "Chờ thanh toán",
      completed: "Hoàn thành",
      cancelled: "Đã hủy",
    };

    const latestOrders = (latest || []).map((o) => ({
      id: o._id.toString(),
      idDisplay: `#DH${o._id.toString().slice(-6).toUpperCase()}`,
      customerName: o.customer_id?.full_name || "N/A",
      serviceName: o.task_snapshot?.name
        ? `${o.task_snapshot.name}${o.task_snapshot.unit ? ` (${o.quantity || 1} ${o.task_snapshot.unit})` : ""}`.trim()
        : "N/A",
      status: statusMap[o.status] || o.status,
      statusKey: o.status,
      amount: o.final_amount ?? 0,
    }));

    res.json({
      success: true,
      updatedAt: new Date().toISOString(),
      period,
      totalRevenue,
      revenueChangePercent,
      newOrders,
      newOrdersChangePercent,
      totalCustomers,
      customersChangePercent,
      activeTaskers,
      activeTaskersChangePercent,
      revenueByWeek,
      topServices,
      latestOrders,
    });
  } catch (err) {
    console.error("getDashboard error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Tổng số customer, tasker (dùng Mongoose)
 */
export async function getCounts(req, res) {
  try {
    const [taskerCount, customerCount] = await Promise.all([
      Tasker.countDocuments(),
      Customer.countDocuments(),
    ]);
    res.json({ success: true, taskerCount, customerCount });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Tổng số đơn, đơn hoàn thành, đơn hủy (Mongoose)
 */
export async function getOrderStats(req, res) {
  try {
    const [totalOrders, completedOrders, cancelledOrders] = await Promise.all([
      Order.countDocuments(),
      Order.countDocuments({ status: "completed" }),
      Order.countDocuments({ status: "cancelled" }),
    ]);
    res.json({ success: true, totalOrders, completedOrders, cancelledOrders });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Doanh thu theo ngày/tháng/năm (Mongoose, từ Receipt success)
 */
export async function getRevenue(req, res) {
  try {
    const { type = "day" } = req.query;

    let groupExpr;
    if (type === "month") {
      groupExpr = { $dateToString: { format: "%Y-%m", date: "$created_at" } };
    } else if (type === "year") {
      groupExpr = { $year: "$created_at" };
    } else {
      groupExpr = { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } };
    }

    const revenue = await Receipt.aggregate([
      { $match: { status: "success" } },
      { $group: { _id: groupExpr, totalRevenue: { $sum: "$total_amount" } } },
      { $sort: { _id: -1 } },
    ]);

    res.json({ success: true, data: revenue });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Số tasker đang hoạt động: status=working (Mongoose)
 */
export async function getActiveTaskers(req, res) {
  try {
    const activeTaskers = await Tasker.countDocuments({ status: "working" });
    res.json({ success: true, activeTaskers });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Thống kê đơn theo trạng thái (Mongoose)
 */
export async function getOrderStatusStats(req, res) {
  try {
    const stats = await Order.aggregate([
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    res.json({ success: true, data: stats });
  } catch (err) {
    res.status(500).json({ success: false, error: err.message });
  }
}

/**
 * Xuất báo cáo PDF (Mongoose)
 */
export async function exportReportPdf(req, res) {
  try {
    const [taskerCount, customerCount, totalOrders, completedOrders, cancelledOrders, activeTaskers, statusStats] =
      await Promise.all([
        Tasker.countDocuments(),
        Customer.countDocuments(),
        Order.countDocuments(),
        Order.countDocuments({ status: "completed" }),
        Order.countDocuments({ status: "cancelled" }),
        Tasker.countDocuments({ status: "working" }),
        Order.aggregate([{ $group: { _id: "$status", count: { $sum: 1 } } }]),
      ]);

    const rev = await Receipt.aggregate([
      { $match: { status: "success" } },
      { $group: { _id: null, total: { $sum: "$total_amount" } } },
    ]);
    const totalRevenue = rev[0]?.total ?? 0;

    const doc = new PDFDocument();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="report.pdf"');
    doc.pipe(res);

    doc.fontSize(20).text("Báo cáo tổng hợp hệ thống", { align: "center" });
    doc.moveDown();
    doc.fontSize(12).text(`Ngày xuất: ${new Date().toLocaleString("vi-VN")}`);
    doc.moveDown();

    doc.fontSize(14).text(`Tổng số tasker: ${taskerCount}`);
    doc.text(`Tổng số khách hàng: ${customerCount}`);
    doc.text(`Tasker hoạt động: ${activeTaskers}`);
    doc.moveDown();

    doc.text(`Tổng số đơn hàng: ${totalOrders}`);
    doc.text(`Đơn hoàn thành: ${completedOrders}`);
    doc.text(`Đơn hủy: ${cancelledOrders}`);
    doc.text(`Tổng doanh thu (đã thanh toán): ${Number(totalRevenue).toLocaleString("vi-VN")} VNĐ`);
    doc.moveDown();

    doc.text("Thống kê đơn theo trạng thái:");
    (statusStats || []).forEach((s) => {
      doc.text(`  - ${s._id}: ${s.count}`);
    });

    doc.end();
  } catch (err) {
    console.error("exportReportPdf error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Thống kê đơn hàng chi tiết: tỉ lệ thành công, hủy, theo trạng thái, theo thời gian
 * GET /api/report/orders/statistics?period=7days|month|year
 */
export async function getOrderStatistics(req, res) {
  try {
    const period = req.query.period || "month";
    const { currentStart, currentEnd } = getPeriodRange(period);

    // Tổng số đơn trong kỳ
    const totalOrders = await Order.countDocuments({
      created_at: { $gte: currentStart, $lt: currentEnd }
    });

    // Đơn theo trạng thái
    const statusStats = await Order.aggregate([
      { $match: { created_at: { $gte: currentStart, $lt: currentEnd } } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
      { $sort: { count: -1 } }
    ]);

    // Tỉ lệ thành công và hủy
    const completed = statusStats.find(s => s._id === "completed")?.count || 0;
    const cancelled = statusStats.find(s => s._id === "cancelled")?.count || 0;
    const successRate = totalOrders > 0 ? Math.round((completed / totalOrders) * 100) : 0;
    const cancelRate = totalOrders > 0 ? Math.round((cancelled / totalOrders) * 100) : 0;

    // Đơn theo ngày trong kỳ
    const dailyOrders = await Order.aggregate([
      { $match: { created_at: { $gte: currentStart, $lt: currentEnd } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
          count: { $sum: 1 },
          completed: { $sum: { $cond: [{ $eq: ["$status", "completed"] }, 1, 0] } },
          cancelled: { $sum: { $cond: [{ $eq: ["$status", "cancelled"] }, 1, 0] } }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Doanh thu theo trạng thái
    const revenueByStatus = await Order.aggregate([
      { $match: { created_at: { $gte: currentStart, $lt: currentEnd }, status: { $ne: "cancelled" } } },
      { $group: { _id: "$status", total: { $sum: "$final_amount" } } },
      { $sort: { total: -1 } }
    ]);

    res.json({
      success: true,
      period,
      totalOrders,
      successRate,
      cancelRate,
      completed,
      cancelled,
      statusStats: statusStats.map(s => ({
        status: s._id,
        count: s.count,
        percentage: totalOrders > 0 ? Math.round((s.count / totalOrders) * 100) : 0
      })),
      dailyOrders,
      revenueByStatus
    });
  } catch (err) {
    console.error("getOrderStatistics error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Thống kê dịch vụ: top dịch vụ, doanh thu theo dịch vụ, số đơn theo dịch vụ
 * GET /api/report/services/statistics?limit=10
 */
export async function getServiceStatistics(req, res) {
  try {
    const limit = parseInt(req.query.limit) || 10;

    // Top dịch vụ theo số đơn
    const topByOrders = await Order.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      { $lookup: { from: "tasks", localField: "task_id", foreignField: "_id", as: "task" } },
      { $unwind: { path: "$task", preserveNullAndEmptyArrays: false } },
      { $lookup: { from: "services", localField: "task.service_id", foreignField: "_id", as: "service" } },
      { $unwind: { path: "$service", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: "$service._id",
          serviceName: { $first: "$service.category_name" },
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: "$final_amount" }
        }
      },
      { $sort: { orderCount: -1 } },
      { $limit: limit }
    ]);

    // Top dịch vụ theo doanh thu
    const topByRevenue = await Order.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      { $lookup: { from: "tasks", localField: "task_id", foreignField: "_id", as: "task" } },
      { $unwind: { path: "$task", preserveNullAndEmptyArrays: false } },
      { $lookup: { from: "services", localField: "task.service_id", foreignField: "_id", as: "service" } },
      { $unwind: { path: "$service", preserveNullAndEmptyArrays: false } },
      {
        $group: {
          _id: "$service._id",
          serviceName: { $first: "$service.category_name" },
          orderCount: { $sum: 1 },
          totalRevenue: { $sum: "$final_amount" }
        }
      },
      { $sort: { totalRevenue: -1 } },
      { $limit: limit }
    ]);

    // Tổng số đơn và doanh thu để tính phần trăm
    const totalStats = await Order.aggregate([
      { $match: { status: { $ne: "cancelled" } } },
      {
        $group: {
          _id: null,
          totalOrders: { $sum: 1 },
          totalRevenue: { $sum: "$final_amount" }
        }
      }
    ]);
    const totals = totalStats[0] || { totalOrders: 0, totalRevenue: 0 };

    // Phân bố dịch vụ theo số đơn (cho biểu đồ tròn)
    const serviceDistribution = topByOrders.map(s => ({
      name: s.serviceName,
      count: s.orderCount,
      percentage: totals.totalOrders > 0 ? Math.round((s.orderCount / totals.totalOrders) * 100) : 0
    }));

    res.json({
      success: true,
      topByOrders: topByOrders.map(s => ({
        id: s._id.toString(),
        name: s.serviceName,
        orderCount: s.orderCount,
        revenue: s.totalRevenue,
        orderPercentage: totals.totalOrders > 0 ? Math.round((s.orderCount / totals.totalOrders) * 100) : 0
      })),
      topByRevenue: topByRevenue.map(s => ({
        id: s._id.toString(),
        name: s.serviceName,
        orderCount: s.orderCount,
        revenue: s.totalRevenue,
        revenuePercentage: totals.totalRevenue > 0 ? Math.round((s.totalRevenue / totals.totalRevenue) * 100) : 0
      })),
      serviceDistribution,
      totals: {
        totalOrders: totals.totalOrders,
        totalRevenue: totals.totalRevenue
      }
    });
  } catch (err) {
    console.error("getServiceStatistics error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Thống kê người dùng: số lượng customer/tasker, phân bố theo tier, tăng trưởng
 * GET /api/report/users/statistics?period=7days|month|year
 */
export async function getUserStatistics(req, res) {
  try {
    const period = req.query.period || "month";
    const { currentStart, currentEnd, previousStart, previousEnd } = getPeriodRange(period);

    // Tổng số customer và tasker
    const [totalCustomers, totalTaskers] = await Promise.all([
      Customer.countDocuments(),
      Tasker.countDocuments()
    ]);

    // Customer mới trong kỳ
    const newCustomers = await Customer.countDocuments({
      created_at: { $gte: currentStart, $lt: currentEnd }
    });
    const prevCustomers = await Customer.countDocuments({
      created_at: { $gte: previousStart, $lt: previousEnd }
    });
    const customerGrowth = prevCustomers > 0 
      ? Math.round(((newCustomers - prevCustomers) / prevCustomers) * 100) 
      : (newCustomers > 0 ? 100 : 0);

    // Tasker mới trong kỳ
    const newTaskers = await Tasker.countDocuments({
      created_at: { $gte: currentStart, $lt: currentEnd }
    });
    const prevTaskers = await Tasker.countDocuments({
      created_at: { $gte: previousStart, $lt: previousEnd }
    });
    const taskerGrowth = prevTaskers > 0 
      ? Math.round(((newTaskers - prevTaskers) / prevTaskers) * 100) 
      : (newTaskers > 0 ? 100 : 0);

    // Phân bố customer theo tier
    const customerTiers = await Customer.aggregate([
      {
        $group: {
          _id: "$type",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Phân bố tasker theo status
    const taskerStatus = await Tasker.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } }
    ]);

    // Customer tăng trưởng theo ngày
    const customerGrowthDaily = await Customer.aggregate([
      { $match: { created_at: { $gte: currentStart, $lt: currentEnd } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Tasker tăng trưởng theo ngày
    const taskerGrowthDaily = await Tasker.aggregate([
      { $match: { created_at: { $gte: currentStart, $lt: currentEnd } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    res.json({
      success: true,
      period,
      totalCustomers,
      totalTaskers,
      newCustomers,
      customerGrowth,
      newTaskers,
      taskerGrowth,
      customerTiers: customerTiers.map(t => ({
        tier: t._id || "unknown",
        count: t.count,
        percentage: totalCustomers > 0 ? Math.round((t.count / totalCustomers) * 100) : 0
      })),
      taskerStatus: taskerStatus.map(s => ({
        status: s._id || "unknown",
        count: s.count,
        percentage: totalTaskers > 0 ? Math.round((s.count / totalTaskers) * 100) : 0
      })),
      customerGrowthDaily,
      taskerGrowthDaily
    });
  } catch (err) {
    console.error("getUserStatistics error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Thống kê đánh giá: phân bố rating, số lượng review theo thời gian
 * GET /api/report/reviews/statistics?period=7days|month|year
 */
export async function getReviewStatistics(req, res) {
  try {
    const period = req.query.period || "month";
    const { currentStart, currentEnd } = getPeriodRange(period);

    // Tổng số review
    const totalReviews = await Review.countDocuments({
      status: "visible",
      created_at: { $gte: currentStart, $lt: currentEnd }
    });

    // Phân bố theo rating (1-5 sao)
    const ratingDistribution = await Review.aggregate([
      { $match: { status: "visible", created_at: { $gte: currentStart, $lt: currentEnd } } },
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Điểm trung bình
    const avgRating = await Review.aggregate([
      { $match: { status: "visible", created_at: { $gte: currentStart, $lt: currentEnd } } },
      {
        $group: {
          _id: null,
          average: { $avg: "$rating" },
          count: { $sum: 1 }
        }
      }
    ]);
    const averageRating = avgRating[0]?.average || 0;

    // Review theo ngày
    const dailyReviews = await Review.aggregate([
      { $match: { status: "visible", created_at: { $gte: currentStart, $lt: currentEnd } } },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
          count: { $sum: 1 },
          avgRating: { $avg: "$rating" }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // Review theo role (customer review tasker vs tasker review customer)
    const reviewByRole = await Review.aggregate([
      { $match: { status: "visible", created_at: { $gte: currentStart, $lt: currentEnd } } },
      {
        $group: {
          _id: "$reviewee_role",
          count: { $sum: 1 },
          avgRating: { $avg: "$rating" }
        }
      }
    ]);

    // Điền đầy đủ rating từ 1-5
    const ratingMap = new Map(ratingDistribution.map(r => [r._id, r.count]));
    const fullRatingDistribution = [];
    for (let i = 1; i <= 5; i++) {
      fullRatingDistribution.push({
        rating: i,
        count: ratingMap.get(i) || 0,
        percentage: totalReviews > 0 ? Math.round(((ratingMap.get(i) || 0) / totalReviews) * 100) : 0
      });
    }

    res.json({
      success: true,
      period,
      totalReviews,
      averageRating: Math.round(averageRating * 10) / 10,
      ratingDistribution: fullRatingDistribution,
      dailyReviews,
      reviewByRole: reviewByRole.map(r => ({
        role: r._id,
        count: r.count,
        avgRating: Math.round(r.avgRating * 10) / 10
      }))
    });
  } catch (err) {
    console.error("getReviewStatistics error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Thống kê khuyến mãi và voucher: số lượng, tỉ lệ sử dụng, hiệu quả
 * GET /api/report/promotions/statistics?period=7days|month|year
 */
export async function getPromotionStatistics(req, res) {
  try {
    const period = req.query.period || "month";
    const { currentStart, currentEnd } = getPeriodRange(period);

    // === DISCOUNT STATISTICS ===
    // Tổng số discount
    const totalDiscounts = await Discount.countDocuments();
    const activeDiscounts = await Discount.countDocuments({
      is_active: true,
      begin_date: { $lte: new Date() },
      end_date: { $gte: new Date() }
    });

    // Discount được sử dụng trong kỳ
    const discountUsage = await Order.aggregate([
      {
        $match: {
          discount_id: { $ne: null },
          created_at: { $gte: currentStart, $lt: currentEnd }
        }
      },
      {
        $group: {
          _id: "$discount_id",
          usageCount: { $sum: 1 },
          totalDiscountAmount: { $sum: { $subtract: ["$base_amount", "$final_amount"] } }
        }
      },
      { $sort: { usageCount: -1 } },
      { $limit: 10 }
    ]);

    // Lấy thông tin discount
    const discountIds = discountUsage.map(d => d._id);
    const discounts = await Discount.find({ _id: { $in: discountIds } }).lean();
    const discountMap = new Map(discounts.map(d => [d._id.toString(), d]));

    const topDiscounts = discountUsage.map(usage => {
      const discount = discountMap.get(usage._id.toString());
      return {
        id: usage._id.toString(),
        code: discount?.code || "N/A",
        name: discount?.name || "N/A",
        usageCount: usage.usageCount,
        totalDiscountAmount: usage.totalDiscountAmount
      };
    });

    // Phân bố discount theo status
    const discountStatus = await Discount.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // === VOUCHER STATISTICS ===
    // Tổng số voucher
    const totalVouchers = await Voucher.countDocuments();
    const activeVouchers = await Voucher.countDocuments({
      is_active: true,
      begin_date: { $lte: new Date() },
      end_date: { $gte: new Date() }
    });

    // Voucher được sử dụng trong kỳ
    const voucherUsage = await Order.aggregate([
      {
        $match: {
          voucher_id: { $ne: null },
          created_at: { $gte: currentStart, $lt: currentEnd }
        }
      },
      {
        $group: {
          _id: "$voucher_id",
          usageCount: { $sum: 1 },
          totalDiscountAmount: { $sum: { $subtract: ["$base_amount", "$final_amount"] } }
        }
      },
      { $sort: { usageCount: -1 } },
      { $limit: 10 }
    ]);

    // Lấy thông tin voucher
    const voucherIds = voucherUsage.map(v => v._id);
    const vouchers = await Voucher.find({ _id: { $in: voucherIds } }).lean();
    const voucherMap = new Map(vouchers.map(v => [v._id.toString(), v]));

    const topVouchers = voucherUsage.map(usage => {
      const voucher = voucherMap.get(usage._id.toString());
      return {
        id: usage._id.toString(),
        code: voucher?.code || "N/A",
        name: voucher?.name || "N/A",
        usageCount: usage.usageCount,
        totalDiscountAmount: usage.totalDiscountAmount,
        totalQuantity: voucher?.total_quantity || 0,
        usedQuantity: voucher?.used_quantity || 0
      };
    });

    // Phân bố voucher theo status
    const voucherStatus = await Voucher.aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      }
    ]);

    // Tổng số đơn sử dụng discount/voucher trong kỳ
    const ordersWithDiscount = await Order.countDocuments({
      discount_id: { $ne: null },
      created_at: { $gte: currentStart, $lt: currentEnd }
    });
    const ordersWithVoucher = await Order.countDocuments({
      voucher_id: { $ne: null },
      created_at: { $gte: currentStart, $lt: currentEnd }
    });
    const totalOrdersInPeriod = await Order.countDocuments({
      created_at: { $gte: currentStart, $lt: currentEnd }
    });

    // Tổng tiền giảm giá
    const totalDiscountAmount = await Order.aggregate([
      {
        $match: {
          $or: [
            { discount_id: { $ne: null } },
            { voucher_id: { $ne: null } }
          ],
          created_at: { $gte: currentStart, $lt: currentEnd }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: { $subtract: ["$base_amount", "$final_amount"] } }
        }
      }
    ]);

    res.json({
      success: true,
      period,
      discounts: {
        total: totalDiscounts,
        active: activeDiscounts,
        topUsed: topDiscounts,
        statusDistribution: discountStatus.map(s => ({
          status: s._id || "unknown",
          count: s.count
        }))
      },
      vouchers: {
        total: totalVouchers,
        active: activeVouchers,
        topUsed: topVouchers,
        statusDistribution: voucherStatus.map(s => ({
          status: s._id || "unknown",
          count: s.count
        }))
      },
      usage: {
        ordersWithDiscount,
        ordersWithVoucher,
        totalOrdersInPeriod,
        discountUsageRate: totalOrdersInPeriod > 0 
          ? Math.round((ordersWithDiscount / totalOrdersInPeriod) * 100) 
          : 0,
        voucherUsageRate: totalOrdersInPeriod > 0 
          ? Math.round((ordersWithVoucher / totalOrdersInPeriod) * 100) 
          : 0,
        totalDiscountAmount: totalDiscountAmount[0]?.total || 0
      }
    });
  } catch (err) {
    console.error("getPromotionStatistics error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}

/**
 * Thống kê doanh thu chi tiết: phương thức thanh toán, tiền vào/ra, lợi nhuận
 * GET /api/report/revenue/statistics?period=7days|month|year
 */
export async function getRevenueStatistics(req, res) {
  try {
    const period = req.query.period || "month";
    const { currentStart, currentEnd, previousStart, previousEnd } = getPeriodRange(period);

    // === REVENUE (TIỀN VÀO) ===
    // Doanh thu từ Receipt success
    const [revenueCurrent, revenuePrevious] = await Promise.all([
      Receipt.aggregate([
        {
          $match: {
            status: "success",
            created_at: { $gte: currentStart, $lt: currentEnd }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$total_amount" },
            count: { $sum: 1 }
          }
        }
      ]),
      Receipt.aggregate([
        {
          $match: {
            status: "success",
            created_at: { $gte: previousStart, $lt: previousEnd }
          }
        },
        {
          $group: {
            _id: null,
            total: { $sum: "$total_amount" }
          }
        }
      ])
    ]);

    const totalRevenue = revenueCurrent[0]?.total || 0;
    const prevRevenue = revenuePrevious[0]?.total || 0;
    const revenueChange = prevRevenue > 0 
      ? Math.round(((totalRevenue - prevRevenue) / prevRevenue) * 100) 
      : (totalRevenue > 0 ? 100 : 0);

    // Doanh thu theo phương thức thanh toán
    const revenueByPaymentMethod = await Receipt.aggregate([
      {
        $match: {
          status: "success",
          created_at: { $gte: currentStart, $lt: currentEnd }
        }
      },
      {
        $group: {
          _id: "$payment_method",
          total: { $sum: "$total_amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { total: -1 } }
    ]);

    // Doanh thu theo ngày
    const revenueDaily = await Receipt.aggregate([
      {
        $match: {
          status: "success",
          created_at: { $gte: currentStart, $lt: currentEnd }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$created_at" } },
          total: { $sum: "$total_amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // === PAYOUTS (TIỀN RA - TRẢ LƯƠNG TASKER) ===
    // Tổng tiền đã trả cho tasker trong kỳ
    const payoutsCurrent = await PayoutTasker.aggregate([
      {
        $match: {
          status: "completed",
          processed_at: { $gte: currentStart, $lt: currentEnd }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$total_amount" },
          count: { $sum: 1 }
        }
      }
    ]);

    const payoutsPrevious = await PayoutTasker.aggregate([
      {
        $match: {
          status: "completed",
          processed_at: { $gte: previousStart, $lt: previousEnd }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$total_amount" }
        }
      }
    ]);

    const totalPayouts = payoutsCurrent[0]?.total || 0;
    const prevPayouts = payoutsPrevious[0]?.total || 0;
    const payoutsChange = prevPayouts > 0 
      ? Math.round(((totalPayouts - prevPayouts) / prevPayouts) * 100) 
      : (totalPayouts > 0 ? 100 : 0);

    // Payouts theo ngày
    const payoutsDaily = await PayoutTasker.aggregate([
      {
        $match: {
          status: "completed",
          processed_at: { $gte: currentStart, $lt: currentEnd }
        }
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$processed_at" } },
          total: { $sum: "$total_amount" },
          count: { $sum: 1 }
        }
      },
      { $sort: { _id: 1 } }
    ]);

    // === EARNINGS (THU NHẬP TASKER CHƯA TRẢ) ===
    // Tổng thu nhập tasker đã kiếm được (status: available, pending) chưa được trả
    const pendingEarnings = await TaskerEarning.aggregate([
      {
        $match: {
          status: { $in: ["pending", "available"] },
          completed_at: { $gte: currentStart, $lt: currentEnd }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$earning_amount" },
          count: { $sum: 1 }
        }
      }
    ]);

    const totalPendingEarnings = pendingEarnings[0]?.total || 0;

    // === PLATFORM FEE (PHÍ NỀN TẢNG) ===
    // Tổng phí nền tảng (platform_fee) từ các đơn đã hoàn thành
    const platformFees = await TaskerEarning.aggregate([
      {
        $match: {
          status: { $in: ["available", "paid"] },
          completed_at: { $gte: currentStart, $lt: currentEnd }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$platform_fee" }
        }
      }
    ]);

    const totalPlatformFee = platformFees[0]?.total || 0;

    // === NET PROFIT (LỢI NHUẬN RÒNG) ===
    // Lợi nhuận = Doanh thu - (Payouts + Pending Earnings)
    const netProfit = totalRevenue - totalPayouts - totalPendingEarnings;

    // Payment method labels
    const paymentMethodLabels = {
      cash: "Tiền mặt",
      credit_card: "Thẻ tín dụng",
      bank_transfer: "Chuyển khoản",
      ewallet: "Ví điện tử"
    };

    res.json({
      success: true,
      period,
      revenue: {
        total: totalRevenue,
        previous: prevRevenue,
        change: revenueChange,
        byPaymentMethod: revenueByPaymentMethod.map(r => ({
          method: r._id,
          methodLabel: paymentMethodLabels[r._id] || r._id,
          total: r.total,
          count: r.count,
          percentage: totalRevenue > 0 ? Math.round((r.total / totalRevenue) * 100) : 0
        })),
        daily: revenueDaily
      },
      payouts: {
        total: totalPayouts,
        previous: prevPayouts,
        change: payoutsChange,
        count: payoutsCurrent[0]?.count || 0,
        daily: payoutsDaily
      },
      pendingEarnings: {
        total: totalPendingEarnings,
        count: pendingEarnings[0]?.count || 0
      },
      platformFee: {
        total: totalPlatformFee
      },
      netProfit: {
        total: netProfit,
        percentage: totalRevenue > 0 ? Math.round((netProfit / totalRevenue) * 100) : 0
      }
    });
  } catch (err) {
    console.error("getRevenueStatistics error:", err);
    res.status(500).json({ success: false, message: err.message });
  }
}
