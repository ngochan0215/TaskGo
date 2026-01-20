const { Op } = require("sequelize");
const db = require("../models");
const PDFDocument = require("pdfkit");
const fs = require("fs");

// Tổng số user, tasker, customer
async function getCounts(req, res) {
  try {
    const [userCount, taskerCount, customerCount] = await Promise.all([
      db.users.count(),
      db.taskers.count(),
      db.customers.count(),
    ]);
    res.json({ userCount, taskerCount, customerCount });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Tổng số đơn hàng, đơn hoàn thành, đơn bị hủy
async function getOrderStats(req, res) {
  try {
    const totalOrders = await db.orders.count();
    const completedOrders = await db.orders.count({
      where: { status: "completed" },
    });
    const cancelledOrders = await db.orders.count({
      where: { status: "cancelled" },
    });
    res.json({ totalOrders, completedOrders, cancelledOrders });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Doanh thu theo ngày/tháng/năm
async function getRevenue(req, res) {
  try {
    const { type = "day" } = req.query; // type: day, month, year
    let groupBy;
    if (type === "month")
      groupBy = db.sequelize.fn(
        "DATE_FORMAT",
        db.sequelize.col("createdAt"),
        "%Y-%m",
      );
    else if (type === "year")
      groupBy = db.sequelize.fn("YEAR", db.sequelize.col("createdAt"));
    else groupBy = db.sequelize.fn("DATE", db.sequelize.col("createdAt"));
    const revenue = await db.orders.findAll({
      attributes: [
        [groupBy, "period"],
        [db.sequelize.fn("SUM", db.sequelize.col("total")), "totalRevenue"],
      ],
      where: { status: "completed" },
      group: ["period"],
      order: [[db.sequelize.literal("period"), "DESC"]],
      raw: true,
    });
    res.json(revenue);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Số lượng tasker hoạt động
async function getActiveTaskers(req, res) {
  try {
    const activeTaskers = await db.taskers.count({
      where: { status: "active" },
    });
    res.json({ activeTaskers });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Thống kê số lượng đơn theo trạng thái
async function getOrderStatusStats(req, res) {
  try {
    const stats = await db.orders.findAll({
      attributes: [
        "status",
        [db.sequelize.fn("COUNT", db.sequelize.col("id")), "count"],
      ],
      group: ["status"],
      raw: true,
    });
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

// Xuất báo cáo tổng hợp ra file PDF
async function exportReportPdf(req, res) {
  try {
    // Lấy dữ liệu tổng hợp
    const [userCount, taskerCount, customerCount] = await Promise.all([
      db.users.count(),
      db.taskers.count(),
      db.customers.count(),
    ]);
    const totalOrders = await db.orders.count();
    const completedOrders = await db.orders.count({
      where: { status: "completed" },
    });
    const cancelledOrders = await db.orders.count({
      where: { status: "cancelled" },
    });
    const activeTaskers = await db.taskers.count({
      where: { status: "active" },
    });
    const orderStatusStats = await db.orders.findAll({
      attributes: [
        "status",
        [db.sequelize.fn("COUNT", db.sequelize.col("id")), "count"],
      ],
      group: ["status"],
      raw: true,
    });

    // Tạo PDF
    const doc = new PDFDocument();
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", "attachment; filename=report.pdf");
    doc.pipe(res);

    doc.fontSize(20).text("Báo cáo tổng hợp hệ thống", { align: "center" });
    doc.moveDown();
    doc.fontSize(14).text(`Tổng số người dùng: ${userCount}`);
    doc.text(`Tổng số tasker: ${taskerCount}`);
    doc.text(`Tổng số khách hàng: ${customerCount}`);
    doc.moveDown();
    doc.text(`Tổng số đơn hàng: ${totalOrders}`);
    doc.text(`Đơn hoàn thành: ${completedOrders}`);
    doc.text(`Đơn bị hủy: ${cancelledOrders}`);
    doc.moveDown();
    doc.text(`Số lượng tasker hoạt động: ${activeTaskers}`);
    doc.moveDown();
    doc.text("Thống kê đơn theo trạng thái:");
    orderStatusStats.forEach((stat) => {
      doc.text(`- ${stat.status}: ${stat.count}`);
    });

    doc.end();
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
}

module.exports = {
  getCounts,
  getOrderStats,
  getRevenue,
  getActiveTaskers,
  getOrderStatusStats,
  exportReportPdf,
};
