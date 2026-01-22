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
      return res.status(409).json({message: "Bạn đã đánh giá đơn hàng này rồi (blabla)" });   
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
      // Kiểm tra xem có phải lỗi do index cũ không (reviewer_id_1_related_order_1)
      const isOldIndexError = error.message && error.message.includes('related_order');
      
      if (isOldIndexError) {
        // Index cũ đang gây conflict, thử drop và retry
        try {
          const collection = Review.collection;
          const indexes = await collection.indexes();
          
          // Tìm và drop index cũ có chứa related_order
          for (const idx of indexes) {
            const keys = Object.keys(idx.key || {});
            if (keys.includes('reviewer_id') && keys.includes('related_order') && 
                !keys.includes('order_id') && !keys.includes('reviewee_id')) {
              try {
                const indexName = idx.name;
                await collection.dropIndex(indexName);
                console.log(`[Review] Dropped old index: ${indexName}`);
                
                // Retry create sau khi drop index
                const retryReview = await Review.create({
                  order_id,
                  reviewer_id: reviewerId,
                  reviewee_id,
                  reviewee_role,
                  rating,
                  comment
                });
                
                return res.status(201).json({
                  message: "Đánh giá thành công",
                  data: retryReview
                });
              } catch (dropError) {
                console.error(`[Review] Error dropping index ${idx.name}:`, dropError);
              }
            }
          }
        } catch (dropError) {
          console.error('[Review] Error handling old index:', dropError);
        }
      }
      
      // Nếu không phải lỗi index cũ, hoặc không drop được, trả về lỗi thông thường
      // Kiểm tra lại xem có thực sự đã tồn tại review không
      const checkExisted = await Review.findOne({
        order_id,
        reviewer_id: reviewerId,
        reviewee_id
      });
      
      if (checkExisted) {
        return res.status(409).json({
          message: "Bạn đã đánh giá người này cho đơn hàng này rồi"
        });
      }
      
      // Nếu không tìm thấy review đã tồn tại, có thể là race condition hoặc lỗi khác
      return res.status(409).json({
        message: "Không thể tạo đánh giá. Vui lòng thử lại."
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

// ========== ADMIN FUNCTIONS ==========

// Get all reviews with filters (Admin only)
export const getAllReviews = async (req, res) => {
  try {
    const { 
      status, 
      rating, 
      reviewee_role, 
      page = 1, 
      limit = 10,
      search 
    } = req.query;

    const query = {};

    // Filter by status
    if (status && ["visible", "hidden", "deleted"].includes(status)) {
      query.status = status;
    }

    // Filter by rating
    if (rating) {
      const ratingNum = parseInt(rating);
      if (ratingNum >= 1 && ratingNum <= 5) {
        query.rating = ratingNum;
      }
    }

    // Filter by reviewee role
    if (reviewee_role && ["customer", "tasker"].includes(reviewee_role)) {
      query.reviewee_role = reviewee_role;
    }

    // Search by order ID or reviewer/reviewee name
    if (search) {
      const searchRegex = { $regex: search, $options: "i" };
      query.$or = [
        { order_id: mongoose.isValidObjectId(search) ? search : null },
      ];
      // Remove invalid ObjectId from query
      if (!mongoose.isValidObjectId(search)) {
        query.$or = [];
      }
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const reviews = await Review.find(query)
      .populate("reviewer_id", "full_name avatar_url phone_number")
      .populate("reviewee_id", "full_name avatar_url phone_number")
      .populate("order_id", "final_amount status")
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Review.countDocuments(query);

    return res.json({
      success: true,
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        totalPages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error("Error getting all reviews:", error);
    return res.status(500).json({ 
      success: false,
      message: "Lỗi server",
      error: error.message 
    });
  }
};

// Get review statistics (Admin only)
export const getReviewStatistics = async (req, res) => {
  try {
    const totalReviews = await Review.countDocuments();
    const visibleReviews = await Review.countDocuments({ status: "visible" });
    const hiddenReviews = await Review.countDocuments({ status: "hidden" });
    const deletedReviews = await Review.countDocuments({ status: "deleted" });

    // Average rating
    const avgRatingResult = await Review.aggregate([
      { $match: { status: "visible" } },
      { $group: { _id: null, avgRating: { $avg: "$rating" } } },
    ]);
    const averageRating = avgRatingResult[0]?.avgRating || 0;

    // Rating distribution
    const ratingDistribution = await Review.aggregate([
      { $match: { status: "visible" } },
      { $group: { _id: "$rating", count: { $sum: 1 } } },
      { $sort: { _id: -1 } },
    ]);

    // Reviews by role
    const reviewsByRole = await Review.aggregate([
      { $match: { status: "visible" } },
      { $group: { _id: "$reviewee_role", count: { $sum: 1 } } },
    ]);

    // Recent reviews (last 7 days)
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentReviews = await Review.countDocuments({
      created_at: { $gte: sevenDaysAgo },
      status: "visible",
    });

    return res.json({
      success: true,
      statistics: {
        total: totalReviews,
        visible: visibleReviews,
        hidden: hiddenReviews,
        deleted: deletedReviews,
        averageRating: Math.round(averageRating * 10) / 10,
        ratingDistribution: ratingDistribution.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        reviewsByRole: reviewsByRole.reduce((acc, item) => {
          acc[item._id] = item.count;
          return acc;
        }, {}),
        recentReviews,
      },
    });
  } catch (error) {
    console.error("Error getting review statistics:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};

// Get review by ID (Admin only)
export const getReviewById = async (req, res) => {
  try {
    const { reviewId } = req.params;

    if (!mongoose.isValidObjectId(reviewId)) {
      return res.status(400).json({
        success: false,
        message: "Review ID không hợp lệ",
      });
    }

    const review = await Review.findById(reviewId)
      .populate("reviewer_id", "full_name avatar_url phone_number email")
      .populate("reviewee_id", "full_name avatar_url phone_number email")
      .populate("order_id");

    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy review",
      });
    }

    return res.json({
      success: true,
      review,
    });
  } catch (error) {
    console.error("Error getting review by ID:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};

// Delete review (Admin only - soft delete)
export const deleteReview = async (req, res) => {
  try {
    const { reviewId } = req.params;
    const { note } = req.body;

    if (!mongoose.isValidObjectId(reviewId)) {
      return res.status(400).json({
        success: false,
        message: "Review ID không hợp lệ",
      });
    }

    const review = await Review.findById(reviewId);
    if (!review) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy review",
      });
    }

    review.status = "deleted";
    review.note = note || review.note || "";

    await review.save();

    return res.json({
      success: true,
      message: "Xóa review thành công",
      review,
    });
  } catch (error) {
    console.error("Error deleting review:", error);
    return res.status(500).json({
      success: false,
      message: "Lỗi server",
      error: error.message,
    });
  }
};