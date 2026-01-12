import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    label: { type: String, trim: true },

    longitude: { type: Number, required: true },
    latitude: { type: Number, required: true },
    full_address: { type: String, required: true, trim: true },

    street: { type: String, required: true, trim: true },
    ward: { type: String, required: true, trim: true },
    district: { type: String, required: true, trim: true },
    city: { type: String, required: true, trim: true },

    note: { type: String, trim: true },
    is_default: { type: Boolean, default: false },
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" },
  }
);

const Address = mongoose.models.Address || mongoose.model("Address", addressSchema);
export default Address;
