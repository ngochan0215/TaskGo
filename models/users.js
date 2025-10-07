import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
        account_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Account' },
        full_name: { type: String, required: true, trim: true },
        email: { type: String, required: true, unique: true, lowercase: true, trim: true },
        phone_number: { type: String, required: true, unique: true, trim: true },
        identification: { type: String, required: true, unique: true, trim: true, select: false },
        avatar_url: { type: String, trim: true },
        reputation_score: { type: Number, default: 0 },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);
export default User;