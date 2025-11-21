import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    customer_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    tasker_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    task_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Task",
      required: true,
    },
    voucher_id: { type: mongoose.Schema.Types.ObjectId, ref: "Voucher" },

    discount_snapshot: {
      discountId: { type: mongoose.Schema.Types.ObjectId, ref: "Discount" },
      name: String,
      description: String,
      percentage: Number,
      begin_date: Date,
      end_date: Date,
      appliedAt: { type: Date, default: Date.now },
    },

    voucher_snapshot: {
      voucherId: { type: mongoose.Schema.Types.ObjectId, ref: "Voucher" },
      name: String,
      description: String,
      percentage: Number,
      begin_date: Date,
      end_date: Date,
      code: String,
    },

    type: {
      type: String,
      enum: ["immediate", "scheduled"],
      default: "immediate",
    },
    location: {
      address: { type: String, required: true },
      latitude: Number,
      longtitude: Number,
    },
    note: { type: String },
    
    scheduled_at: { type: Date, required: true },
    departed_at: { type: Date }, // tasker bắt đầu đi
    started_at: { type: Date }, // tasker bắt đầu làm
    completed_at: { type: Date }, // tasker hoàn thành
    
    base_fee: { type: Number, required: true },
    quantity: { type: Number, default: 1 },
    // discount_amount: { type: Number, default: 0 },
    // voucher_amount: { type: Number, default: 0 },
    tip_amount: { type: Number, default: 0 },
    total_amount: { type: Number },

    status: {
      type: String,
      enum: [
        "pending", // chờ tasker
        "assigned", // hệ thống gán tasker
        "accepted", // tasker nhận
        "departed", // bắt đầu đi
        "arrived", // tasker đã đến
        "in_progress", // tasker bắt đầu làm
        "completed", // tasker hoàn thành
        "cancelled", // hủy
      ],
      default: "pending",
    },

    cancel_reason: { type: String },
    cancel_at: { type: Date },
  },
  { timestamps: true }
);

// orderSchema.index({ customer_id: 1 });
// orderSchema.index({ tasker_id: 1 });
// orderSchema.index({ status: 1 });

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
export default Order;
