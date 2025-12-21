import { User, Account, Tasker, Customer } from "../models/index.js";
import bcrypt from "bcrypt";
import { sendVerificationEmailUpdateProfile } from "../gmail/email.js";

export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(400).json({ success: false, message: "Không tìm thấy người dùng!" });
    }

    const account = await Account.findById(user.account_id);
    if (!account) {
      return res.status(400).json({ success: false, message: "Không tìm thấy tài khoản!" });
    }

    if (account.role == "customer") {
      const customer = await Customer.findOne({ user_id: user._id });
      if (!customer) {
        return res.status(400).json({ success: false, message: "Không tìm thấy khách hàng!" });
      }

      return res.status(200).json({ success: true, user, role: account.role, email: account.email, type: customer.type });

    } else if (account.role == "tasker") {
      const tasker = await Tasker.findOne({ user_id: user._id });
      if (!tasker) {
        return res.status(400).json({ success: false, message: "Không tìm thấy tasker!" });
      }

      return res.status(200).json({
        success: true,
        user,
        role: account.role,
        email: account.email,
        working_year: tasker.working_year,
        hourly_rate: tasker.hourly_rate,
        introduction: tasker.introduction,
        working_area: tasker.working_area,
      });
    }

    return res.status(400).json({ success: false, message: "Role không hợp lệ!"});

  } catch (error) {
    console.error("LỖI LẤY PROFFILE USER:", error);
    res.status(500).json({ success: false, message: "LỖI SERVER: ", error: error.message });
  }
};

export const updateUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(400).json({ success: false, message: "Không tìm thấy người dùng!" });
    }

    const account = await Account.findById(user.account_id);
    if (!account) {
      return res.status(400).json({ success: false, message: "Không tìm thấy tài khoản!" });
    }

    const { full_name, phone_number, identification } = req.body;

    if (phone_number) {
      const phoneExists = await User.findOne({ phone_number, _id: { $ne: user._id } });
      if (phoneExists) {
        return res.status(400).json({
          success: false,
          message: "Số điện thoại đã được sử dụng."
        });
      }
    }

    if (identification) {
      const idExists = await User.findOne({ identification, _id: { $ne: user._id } });
      if (idExists) {
        return res.status(400).json({
          success: false,
          message: "CCCD đã được sử dụng."
        });
      }
    }

    if (full_name) user.full_name = full_name;
    if (phone_number) user.phone_number = phone_number;
    if (identification) user.identification = identification;
    await user.save();

    if (account.role == "tasker") {
      const tasker = await Tasker.findOne({ user_id: user._id });
      if (!tasker) {
        return res.status(400).json({ success: false, message: "Không tìm thấy tasker!" });
      }

      const { introduction, working_area } = req.body;

      if (introduction) tasker.introduction = introduction;
      if (working_area) tasker.working_area = working_area;
      
      await tasker.save();
    }

    return res.status(200).json({ success: true, message: "Profile updated successfully" });

  } catch (error) {
    console.error("Update user profile error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};

export const updateAvatar = async (req, res) => {
  try {
    const userId = req.userId;

    if (!req.file || !req.file.path) {
      return res.status(400).json({ message: "Không có file nào được chọn." });
    }

    const avatarUrl = req.file.path;

    const updatedUser = await User.findByIdAndUpdate(
      userId,
      { avatar_url: avatarUrl },
      { new: true }
    );

    res.status(200).json({
      success: true,
      message: "Cập nhật avatar thành công",
      avatar: updatedUser.avatar_url,
    });

  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

export const changePassword = async (req, res) => {
  try {
    const { oldPassword, newPassword } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(400).json({ success: false, message: "Không tìm thấy người dùng." });
    }

    const account = await Account.findById(user.account_id).select("+password_hash");
    if (!account) {
      return res.status(400).json({ success: false, message: "Không tìm thấy tài khoản." });
    }

    const isMatch = await bcrypt.compare(oldPassword, account.password_hash);
    if(!isMatch) {
      return res.status(400).json({ message: "Mật khẩu cũ không đúng." });
    }

    const hashedPassword = await bcrypt.hash(newPassword, 10);
    account.password_hash = hashedPassword;
    await account.save();
    res.json({ message: "Change password successfully."})

  } catch (error) {
    console.log(error);
    res.status(500).json({message: "SERVER ERROR: ", error: error.message });
  }
};

export const sendEmail = async (req, res) => {
  try {
    const { newEmail } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    const account = await Account.findById(user.account_id);
    if (!account) {
      return res.status(400).json({ success: false, message: "Account not found" });
    }

    const otp = (Math.floor(100000 + Math.random() * 900000)).toString();
    account.changeEmailOTP = otp;
    account.changeEmailOTPExpiresAt = Date.now() + 10 * 60 * 1000; // 10 minutes
    account.changeEmailAddress = newEmail;

    await account.save();
    await sendVerificationEmailUpdateProfile(newEmail, otp);

    res.json({ message: "Successfully send verification email for updating profile." });

  } catch (error) {
    res.status(500).json({ message: "SERVER ERROR: ", error: error.message });
  }
};

export const verifyEmail = async (req, res) => {
  try {
    const { otp } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(400).json({ success: false, message: "User not found" });
    }

    const account = await Account.findById(user.account_id).select("+password_hash");
    if (!account) {
      return res.status(400).json({ success: false, message: "Account not found" });
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