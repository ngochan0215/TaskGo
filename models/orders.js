import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
    {
        customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        tasker_id : { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        task_id: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },

        scheduled_at: { type: Date, required: true },
        completed_at: { type: Date },

        voucher_id : { type: mongoose.Schema.Types.ObjectId, ref: "Voucher" },
        discount_id: { type: mongoose.Schema.Types.ObjectId, ref: "Discount" },

        base_fee: { type: Number, required: true },
        discount_amount: { type: Number, default: 0 },
        tip_amount: { type: Number, default: 0 },
        total_amount: { type: Number, required: true },

        status: { type: String, enum: ["pending", "accepted", "in_progress", "completed", "cancelled"], default: "pending" },
    },
    { timestamps: true }
);

// orderSchema.index({ customer_id: 1 });
// orderSchema.index({ tasker_id: 1 });
// orderSchema.index({ status: 1 });

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
export default Order;