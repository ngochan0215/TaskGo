import mongoose from "mongoose";

const favoriteTaskerSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",    // user có role customer
      required: true
    },
    tasker_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",  // user có role tasker
      required: true
    },
    note: { type: String, trim: true }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

favoriteTaskerSchema.index({ user_id: 1, tasker_id: 1 }, { unique: true });

const FavoriteTasker = mongoose.models.FavoriteTasker || mongoose.model("FavoriteTasker", favoriteTaskerSchema);
export default FavoriteTasker;