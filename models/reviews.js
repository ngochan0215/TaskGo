import mongoose from "mongoose";

const reviewSchema = new mongoose.Schema(
    {
        order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
        reviewer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        reviewee_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        reviewee_role: { type: String, enum: ["customer", "tasker"], required: true },
        rating: { type: Number, required: true, min: 0, max: 5 },
        comment: { type: String, trim: true },
        status: { type: String, enum: ["visible", "hidden"], default: "visible" }
    },
    { timestamps: true }
);

// Each pair of reviewer and order should have only one review
reviewSchema.index({ reviewer_id: 1, related_order: 1 }, { unique: true });

const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);
export default Review;