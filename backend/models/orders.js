import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tasker_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },

    task_id: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },
    task_snapshot: {
      code: String,
      name: String,
      pricing: Number,
      unit: String
    },

    discount_id: { type: mongoose.Schema.Types.ObjectId, ref: "Discount" },
    discount_snapshot: {
      code: String,
      name: String,
      description: String,
      discount_amount: Number,
    },

    voucher_id: { type: mongoose.Schema.Types.ObjectId, ref: "Voucher" },
    voucher_snapshot: {
      code: String,
      name: String,
      description: String,
      discount_amount: Number,
    },

    address_id: { type: mongoose.Schema.Types.ObjectId, ref: "Address" },
    address_snapshot: {
      full_address: String,
      latitude: Number,
      longitude: Number,
    },

    task_payload: {
      type: mongoose.Schema.Types.Mixed,
      required: true
    },

    type: {
      type: String,
      enum: ["immediate", "scheduled"],
      default: "immediate",
    },
    scheduled_at: { type: Date, required: true },
    
    note: { type: String },
    quantity: { type: Number, default: 1 },
    
    base_amount: { type: Number, required: true },  // tiền gốc của dịch vụ
    final_amount: { type: Number, required: true }, // tiền sau khi áp voucher, discount
    tip_amount: { type: Number, default: 0 },

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
        "awaiting_payment",  // chờ thanh toán
        "cancelled", // hủy
      ],
      default: "pending",
    },
  },
  { 
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
   }
);

// orderSchema.index({ customer_id: 1 });
// orderSchema.index({ tasker_id: 1 });
orderSchema.index({ status: 1, task_id: 1, customer_id: 1 });

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
export default Order;
