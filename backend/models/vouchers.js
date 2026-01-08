import mongoose from "mongoose";

// voucher: người dùng chọn mã giảm giá
const voucherSchema = new mongoose.Schema(
  {
    code: { type: String, required: true, unique: true, uppercase: true },
    name: { type: String, required: true },
    description: { type: String },

    discount: {
      type: {
        type: String,
        enum: ["PERCENT", "FIXED"],
        required: true
      },
      value: { type: Number, required: true },
      max_discount: Number
    },

    total_quantity: { type: Number, required: true, min: 1 },
    used_quantity: { type: Number, default: 0 },

    begin_date: { type: Date, required: true },
    end_date: { type: Date, required: true },

    is_active: { type: Boolean, default: false },

    applicable_model: [String],

    conditions: {
      rule_type: {
        type: String,
        enum: ["FIRST_ORDER", "GENERAL"],
        default: "GENERAL"
      },
      customer_tiers: [String],
      min_order_value: { type: Number, default: 0 }
    },

    per_user_limit: { type: Number, default: 1 },
    status: { type: String, enum: ["upcoming", "ongoing", "finished"], default: "upcoming" }

  }, 
  { 
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

voucherSchema.pre("validate", function (next) {
  if (this.end_date < this.begin_date) {
    return next(new Error("End date must be after begin date"));
  }
  next();
});

voucherSchema.index({ begin_date: 1, end_date: 1 });
voucherSchema.index({ code: 1, status: 1, is_active: 1 });


const Voucher = mongoose.models.Voucher || mongoose.model("Voucher", voucherSchema);
export default Voucher;
