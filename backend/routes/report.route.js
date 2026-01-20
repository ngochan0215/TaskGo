import express from "express";
import {
  getDashboard,
  getCounts,
  getOrderStats,
  getRevenue,
  getActiveTaskers,
  getOrderStatusStats,
  exportReportPdf,
} from "../controllers/report.controller.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { isAdmin } from "../middleware/verifyRole.js";

const router = express.Router();

// Dashboard tổng hợp cho admin home: ?period=month|7days
router.get("/dashboard", verifyToken, isAdmin, getDashboard);

// Tổng số tasker, customer
router.get("/counts", verifyToken, isAdmin, getCounts);

// Tổng số đơn, đơn hoàn thành, đơn hủy
router.get("/orders", verifyToken, isAdmin, getOrderStats);

// Doanh thu theo ngày/tháng/năm: ?type=day|month|year
router.get("/revenue", verifyToken, isAdmin, getRevenue);

// Số tasker hoạt động (status=working)
router.get("/active-taskers", verifyToken, isAdmin, getActiveTaskers);

// Thống kê đơn theo trạng thái
router.get("/order-status", verifyToken, isAdmin, getOrderStatusStats);

// Xuất báo cáo PDF
router.get("/export-pdf", verifyToken, isAdmin, exportReportPdf);

export default router;
