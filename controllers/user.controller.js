import User from "../models/users.js";
import Account from "../models/accounts.js";
import Customer from "../models/customers.js";
import Tasker from "../models/taskers.js";

export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    const account = await Account.findById(user.account_id);
    if (!account) {
      return res.status(400).json({ success: false, message: "Account not found" });
    }

    if (account.role == "customer") {
      const customer = await Customer.findOne({ user_id: user._id });
      if (!customer) {
        return res.status(400).json({ success: false, message: "Customer not found" });
      }

      return res.status(200).json({
        success: true,
        user,
        role: account.role,
        type: customer.type,
      });
    } else if (account.role == "tasker") {
      const tasker = await Tasker.findOne({ user_id: user._id });
      if (!tasker) {
        return res.status(400).json({ success: false, message: "Tasker not found" });
      }

      return res.status(200).json({
        success: true,
        user,
        role: account.role,
        working_year: tasker.working_year,
        hourly_rate: tasker.hourly_rate,
        introduction: tasker.introduction,
        working_area: tasker.working_area,
      });
    }

    return res.status(400).json({
      success: false,
      message: "Invalid role",
    });
  } catch (error) {
    console.error("Get user profile error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    const account = await Account.findById(user.account_id);
    if (!account) {
      return res.status(400).json({ success: false, message: "Account not found" });
    }

    const { full_name, phone_number, identification, avatar_url } = req.body;
    if (!full_name && !phone_number && !identification && !avatar_url) {
      throw new Error("At least one field is required to update");
    }

    if (full_name) user.full_name = full_name;
    if (phone_number) user.phone_number = phone_number;
    if (identification) user.identification = identification;
    if (avatar_url) user.avatar_url = avatar_url;
    await user.save();

    if (account.role == "tasker") {
      const tasker = await Tasker.findOne({ user_id: user._id });
      if (!tasker) {
        return res.status(400).json({ success: false, message: "Tasker not found" });
      }

      const { working_year, introduction, working_area } = req.body;
      if (!working_year && !introduction && !working_area) {
        throw new Error("At least one field is required to update");
      }

      if (working_year) tasker.working_year = working_year;
      if (introduction) tasker.introduction = introduction;
      if (working_area) tasker.working_area = working_area;
      await tasker.save();
    }

    return res.status(200).json({
      success: true,
      message: "Profile updated successfully",
    });
  } catch (error) {
    console.error("Update user profile error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
