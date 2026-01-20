import Order from "../models/orders.js";
import Receipt from "../models/receipts.js";
import Customer from "../models/customers.js";
import Tasker from "../models/taskers.js";
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

  // month
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
