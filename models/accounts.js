import mongoose from "mongoose";

const accountSchema = new mongoose.Schema(
  {
    user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true, unique: true },
    password_hash: { type: String, required: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    role: { type: String, enum: ["tasker", "admin", "customer"], default: "customer" },
    status: { type: String, enum: ["active", "inactive", "suspended"], default: "active" },
    is_verified: { type: Boolean, default: false },
    last_login: { type: Date, default: Date.now },
    verificationToken: String,
    verificationTokenExpiresAt: Date,
    resetPasswordToken: String,
    resetPasswordTokenExpiresAt: Date,
    changeEmailOTP: String,
    changeEmailAddress: String,
    changeEmailOTPExpiresAt: Date,
  },
  { timestamps: true }
);

const Account = mongoose.models.Account || mongoose.model("Account", accountSchema);
export default Account;
