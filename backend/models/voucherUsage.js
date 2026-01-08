import mongoose from "mongoose";

const voucherUsageSchema = new mongoose.Schema(
    {
        voucher_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Voucher",
            required: true
        },

        user_id: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
            required: true
        },

        used_count: {
            type: Number,
            default: 1
        }
    }, 
    { 
        timestamps: { createdAt: "created_at", updatedAt: "updated_at" } 
    }
);

voucherUsageSchema.index(
    { voucher_id: 1, user_id: 1 },
    { unique: true }
);

const VoucherUsage = mongoose.models.VoucherUsage || mongoose.model("VoucherUsage", voucherUsageSchema);
export default VoucherUsage;