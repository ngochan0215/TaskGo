import mongoose from "mongoose";

const taskerSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    working_year: { type: Number, required: true, default: 1, min: 1 },
    hourly_rate: { type: Number, required: true, default: 1, min: 1 },
    introduction: { type: String, trim: true },

    // các dịch vụ tasker làm được
    skills: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
    }],

    // phạm vi hoạt động
    working_area: {
      full_address: String,
      latitude: Number,
      longitude: Number,
    },
    working_radius: { type: Number, default: 3 },

    // số lần từ chối nhận việc
    rejection_count: { type: Number, default: 0 },
    total_completed_orders: { type: Number, default: 0 },

    status: { type: String, enum: ["pending", "working", "resign"], default: "pending" },
    working_status: { type: String, enum: ["pending", "available", "busy", "offline", "paused", "inactive"], default: "pending" },
    
    BIN: {type: String }, //6 số đầu của thẻ ngân hàng
    account_number: {type: String }, //số tài khoản ngân hàng (không phải số thẻ nhé)
    bank_shortName: {type: String }, //mã ngân hàng (key từ API bankcodes)
  },
  { 
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const Tasker = mongoose.models.Tasker || mongoose.model("Tasker", taskerSchema);
export default Tasker;
