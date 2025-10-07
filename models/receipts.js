import mongoose from "mongoose"

const receiptSchema = new mongoose.Schema(
  {
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true },
    total_amount: { type: Number, required: true },
    payment_method: { type: String, enum: ["cash", "credit_card", "bank_transfer", "ewallet"], required: true },
    transaction_id: { type: String, trim: true }, 
    status: { type: String, enum: ["success", "pending", "failed", "refunded"], default: "pending" },
    paid_at: { type: Date },
  },
  { timestamps: true }
);

//receiptSchema.index({ order_id: 1 });

const Receipt = mongoose.models.Receipt || mongoose.model("Receipt", receiptSchema);
export default Receipt;
