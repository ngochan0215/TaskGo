import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { isAdmin } from "../middleware/verifyRole.js"
import { createDiscount, getAllDiscounts, getDiscountById, updateDiscount, deleteDiscount,
    createVoucher, getAllVouchers, getVoucherById, updateVoucher, deleteVoucher
 } from "../controllers/discount.controller.js";
const router = express.Router();

// DISCOUNT
router.post("/", verifyToken, isAdmin, createDiscount);
router.get("/all", verifyToken, getAllDiscounts);
router.get("/:id", verifyToken, getDiscountById);
router.put("/:id", verifyToken, isAdmin, updateDiscount);
router.delete("/:id", verifyToken, isAdmin, deleteDiscount);

// VOUCHER
router.post("/voucher", verifyToken, isAdmin, createVoucher);
router.get("/voucher/all", verifyToken, getAllVouchers);
router.get("/voucher/:id", verifyToken, getVoucherById);
router.put("/voucher/:id", verifyToken, isAdmin, updateVoucher);
router.delete("/voucher/:id", verifyToken, isAdmin, deleteVoucher);

export default router;