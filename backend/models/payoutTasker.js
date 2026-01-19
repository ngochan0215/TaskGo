import mongoose from "mongoose";

// const payoutTaskerSchema = new mongoose.Schema({
//     order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },
//     tasker_id: { type: mongoose.Schema.Types.ObjectId, ref: "Tasker", required: true },
//     amount: { type: Number, required: true },
//     status: { type: String, enum: ["pending", "completed"], default: "pending" },
//     processed_at: { type: Date }
// }, {
//     timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
// });

const payoutTaskerSchema = new mongoose.Schema({
    tasker_id: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Tasker",
        required: true
    },

    earning_ids: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: "TaskerEarning",
        required: true
    }],

    total_amount: {
        type: Number,
        required: true
    },

    period_start: {
        type: Date,
        required: true
    },

    period_end: {
        type: Date,
        required: true
    },

    status: {
        type: String,
        enum: ["pending", "processing", "completed", "failed"],
        default: "pending"
    },

    processed_at: {
        type: Date
    }
}, {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
});

export const PayoutTasker = mongoose.models.PayoutTasker || mongoose.model("PayoutTasker", payoutTaskerSchema);
export default PayoutTasker;