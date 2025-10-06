import mongoose from "mongoose";

const customerSchema = new mongoose.Schema(
    {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true }, 
    type: { type: String, enum: ['individual', 'company'], required: true },
    });

const Customer = mongoose.models.Customer || mongoose.model("Customer", customerSchema);

export default Customer;