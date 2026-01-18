import mongoose from "mongoose";
import { Order, Review } from "../models/index.js";

const EDIT_LIMIT_MINUTES = 15;

export const addReview = async (req, res) => {
  try {
    const reviewerId = req.userId;
    const { order_id, reviewee_id, reviewee_role, rating, comment } = req.body;

    if (!mongoose.isValidObjectId(order_id) || !mongoose.isValidObjectId(reviewee_id)) {
      return res.status(400).json({ message: "ID không hợp lệ" });
    }

    if (rating < 1 || rating > 5) {
      return res.status(400).json({ message: "Rating phải từ 1 đến 5" });
    }

    if (reviewerId === reviewee_id) {
      return res.status(400).json({ message: "Không thể tự đánh giá chính mình" });
    }

    const order = await Order.findOne({
      _id: order_id,
      status: "completed"
    });
    if (!order) {
      return res.status(400).json({
        message: "Chỉ được đánh giá đơn hàng đã hoàn thành"
      });
    }

    const existed = await Review.findOne({
      order_id: order_id,
      reviewer_id: reviewerId,
      reviewee_id: reviewee_id
    });
    if (existed) {
      return res.status(409).json({message: "Bạn đã đánh giá đơn hàng này rồi" });   
    }

    const review = await Review.create({
      order_id,
      reviewer_id: reviewerId,
      reviewee_id,
      reviewee_role,
      rating,
      comment
    });

    return res.status(201).json({
      message: "Đánh giá thành công",
      data: review
    });

  } catch (error) {
    if (error.code === 11000) {
      return res.status(409).json({
        message: "Bạn đã đánh giá đơn hàng này rồi"
      });
    }

    console.error(error);
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message
    });
  }
};

export const getMyReviews = async (req, res) => {
  try {
    const user_id = req.userId;

    if (!mongoose.isValidObjectId(user_id)) {
      return res.status(400).json({ message: "user_id không hợp lệ" });
    }

    const reviews = await Review.find({
      reviewee_id: user_id,
      status: "visible"
    })
      .populate("reviewer_id", "full_name avatar_url")
      .sort({ createdAt: -1 });

    return res.json({
      total: reviews.length,
      data: reviews
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};

export const getReviewByOrder = async (req, res) => {
    try {
        const { order_id } = req.params;
        const userId = req.userId;

        const review = await Review.findOne({ order_id, reviewer_id: userId, status: "visible" })
            .select("-__v -created_at -updated_at")
            .populate("reviewer_id", "full_name avatar_url");

        if (!review) {
            return res.status(404).json({ message: "Chưa có đánh giá", can_review: true, review: null });
        }

        res.json({ can_review: false, data: review });

    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Lỗi server" });
    }
};

export const editReview = async (req, res) => {
    try {
        const userId = req.userId;
        const { review_id } = req.params;
        const { rating, comment } = req.body;

        const review = await Review.findOne({
            _id: review_id,
            reviewer_id: userId,
            status: "visible"
        });

        if (!review)
            return res.status(404).json({ message: "Không tìm thấy đánh giá" });

        const minutesPassed =
            (Date.now() - review.created_at.getTime()) / 60000;

        if (minutesPassed > EDIT_LIMIT_MINUTES)
            return res.status(403).json({ message: `Không thể chỉnh sửa đánh giá sau ${EDIT_LIMIT_MINUTES} phút`});

        review.rating = rating ?? review.rating;
        review.comment = comment ?? review.comment;
        await review.save();

        res.json({ message: "Cập nhật đánh giá thành công", data: review });
        
    } catch (error) {
      console.error(error);
      return res.status(500).json({ message: "Lỗi server" });
    }
};

export const updateReviewStatus = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { status, note } = req.body;

    if (!mongoose.isValidObjectId(reviewId)) {
      return res.status(400).json({ message: "Review ID không hợp lệ" });
    }

    const allowedStatus = ["hidden", "visible", "deleted"];
    if (!allowedStatus.includes(status)) {
      return res.status(400).json({ message: "Status không hợp lệ" });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({ message: "Không tìm thấy review" });
    }

    review.status = status;
    review.note = note || "";

    await review.save();

    return res.json({
      message: "Cập nhật trạng thái review thành công",
      review,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Lỗi server" });
  }
};