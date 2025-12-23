import mongoose from "mongoose";

// discount: áp dụng cho toàn hệ thống, system tự apply
const discountSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    description: { type: String, required: true },

    // phần trăm khuyến mãi
    percentage: {
      type: Number,
      required: true,
      min: 0,
      max: 100,
      set: v => Math.round(v * 100) / 100
    },

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
        return this.applied_model !== "GLOBAL";
      }
    },

    conditions: {
      customer_types: {
        type: [String],
        enum: ["new", "loyal", "vip"],
        default: []
      },
      min_order_value: Number
    }
  }, 
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

discountSchema.virtual("status").get(function () {
  const now = new Date();
  if (now < this.begin_date) return "upcoming";
  if (now > this.end_date) return "completed";
  return "ongoing";
});

discountSchema.index({ begin_date: 1, end_date: 1 });

const Discount = mongoose.models.Discount || mongoose.model("Discount", discountSchema);
export default Discount;
