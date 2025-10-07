import mongoose from "mongoose";

const addressSchema = new mongoose.Schema(
    {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        detail: { type: String, require: true, trim: true }
    }
);

const Address = mongoose.models.Address || mongoose.model("Address", addressSchema);
export default Address;