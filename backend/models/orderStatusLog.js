import mongoose from "mongoose";

const orderStatusLogSchema = new mongoose.Schema(
  {
    order_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Order",
      required: true
    },

    actor_type: {
      type: String,
      enum: ["customer", "tasker", "system"],
      required: true
    },

    actor_id: { type: mongoose.Schema.Types.ObjectId },

    from_status: {
      type: String,
      enum: [
        "pending",          // chờ tasker
        "assigned",         // hệ thống gán tasker
        "accepted",         // tasker nhận
        "departed",         // bắt đầu đi
        "arrived",          // tasker đã đến
        "in_progress",      // tasker bắt đầu làm
        "completed",        // tasker hoàn thành
        "awaiting_payment", // chờ thanh toán
        "cancelled",        // hủy
      ],
      required: true
    },

    to_status: {
      type: String,
      enum: [
        "pending",          // chờ tasker
        "assigned",         // hệ thống gán tasker
        "accepted",         // tasker nhận
        "departed",         // bắt đầu đi
        "arrived",          // tasker đã đến
        "in_progress",      // tasker bắt đầu làm
        "completed",        // tasker hoàn thành
        "awaiting_payment", // chờ thanh toán
        "cancelled",        // hủy
      ],
      required: true
    },

    reasons: [{
        type: String,
        enum: [
          "too_far",
          "busy",
          "price_not_ok",
          "time_not_suitable",
          "skill_not_match",
          "other"
        ],
        default: "time_not_suitable"
    }],

    note: { type: String, default: "" },
  },
  { 
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

const OrderStatusLog = mongoose.models.OrderStatusLog || mongoose.model("OrderStatusLog", orderStatusLogSchema);
export default OrderStatusLog;
