import mongoose from "mongoose";

const favoriteTaskSchema = new mongoose.Schema(
  {
    user_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",    // user có role customer
      required: true
    },
    task_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",  
      required: true
    },
    note: { type: String, trim: true }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

favoriteTaskSchema.index({ user_id: 1, task_id: 1 }, { unique: true });

const FavoriteTask = mongoose.models.FavoriteTask || mongoose.model("FavoriteTask", favoriteTaskSchema);
export default FavoriteTask;