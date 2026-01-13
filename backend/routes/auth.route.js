import express from "express";
import {
  signUpCustomer, signUpTasker,
  verifyEmail, login, logout,
  forgotPassword, resetPassword, resendVerificationToken
} from "../controllers/auth.controller.js";

const router = express.Router();

router.post("/signup/customer", signUpCustomer);
router.post("/signup/tasker", signUpTasker);

router.post("/verify-email", verifyEmail);
router.post("/login", login);
router.post("/logout", logout);
router.post("/resend-otp", resendVerificationToken);
router.post("/forgot-password", forgotPassword);
router.post("/reset-password/:token", resetPassword);

export default router;
