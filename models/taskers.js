import mongoose from "mongoose";

const taskerSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    working_year: { type: Number, required: true },
    hourly_rate: { type: Number, required: true },
    introduction: { type: String, trim: true },
    working_area: [{ type: String, trim: true }],
    status: { type: String, enum: ["working", "resign"], default: "working" },
    working_status: { type: String, enum: ["available", "busy", "inactive"], default: "available" }
  },
  { timestamps: true }
);

const Tasker = mongoose.models.Tasker || mongoose.model("Tasker", taskerSchema);
export default Tasker;
