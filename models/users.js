import mongoose from "mongoose";

const userSchema = new mongoose.Schema(
    {
    full_name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    phone_number: { type: String, required: true, unique: true, trim: true, sparse: true },
    identification: { type: String, required: true, unique: true, trim: true },
    avatar_url: { type: String, trim: true },
    reputation_score: { type: Number, default: 0 },
    },
    {
        timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' },
    }
);

const User = mongoose.models.User || mongoose.model("User", userSchema);

export default User;