import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { isAdmin } from "../middleware/verifyRole.js"
import { createDiscount, getAllDiscounts, getDiscountById, updateDiscount, deleteDiscount,
    createVoucher, getAllVouchers, getVoucherById, updateVoucher, deleteVoucher,
    getEligibleVouchers,
    unactivateDiscount,
    unactivateVoucher,
    getPreviewDiscount,
    getServicePricesWithDiscount,
    getActivePromotions,
    getPromotionDetail
 } from "../controllers/discount.controller.js";
const router = express.Router();

// hàm lấy danh sách voucher phù hợp cho khách hàng (show lúc khách chọn voucher)
router.post("/voucher/eligible-list", verifyToken, getEligibleVouchers);
// hàm hiển thị trước thông tin khuyến mãi
router.get("/preview/best", verifyToken, getPreviewDiscount);
// hàm lấy giá sau discount cho danh sách services
router.post("/services/prices", verifyToken, getServicePricesWithDiscount);
// hàm lấy danh sách discount và voucher đang hoạt động cho customer (trang chủ)
router.get("/active", verifyToken, getActivePromotions);
// hàm lấy chi tiết discount hoặc voucher (phải đặt trước /:id)
router.get("/detail/:type/:id", verifyToken, getPromotionDetail);

// DISCOUNT
router.post("/", verifyToken, isAdmin, createDiscount);
router.get("/all", verifyToken, getAllDiscounts);
router.get("/:id", verifyToken, getDiscountById);
router.patch("/:id", verifyToken, isAdmin, updateDiscount);
router.delete("/:id", verifyToken, isAdmin, deleteDiscount);
router.patch("/:id/unactivate", verifyToken, isAdmin, unactivateDiscount);

// VOUCHER
router.post("/voucher", verifyToken, isAdmin, createVoucher);
router.get("/voucher/all", verifyToken, getAllVouchers);
router.get("/voucher/:id", verifyToken, getVoucherById);
router.patch("/voucher/:id", verifyToken, isAdmin, updateVoucher);
router.delete("/voucher/:id", verifyToken, isAdmin, deleteVoucher);
router.patch("/voucher/:id/unactivate", verifyToken, isAdmin, unactivateVoucher);

export default router;