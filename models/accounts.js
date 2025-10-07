import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
    {
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },
        username: { type: String, required: true, unique: true, trim: true, lowercase: true },
        password_hash: { type: String, required: true },
        role: { type: String, enum: ['tasker', 'admin', 'customer'], default: 'customer' },
        status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },
    },
    { timestamps: true}
);

const Account = mongoose.models.Account || mongoose.model("Account", accountSchema);
export default Account;