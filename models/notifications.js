import mongoose from "mongoose";

const notificationSchema = new mongoose.Schema(
    {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true }, 
        message: { type: String, required: true, trim: true },
        title: { type: String, required: true, trim: true },
        type: {
            type: String,
            enum: ["message", "order_update", "discount", "system", "other"],
            default: "other",
        },
        reference: {
            type: {
                kind: {
                    type: String,
                    enum: ["Conversation", "Order", "Discount", "Voucher", "Task", "User"],
                },
                refId: { type: mongoose.Schema.Types.ObjectId, refPath: "reference.kind" },
            },
        },
        status: { type: String, enum: ["read", "unread", "deleted"] },
    },
    { timestamps: true }
);

const Notification = mongoose.models.Notification || mongoose.model("Notification", notificationSchema);
export default Notification;