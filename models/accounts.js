import mongoose from "mongoose";

const accountSchema = new mongoose.Schema({
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    username: { type: String, required: true, unique: true, trim: true },
    password_hash: { type: String, required: true },
    salt: { type: String, required: true },
    role: { type: String, enum: ['tasker', 'admin', 'customer'], default: 'customer' },
    status: { type: String, enum: ['active', 'inactive', 'suspended'], default: 'active' },

});

const Account = mongoose.models.Account || mongoose.model("Account", accountSchema);
export default Account;