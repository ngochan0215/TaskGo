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
      required: true
    },

    to_status: {
      type: String,
      required: true
    },

    created_at: { type: Date, default: Date.now },

    reason: { type: String  }
  },
  { versionKey: false }
);

const OrderStatusLog = mongoose.models.OrderStatusLog || mongoose.model("OrderStatusLog", orderStatusLogSchema);
export default OrderStatusLog;
