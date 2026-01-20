import express from "express";
import {
  getCounts,
  getOrderStats,
  getRevenue,
  getActiveTaskers,
  getOrderStatusStats,
  exportReportPdf,
} from "../controllers/report.controller.js";
import { isAdmin } from "../middleware/verifyRole.js";

const router = express.Router();

// Tổng số user, tasker, customer
router.get("/counts", isAdmin, getCounts);

// Tổng số đơn hàng, đơn hoàn thành, đơn bị hủy
router.get("/orders", isAdmin, getOrderStats);

// Doanh thu theo ngày/tháng/năm
router.get("/revenue", isAdmin, getRevenue);

// Số lượng tasker hoạt động
router.get("/active-taskers", isAdmin, getActiveTaskers);

// Thống kê số lượng đơn theo trạng thái
router.get("/order-status", isAdmin, getOrderStatusStats);

// Xuất báo cáo tổng hợp ra file PDF
router.get("/export-pdf", isAdmin, exportReportPdf);

export default router;
