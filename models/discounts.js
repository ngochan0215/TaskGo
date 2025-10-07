import mongoose, { trusted } from "mongoose";

const discountSchema = new mongoose.Schema(
    {
        discount_name: {type: String, required: true, unique: true, trim: true},
        description: {type: String, required: true},
        percentage: {type: Number, required: true, min: 0, max: 100},
        begin_date: {type: Date, required: true},
        end_date: {type: Date, required: true},
        appliesTo: {
            type: {
                kind: { type: String, enum: ["service", "task", "order", "bill"]},
                refId: { type: mongoose.Schema.Types.ObjectId, refPath: "appliesTo.kind" },
            }, 
            required: true
        },
        status: {type: String, enum: ["active", "inactive"]},
    }, { timestamps: true}
);

discountSchema.pre('validate', function (next) {
  if (this.end_date < this.begin_date) {
    return next(new Error('End date must be after begin date'));
  }
  next();
});

const Discount = mongoose.models.Discount || mongoose.model("Discount", discountSchema);
export default Discount;

