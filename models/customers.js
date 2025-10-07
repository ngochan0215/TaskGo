import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
    {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true }, 
        type: { type: String, enum: ['new', 'loyal', 'vip'], required: true },
    },
    { timestamps: true }
);

const Customer = mongoose.models.Customer || mongoose.model("Customer", customerSchema);
export default Customer;