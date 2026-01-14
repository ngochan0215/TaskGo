import express from "express";
import { verifyToken } from "../middleware/verifyToken";
import { isAdmin } from "../middleware/verifyRole.js";
import { getReceiptById, createReceipt, getAllReceipts, 
    updateReceiptStatus, markReceiptPaid
} from "../controllers/receipt.controller.js";

const router = express.Router();

router.post("/receipt/add", verifyToken, createReceipt);
router.get("/receipt/:id", verifyToken, getReceiptById);
router.get("/receipt/all", verifyToken, getAllReceipts);

router.patch("/receipt/:id/status", verifyToken, isAdmin, updateReceiptStatus);
router.post("/receipt/:id/paid", verifyToken, isAdmin, markReceiptPaid);
