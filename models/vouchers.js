import mongoose from "mongoose";

const voucherSchema = new mongoose.Schema(
    {
        voucher_name: { type: String, required: true, trim: true},
        quantity: { type: Number, default: 0 },                     // total available vouchers
        percentage: { type: Number, default: 0, min: 0, max: 100 },
        begin_date: { type: Date },
        end_date: { type: Date },
        appliesTo: {
            type: {
                kind: { type: String, enum: []},
                refId: { type: mongoose.Schema.Types.ObjectId, refPath: "appliesTo.kind" },
            }, 
            required: true
        },
        usage_rules: {
            customer_type: { type: String, enum: ["new", "loyal", "vip"], default: "new" },
            max_usage: { type: Number, default: 1 },                            
            activity_threshold: { type: Number, default: 0 },
        },
    },
    { timestamps: true }
);

voucherSchema.pre('validate', function (next) {
  if (this.end_date < this.begin_date) {
    return next(new Error('End date must be after begin date'));
  }
  next();
});

const Voucher = mongoose.models.Voucher || mongoose.model("Voucher", voucherSchema);
export default Voucher;