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

    reason: { type: String  }
  },
  { 
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

const OrderStatusLog = mongoose.models.OrderStatusLog || mongoose.model("OrderStatusLog", orderStatusLogSchema);
export default OrderStatusLog;
