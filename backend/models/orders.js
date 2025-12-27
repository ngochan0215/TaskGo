import mongoose from "mongoose";

const orderSchema = new mongoose.Schema(
  {
    customer_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    tasker_id: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
    task_id: { type: mongoose.Schema.Types.ObjectId, ref: "Task", required: true },

    voucher_id: { type: mongoose.Schema.Types.ObjectId, ref: "Voucher" },
    discount_id: { type: mongoose.Schema.Types.ObjectId, ref: "Discount" },
    
    type: { type: String, enum: ["immediate", "scheduled"], default: "immediate" },
    scheduled_at: { type: Date, required: true },

    address_id: { type: mongoose.Schema.Types.ObjectId, ref: "Address" },
    address_snapshot: {
      full_address: String,
      latitude: Number,
      longtitude: Number
    },
    
    note: { type: String },
    quantity: { type: Number, default: 1 },

    base_fee: { type: Number, required: true },
    discount_amount: { type: Number, default: 0 },
    voucher_amount: { type: Number, default: 0 },
    tip_amount: { type: Number, default: 0 },
    total_amount: { type: Number },

    status: {
      type: String,
      enum: [
        "pending",      // chờ tasker
        "assigned",     // hệ thống gán tasker
        "accepted",     // tasker nhận
        "departed",     // bắt đầu đi
        "arrived",     // tasker đã đến
        "in_progress",  // tasker bắt đầu làm
        "completed",    // tasker hoàn thành
        "cancelled",    // hủy
      ],
      default: "pending"
    },
  },
  { 
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
   }
);

// orderSchema.index({ customer_id: 1 });
// orderSchema.index({ tasker_id: 1 });
// orderSchema.index({ status: 1 });

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
export default Order;
