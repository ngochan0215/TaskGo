import { User, Account, Tasker, Customer, FavoriteTasker, Address } from "../models/index.js";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
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

// Favorite Tasker Controllers
export const addFavoriteTasker = async (req, res) => {
  try {
    const userId = req.userId;
    const { tasker_id, note } = req.body;

    if (!tasker_id)
      return res.status(400).json({ message: "Thiếu tasker_id" });

    if (!mongoose.isValidObjectId(tasker_id))
      return res.status(400).json({ message: "tasker_id không hợp lệ" });

    const existed = await FavoriteTasker.findOne({
      user_id: userId,
      tasker_id
    });

    if (existed)
      return res.status(409).json({
        message: "Tasker này đã nằm trong danh sách yêu thích"
      });

    const favorite = await FavoriteTasker.create({
      user_id: userId,
      tasker_id,
      note
    });

    return res.status(201).json({
      message: "Thêm tasker vào danh sách yêu thích thành công",
      data: favorite
    });

  } catch (error) {
    console.error(error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Tasker này đã nằm trong danh sách yêu thích"
      });
    }

    return res.status(500).json({
      message: "Lỗi server",
      error: error.message
    });
  }
};

export const removeFavoriteTasker = async (req, res) => {
  try {
    const userId = req.userId;
    const { tasker_id } = req.params;

    if (!mongoose.isValidObjectId(tasker_id))
      return res.status(400).json({ message: "tasker_id không hợp lệ" });

    const deleted = await FavoriteTasker.findOneAndDelete({
      user_id: userId,
      tasker_id
    });

    if (!deleted)
      return res.status(404).json({
        message: "Tasker này không nằm trong danh sách yêu thích"
      });

    return res.json({
      message: "Đã xóa tasker khỏi danh sách yêu thích"
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message
    });
  }
};

export const getMyFavoriteTaskers = async (req, res) => {
  try {
    const userId = req.userId;

    const favorites = await FavoriteTasker.find({ user_id: userId })
      .select("-__v -created_at -updated_at")
      .populate({
        path: "tasker_id",
        select: "-created_at -updated_at -__v",
      })
      .sort({ created_at: -1 });

    return res.json({
      total: favorites.length,
      data: favorites
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message
    });
  }
};

export const checkFavoriteTasker = async (req, res) => {
  const userId = req.userId;
  const { tasker_id } = req.params;

  const exists = await FavoriteTasker.exists({
    user_id: userId,
    tasker_id
  });

  res.json({ is_favorite: !!exists });
};

// Addresses Controllers 

const MAX_ADDRESS_PER_USER = 5;

export const addAddress = async (req, res) => {
  try {
    const userId = req.userId;

    const { label, longtitude, latitude, full_address,
      street, ward, district, city, note, is_default } = req.body;

    if ( longtitude === undefined || latitude === undefined || !full_address ||
      !street || !ward || !district || !city
    ) {
      return res.status(400).json({
        message: "Thiếu thông tin địa chỉ bắt buộc"
      });
    }

    if ( typeof longtitude !== "number" || typeof latitude !== "number" ) {
      return res.status(400).json({
        message: "Tọa độ không hợp lệ"
      });
    }

    if (is_default === true) {
      await Address.updateMany(
        { user_id: userId, is_default: true },
        { is_default: false }
      );
    }

    const addressCount = await Address.countDocuments({
      user_id: userId
    });

    if (addressCount >= MAX_ADDRESS_PER_USER) {
      return res.status(400).json({
        message: `Bạn chỉ được thêm tối đa ${MAX_ADDRESS_PER_USER} địa chỉ`
      });
    }

    const address = await Address.create({
      user_id: userId,
      label,
      longtitude,
      latitude,
      full_address,
      street,
      ward,
      district,
      city,
      note,
      is_default: addressCount === 0 ? true : !!is_default
    });

    return res.status(201).json({
      message: "Thêm địa chỉ thành công",
      data: address
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message
    });
  }
};

export const getMyAddresses = async (req, res) => {
  try {
    const userId = req.userId;

    const addresses = await Address.find({ user_id: userId })
      .sort({ is_default: -1, created_at: -1 });

    return res.json({
      total: addresses.length,
      data: addresses
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message
    });
  }
};

export const deleteAddress = async (req, res) => {
  try {
    const userId = req.userId;
    const { address_id } = req.params;

    if (!mongoose.isValidObjectId(address_id))
      return res.status(400).json({ message: "address_id không hợp lệ" });

    const address = await Address.findOne({
      _id: address_id,
      user_id: userId
    });

    if (!address)
      return res.status(404).json({
        message: "Không tìm thấy địa chỉ"
      });

    const wasDefault = address.is_default;

    await address.deleteOne();

    // Nếu xóa địa chỉ default thì set địa chỉ khác làm default
    if (wasDefault) {
      const anotherAddress = await Address.findOne({ user_id: userId })
        .sort({ created_at: 1 });

      if (anotherAddress) {
        anotherAddress.is_default = true;
        await anotherAddress.save();
      }
    }

    return res.json({
      message: "Xóa địa chỉ thành công"
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message
    });
  }
};

export const setDefaultAddress = async (req, res) => {
  try {
    const userId = req.userId;
    const { address_id } = req.params;

    if (!mongoose.isValidObjectId(address_id))
      return res.status(400).json({ message: "address_id không hợp lệ" });

    const address = await Address.findOne({
      _id: address_id,
      user_id: userId
    });

    if (!address)
      return res.status(404).json({
        message: "Không tìm thấy địa chỉ"
      });

    // Bỏ default tất cả địa chỉ khác
    await Address.updateMany(
      { user_id: userId, is_default: true },
      { is_default: false }
    );

    address.is_default = true;
    await address.save();

    return res.json({
      message: "Đặt địa chỉ mặc định thành công",
      data: address
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Lỗi server",
      error: error.message
    });
  }
};
