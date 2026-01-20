import express from "express";
import {
  getDashboard,
  getCounts,
  getOrderStats,
  getRevenue,
  getActiveTaskers,
  getOrderStatusStats,
  exportReportPdf,
  getOrderStatistics,
  getServiceStatistics,
  getUserStatistics,
  getReviewStatistics,
  getPromotionStatistics,
  getRevenueStatistics,
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

// Thống kê đơn hàng chi tiết: ?period=7days|month|year
router.get("/orders/statistics", verifyToken, isAdmin, getOrderStatistics);

// Thống kê dịch vụ: ?limit=10
router.get("/services/statistics", verifyToken, isAdmin, getServiceStatistics);

// Thống kê người dùng: ?period=7days|month|year
router.get("/users/statistics", verifyToken, isAdmin, getUserStatistics);

// Thống kê đánh giá: ?period=7days|month|year
router.get("/reviews/statistics", verifyToken, isAdmin, getReviewStatistics);

// Thống kê khuyến mãi và voucher: ?period=7days|month|year
router.get("/promotions/statistics", verifyToken, isAdmin, getPromotionStatistics);

// Thống kê doanh thu chi tiết: ?period=7days|month|year
router.get("/revenue/statistics", verifyToken, isAdmin, getRevenueStatistics);

export default router;
