import mongoose from "mongoose";

const receiptSchema = new mongoose.Schema(
  {
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
    total_amount: { type: Number, required: true },
    deposit_paid_amount: { type: Number, default: 0 },
    
    payment_method: {
      type: String,
      enum: ["cash", "credit_card", "bank_transfer", "ewallet"],
      required: true,
    },
    status: {
      type: String,
      enum: ["success", "pending", "failed", "refunded"],
      default: "pending",
    },
    
    paid_at: { type: Date },
    transaction_id: { type: String, trim: true },
  },
  { 
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" } 
  }
);

//receiptSchema.index({ order_id: 1 });

const Receipt = mongoose.models.Receipt || mongoose.model("Receipt", receiptSchema);
export default Receipt;
