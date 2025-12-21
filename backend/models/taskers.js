import mongoose from "mongoose";

const taskerSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    working_year: { type: Number, required: true, default: 1, min: 1 },
    hourly_rate: { type: Number, required: true, default: 1, min: 1 },
    introduction: { type: String, trim: true },
    working_area: [{ type: String, trim: true }],
    status: { type: String, enum: ["pending", "working", "resign"], default: "pending" },
    working_status: { type: String, enum: ["pending", "available", "busy", "inactive"], default: "pending" } 
  },
  { 
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const Tasker = mongoose.models.Tasker || mongoose.model("Tasker", taskerSchema);
export default Tasker;
