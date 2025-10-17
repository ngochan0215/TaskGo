import User from "../models/users.js";
import Account from "../models/accounts.js";;

import bcrypt from "bcrypt";
import crypto from "crypto";
import { sendVerificationEmailUpdateProfile } from "../gmail/email.js";

export const updateProfile = async (req, res) => {
    try {
        const { full_name, phone_number } = req.body;
        const user = await User.findById(req.user._id);

        if(!user) {
            return res.status(404).json({message: "User not found."});
        }

        if (full_name) user.full_name = full_name;
        if (phone_number) user.phone_number = phone_number;
        await user.save();

        const updatedUser = await User.findById(user._id).select("-account_id");
        res.json({ message: "Cập nhật thông tin thành công", user: updatedUser });

    } catch (error) {
        res.status(500).json({message: "SERVER ERROR: ", error: error.message });
    }
}

export const changePassword = async (req, res) => {
    try {
        const { oldPassword, newPassword } = req.body;
        const account = await Account.findById(req.user._id).select("+password_hash");

        if(!account){
            return res.status(404).json({ message: "User's acount not found." });
        }

        const isMatch = await bcrypt.compare(oldPassword, account.password_hash);
        if(!isMatch) {
            return res.status(400).json({ message: "Incorrect password." });
        }

        if (newPassword.length < 6) {
            return res.status(400).json({ message: "Password must be at least 6 characters long" });
        }

        const hashedPassword = await bcrypt.hash(newPassword, 10);
        account.password_hash = hashedPassword;
        await account.save();
        res.json({ message: "Change password successfully."})

    } catch (error) {
        res.status(500).json({message: "SERVER ERROR: ", error: error.message });
    }
};

export const sendEmail = async (req, res) => {
    try {
        const { newEmail } = req.body;
        const account = await Account.findById(req.user._id);
        if(!account){
            return res.status(404).json({ message: "Account not found." });
        }

        const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
        req.account.changeEmailOTP = otp;
        req.account.changeEmailOTPExpiresAt = Date.now() + 10 * 60 * 1000; // 10 phút
        req.account.changeEmailAddress = newEmail;

        await req.account.save();
        await sendVerificationEmailUpdateProfile(newEmail, otp);

        res.json({ message: "Successfully send verification email for updating profile." });
    } catch (error) {
        res.status(500).json({ message: "SERVER ERROR: ", error: error.message });
    }
};

export const verifyEmail = async (req, res) => {
  try {
    const { otp } = req.body;
    const account = await Account.findById(req.user._id);
    if(!account){
        return res.status(404).json({ message: "User not found." });
    }
    if (!account.changeEmailOTP || account.changeEmailOTP !== otp || account.changeEmailOTPExpiresAt < Date.now()) {
      return res.status(400).json({ message: "Invalid or expired verification code." });
    }

    account.email = account.changeEmailAddress;
    account.changeEmailOTP = undefined;
    account.changeEmailOTPExpiresAt = undefined;
    account.changeEmailAddress = undefined;

    await account.save();

    res.json({ message: "Đổi email thành công.", newEmail: account.email });
  } catch (error) {
    res.status(500).json({ message: "Lỗi xác thực OTP", error: error.message });
  }
};