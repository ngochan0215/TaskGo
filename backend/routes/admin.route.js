import express from "express";
import { isAdmin } from "../middleware/verifyRole.js";
import { verifyToken } from "../middleware/verifyToken.js";
import { banCustomer, getAllCustomers, unbanCustomer, updateTaskerProfile } from "../controllers/admin.controller.js";

const router = express.Router();

// manage employess and customers
router.patch("/taskers/update/:taskerId", verifyToken, isAdmin, updateTaskerProfile);
router.get("/customers/all", verifyToken, isAdmin, getAllCustomers);

router.post("/customers/:customerId/ban", verifyToken, isAdmin, banCustomer);
router.post("/customers/:customerId/unban", verifyToken, isAdmin, unbanCustomer);

export default router;