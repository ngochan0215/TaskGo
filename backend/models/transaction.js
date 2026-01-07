import mongoose from "mongoose";

const transactionSchema = new mongoose.Schema(
    {
        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true,
        },
        order_code: { type: Number, required: true, unique: true },
        description: { type: String, trim: true },
        amount: { type: Number, required: true },
        status: { type: String, enum: ["pending", "completed", "failed"], default: "pending" },
        type: { type: String, enum: ["payment", "payout"], required: true },
    },
    { timestamps: true }
);

transactionSchema.index({ user_id: 1});

const Transaction = mongoose.models.Transaction || mongoose.model("Transaction", transactionSchema);
export default Transaction;
