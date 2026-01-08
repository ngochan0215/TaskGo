import express from "express";
import {createPaymentLink, initiatePayout, getLinkDetail, getPaymentTransactionDetail, updateSuccessfulTransaction, updateFailedTransaction, payoutStatusDetail, payoutStatusDetailList} from "../controllers/payment.controller.js";

const router = express.Router();
router.post("/paymentLink/:userId", createPaymentLink); //API tạo link thanh toán
router.post("/payout/:userId", initiatePayout); //API tạo payout chuyển tiền cho tasker
router.get("/paymentLink/:paymentId", getLinkDetail); //API lấy chi tiết link thanh toán

router.get("/payout", payoutStatusDetailList); //danh sách chi tiết payout chuyển tiền cho tasker
router.get("/payout/:referenceId", payoutStatusDetail); //chi tiết payout chuyển tiền cho tasker

router.get("/:orderId", getPaymentTransactionDetail);   
router.patch("/:orderId/success", updateSuccessfulTransaction); 
router.patch("/:orderId/failed", updateFailedTransaction);

export default router;