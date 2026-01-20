// routes/report.route.js
const express = require("express");
const router = express.Router();
const reportController = require("../controllers/report.controller");
const { isAdmin } = require("../middleware/verifyRole");

// Tổng số user, tasker, customer
router.get("/counts", isAdmin, reportController.getCounts);

// Tổng số đơn hàng, đơn hoàn thành, đơn bị hủy
router.get("/orders", isAdmin, reportController.getOrderStats);

// Doanh thu theo ngày/tháng/năm
router.get("/revenue", isAdmin, reportController.getRevenue);

// Số lượng tasker hoạt động
router.get("/active-taskers", isAdmin, reportController.getActiveTaskers);

// Thống kê số lượng đơn theo trạng thái
router.get("/order-status", isAdmin, reportController.getOrderStatusStats);

// Xuất báo cáo tổng hợp ra file PDF
router.get("/export-pdf", isAdmin, reportController.exportReportPdf);
module.exports = router;
