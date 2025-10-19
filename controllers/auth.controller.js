import bcryptjs from "bcryptjs";
import crypto from "crypto";

import { generateTokenAndSetCookie } from "../utils/generateTokenAndSetCookie.js";
import {
  sendVerificationEmail,
  sendWelcomeEmail,
  sendPasswordResetEmail,
  sendResetSuccessEmail,
} from "../gmail/email.js";

import User from "../models/users.js";
import Account from "../models/accounts.js";
import Customer from "../models/customers.js";
import Tasker from "../models/taskers.js";

export const signup = async (req, res) => {
  try {
    const { full_name, email, phone_number, identification, password, role } = req.body;
    // check validation
    if (!full_name || !email || !phone_number || !identification || !password || !role) {
      throw new Error("All fields are required");
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ success: false, message: "Invalid email format" });
    }

    if (identification.length != 12) {
      return res.status(400).json({ success: false, message: "Identification must includes only 12 numbers." });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters long" });
    }

    const userAlreadyExists = await Account.findOne({ email });
    if (userAlreadyExists) {
      return res.status(400).json({ success: false, message: "User already exists" });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);
    const verificationToken = Math.floor(100000 + Math.random() * 900000).toString();

    // insert user general information first
    const user = new User({
      full_name: full_name,
      phone_number: phone_number,
      identification: identification,
    });
    await user.save();

    // insert account information
    const account = new Account({
      user_id: user._id,
      email: email,
      password_hash: hashedPassword,
      role: role,
      verificationToken,
      verificationTokenExpiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000),
    });
    await account.save();

    user.account_id = account._id;
    await user.save();

    // insert the others information, clarify by customer or tasker
    if (role == "customer") {
      const customer = new Customer({ user_id: user._id });
      await customer.save();
    } else if (role == "tasker") {
      const { introduction, working_area } = req.body;

      const tasker = new Tasker({
        user_id: user._id,
        introduction: introduction,
        working_area: working_area,
      });
      await tasker.save();
    }

    // send mail to verify email 
    await sendVerificationEmail(account.email, verificationToken);

    res.status(201).json({
      success: true,
      message: "User created successfully",
      user,
    });
  } catch (error) {
    console.error("Signup error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    // code is the otp code sent in email
    const { code } = req.body;
    if (!code) {
      throw new Error("All fields are required");
    }

    const account = await Account.findOne({
      verificationToken: code,
      verificationTokenExpiresAt: { $gt: new Date() },
    }).select("-password_hash");

    if (!account) {
      return res.status(400).json({ success: false, message: "Invalid or expired verification code" });
    }

    // verify successfully
    account.status = "active";
    account.is_verified = true;
    account.verificationToken = undefined;
    account.verificationTokenExpiresAt = undefined;
    await account.save();

    const user = await User.findById(account.user_id);
    sendWelcomeEmail(account.email, user.full_name);

    res.status(200).json({ success: true, message: "Email verified successfully", user });

  } catch (error) {
    console.error("Verify email error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      throw new Error("All fields are required");
    }

    const account = await Account.findOne({ email });
    if (!account) {
      return res.status(400).json({ success: false, message: "Invalid email!" });
    }

    const user = await User.findById(account.user_id);
    if (!user) {
      return res.status(400).json({ success: false, message: "Invalid user_id in account record." });
    }

    const isPasswordCorrect = await bcryptjs.compare(password, account.password_hash);
    if (!isPasswordCorrect) {
      return res.status(400).json({ success: false, message: "Wrong password!" });
    }

    const token = await generateTokenAndSetCookie(res, user._id, account.role);
    account.last_login = new Date();
    await account.save();

    res.status(200).json({ success: true, message: "Logged in successfully", token });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const logout = async (req, res) => {
  res.clearCookie("token");
  res.status(200).json({ success: true, message: "Logged out successfully" });
};

export const forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) {
      throw new Error("All fields are required");
    }

    const account = await Account.findOne({ email });
    if (!account) {
      return res.status(400).json({ success: false, message: "Account not found" });
    }

    const resetToken = crypto.randomBytes(20).toString("hex");
    const resetTokenExpiresAt = new Date(Date.now() + 1 * 60 * 60 * 1000);

    account.resetPasswordToken = resetToken;
    account.resetPasswordTokenExpiresAt = resetTokenExpiresAt;
    await account.save();

    await sendPasswordResetEmail(
      account.email,
      `${process.env.CLIENT_URL}/reset-password/${resetToken}`
    );

    res.status(200).json({ success: true, message: "Password reset link sent to your email" });

  } catch (error) {
    console.error("Forgot password error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const resetPassword = async (req, res) => {
  try {
    const { token } = req.params;
    const { password } = req.body;
    if (!password) {
      return res.status(400).json({ success: false, message: "Password is required!" });
    }

    const account = await Account.findOne({
      resetPasswordToken: token,
      resetPasswordTokenExpiresAt: { $gt: new Date() },
    });
    if (!account) {
      return res.status(400).json({ success: false, message: "Invalid or expired reset token" });
    }

    if (password.length < 6) {
      return res.status(400).json({ success: false, message: "Password must be at least 6 characters long" });
    }

    const hashedPassword = await bcryptjs.hash(password, 10);

    account.password_hash = hashedPassword;
    account.resetPasswordToken = undefined;
    account.resetPasswordTokenExpiresAt = undefined;
    await account.save();

    const user = await User.findById(account.user_id);
    sendResetSuccessEmail(account.email);

    res.status(200).json({
      success: true,
      message: "Password reset successfully",
      user: {
        ...user._doc,
        password: undefined,
      },
    });
    
  } catch (error) {
    console.error("Reset password error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
