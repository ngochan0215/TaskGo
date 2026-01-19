import mongoose from "mongoose";

const earningTaskerSchema = new mongoose.Schema({
    tasker_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tasker",
        required: true,
        index: true
    },

    order_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        required: true,
        unique: true
    },

    gross_amount: {
        type: Number,
        required: true
    },

    commission_rate: {
        type: Number,   // hiện tại là 0.7 = 70%
        required: true
    },

    earning_amount: {
        type: Number,   // giá trị đơn hàng * 70%
        required: true
    },

    platform_fee: {
        type: Number,   // tiền taskgo chịu
        required: true
    },

    status: {
        type: String,
        enum: ["pending", "available", "paid", "cancelled"],
        default: "pending",
        index: true
    },

    payout_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "PayoutTasker"
    },

    completed_at: {
        type: Date,
        required: true
    }
}, {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
});

earningTaskerSchema.index({ tasker_id: 1, created_at: -1 });
earningTaskerSchema.index({ status: 1 });
earningTaskerSchema.index({ completed_at: -1 });

export const TaskerEarning = mongoose.models.TaskerEarning || mongoose.model("TaskerEarning", earningTaskerSchema);
export default TaskerEarning;
