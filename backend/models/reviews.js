import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
  {
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    reviewer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reviewee_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reviewee_role: { type: String, enum: ["customer", "tasker"], required: true },
    rating: { type: Number, required: true, min: 0, max: 5 },
    comment: { type: String, trim: true },
    status: { type: String, enum: ["visible", "hidden", "deleted"], default: "visible" },
    note : { type: String }
  },
  { 
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, 
  }
);

// Mỗi reviewer chỉ được đánh giá một review cho một người trong một order
// (reviewer_id + order_id + reviewee_id) là duy nhất
reviewSchema.index({ reviewer_id: 1, order_id: 1, reviewee_id: 1 }, { unique: true });

const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);
export default Review;
