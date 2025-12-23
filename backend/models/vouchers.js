import mongoose from "mongoose";

// voucher: người dùng tự nhập mã để được giảm giá

const voucherSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true, trim: true },

    total_quantity: { type: Number, default: 1, min: 10 }, // tổng số lượng voucher được phát hành
    percentage: { type: Number, default: 0, min: 0, max: 100 },
    max_percentage: { type: Number, default: 0, min: 0 }, // tối đa được giảm bao nhiêu tiền

    begin_date: { type: Date, required: true },
    end_date: { type: Date, required: true },

    // đối tượng áp dụng
    applied_model: {
      type: String,
      enum: ["SERVICE", "TASK", "ORDER", "RECEIPT", "GLOBAL"],
      required: true
    },

    applied_model_id: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "applied_model",
      required: function () {
        return this.applied_model !== "Global";
      }
    },

    conditions: {
      customer_types: {
        type: [String],
        enum: ["new", "loyal", "vip"],
        default: []
      },
      min_order_value: Number
    },

    // số lần 1 user được phép sử dụng voucher
    per_user_limit: {
      type: Number,
      default: 1
    }
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

const Voucher = mongoose.models.Voucher || mongoose.model("Voucher", voucherSchema);
export default Voucher;
