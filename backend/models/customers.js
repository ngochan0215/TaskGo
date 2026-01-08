import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    type: { type: String, enum: ["new", "loyal", "vip"], default: "new" },

    total_completed_orders: { type: Number, default: 0 },
    cancellation_count: { type: Number, default: 0 },
  },
  { 
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }, 
  }
);

const Customer = mongoose.models.Customer || mongoose.model("Customer", customerSchema);
export default Customer;
