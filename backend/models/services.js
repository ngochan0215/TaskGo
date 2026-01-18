import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
  {
    category_name: { type: String, required: true, unique: true, trim: true },
    description: { type: String, required: true, trim: true },
    status: { type: String, enum: ["active", "inactive", "launching"], default: "launching" },
    avatar_url: { type: String },
  },
  { timestamps: true }
);

serviceSchema.virtual("tasks", {
  ref: "Task",
  localField: "_id",
  foreignField: "service_id",
});

serviceSchema.set("toObject", { virtuals: true });
serviceSchema.set("toJSON", { virtuals: true });

const Service = mongoose.models.Service || mongoose.model("Service", serviceSchema);
export default Service;
