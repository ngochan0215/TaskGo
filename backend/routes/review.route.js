import express from "express";
import { verifyToken } from "../middleware/verifyToken.js";
import { isAdmin } from "../middleware/verifyRole.js";
import {
  getAllReviews,
  getReviewStatistics,
  getReviewById,
  updateReviewStatus,
  deleteReview,
} from "../controllers/review.controller.js";

const router = express.Router();

// Admin routes for managing reviews
router.get("/all", verifyToken, isAdmin, getAllReviews);
router.get("/statistics", verifyToken, isAdmin, getReviewStatistics);
router.get("/:reviewId", verifyToken, isAdmin, getReviewById);
router.put("/:reviewId/status", verifyToken, isAdmin, updateReviewStatus);
router.delete("/:reviewId", verifyToken, isAdmin, deleteReview);

export default router;
