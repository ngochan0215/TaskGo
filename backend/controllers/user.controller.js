import { User, Account, Tasker, Customer, FavoriteTasker, Address, Review,
  FavoriteTask
} from "../models/index.js";
import bcrypt from "bcrypt";
import mongoose from "mongoose";
import { sendVerificationEmailUpdateProfile } from "../gmail/email.js";

export const getUserProfile = async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .select("-created_at -updated_at -__v");

    if (!user) {
      return res.status(400).json({ success: false, message: "Không tìm thấy người dùng!" });
    }

    const account = await Account.findById(user.account_id);
    if (!account) {
      return res.status(400).json({ success: false, message: "Không tìm thấy tài khoản!" });
    }

    // customer
    if (account.role === "customer") {
      const customer = await Customer.findOne({ user_id: user._id })
        .select("-__v -created_at -updated_at -user_id");

      if (!customer) {
        return res.status(400).json({ success: false, message: "Không tìm thấy khách hàng!" });
      }

      const reviewStats = await Review.aggregate([
        {
          $match: {
            reviewee_id: user._id,
            reviewee_role: "customer",
            status: "visible"
          }
        },
        {
          $group: {
            _id: "$reviewee_id",
            review_count: { $sum: 1 },
            average_rating: { $avg: "$rating" }
          }
        }
      ]);

      const reviewInfo = reviewStats.length
        ? {
            review_count: reviewStats[0].review_count,
            average_rating: Number(reviewStats[0].average_rating.toFixed(1))
          }
        : {
            review_count: 0,
            average_rating: 0
          };

      return res.status(200).json({
        success: true,
        user,
        account: {
          role: account.role,
          email: account.email
        },
        customer,
        reviews: reviewInfo
      });
    }

    // tasker
    if (account.role === "tasker") {
      const tasker = await Tasker.findOne({ user_id: user._id })
        .select("-__v -created_at -updated_at -user_id");

      if (!tasker) {
        return res.status(400).json({ success: false, message: "Không tìm thấy tasker!" });
      }

      const reviewStats = await Review.aggregate([
        {
          $match: {
            reviewee_id: user._id,
            reviewee_role: "customer",
            status: "visible"
          }
        },
        {
          $group: {
            _id: "$reviewee_id",
            review_count: { $sum: 1 },
            average_rating: { $avg: "$rating" }
          }
        }
      ]);

      const reviewInfo = reviewStats.length
        ? {
            review_count: reviewStats[0].review_count,
            average_rating: Number(reviewStats[0].average_rating.toFixed(1))
          }
        : {
            review_count: 0,
            average_rating: 0
          };

      return res.status(200).json({
        success: true,
        user,
        account: {
          role: account.role,
          email: account.email
        },
        tasker,
        reviews: reviewInfo
      });
    }

    return res.status(400).json({
      success: false,
      message: `Bạn là ${account.role}, không hợp lệ!`
    });

  } catch (error) {
    console.error("LỖI LẤY PROFILE USER:", error);
    return res.status(500).json({
      success: false,
      message: "LỖI SERVER: " + error.message
    });
  }
};

export const getAUserProfile = async (req, res) => {
  try {
    const { user_id } = req.body;

    const user = await User.findById(user_id).select("-created_at -updated_at -__v");
    if (!user) {
      return res.status(400).json({ success: false, message: "Không tìm thấy người dùng!" });
    }

    const account = await Account.findById(user.account_id);
    if (!account) {
      return res.status(400).json({ success: false, message: "Không tìm thấy tài khoản!" });
    }

    // customer
    if (account.role === "customer") {
      const customer = await Customer.findOne({ user_id: user._id })
        .select("-__v -created_at -updated_at -user_id");

      if (!customer) {
        return res.status(400).json({ success: false, message: "Không tìm thấy khách hàng!" });
      }

      const reviewStats = await Review.aggregate([
        {
          $match: {
            reviewee_id: user._id,
            reviewee_role: "customer",
            status: "visible"
          }
        },
        {
          $group: {
            _id: "$reviewee_id",
            review_count: { $sum: 1 },
            average_rating: { $avg: "$rating" }
          }
        }
      ]);

      const reviewInfo = reviewStats.length
        ? {
            review_count: reviewStats[0].review_count,
            average_rating: Number(reviewStats[0].average_rating.toFixed(1))
          }
        : {
            review_count: 0,
            average_rating: 0
          };

      return res.status(200).json({
        success: true,
        user,
        account: {
          role: account.role,
          email: account.email
        },
        customer,
        reviews: reviewInfo
      });
    }

    // tasker
    if (account.role === "tasker") {
      const tasker = await Tasker.findOne({ user_id: user._id })
        .select("-__v -created_at -updated_at -user_id");

      if (!tasker) {
        return res.status(400).json({ success: false, message: "Không tìm thấy tasker!" });
      }

      const reviewStats = await Review.aggregate([
        {
          $match: {
            reviewee_id: user._id,
            reviewee_role: "customer",
            status: "visible"
          }
        },
        {
          $group: {
            _id: "$reviewee_id",
            review_count: { $sum: 1 },
            average_rating: { $avg: "$rating" }
          }
        }
      ]);

      const reviewInfo = reviewStats.length
        ? {
            review_count: reviewStats[0].review_count,
            average_rating: Number(reviewStats[0].average_rating.toFixed(1))
          }
        : {
            review_count: 0,
            average_rating: 0
          };

      return res.status(200).json({
        success: true,
        user,
        account: {
          role: account.role,
          email: account.email
        },
        tasker,
        reviews: reviewInfo
      });
    }

    return res.status(400).json({
      success: false,
      message: `Bạn là ${account.role}, không hợp lệ!`
    });

  } catch (error) {
    console.error("LỖI LẤY PROFILE USER:", error);
    return res.status(500).json({
      success: false,
      message: "LỖI SERVER: " + error.message
    });
  }
};

export const updateCustomerProfile = async (req, res) => {
  try {
    const { full_name, phone_number, identification,
      BIN, account_number, bank_shortName } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(400).json({ success: false, message: "Không tìm thấy tài khoản người dùng!" });
    }

    const account = await Account.findById(user.account_id);
    if (!account) {
      return res.status(400).json({ success: false, message: "Không tìm thấy tài khoản!" });
    }

    const customer = await Customer.findOne({ user_id: user._id });
    if (!customer) {
      return res.status(400).json({ success: false, message: "Không tìm thấy tài khoản khách hàng!" });
    }

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

    if (BIN) {
      // const [binInCustomer, binInTasker] = await Promise.all([
      //   Customer.findOne({ BIN, _id: { $ne: customer._id } }),
      //   Tasker.findOne({ BIN }) // tasker khác customer, không cần $ne
      // ]);

      // if (binInCustomer || binInTasker) {
      //   return res.status(400).json({
      //     success: false,
      //     message: "Số thẻ ngân hàng đã được sử dụng."
      //   });
      // }

      customer.BIN = BIN;
    }

    if (account_number) {
      const [accountInTasker, accountInCustomer] = await Promise.all([
        Tasker.findOne({ account_number }),
        Customer.findOne({ account_number, _id: { $ne: customer._id } })
      ]);

      if (accountInCustomer || accountInTasker) {
        return res.status(400).json({
          success: false,
          message: "Số tài khoản ngân hàng đã được sử dụng."
        });
      }

      customer.account_number = account_number;
    }

    if (bank_shortName !== undefined) {
      customer.bank_shortName = bank_shortName || null;
    }

    await customer.save();

    return res.status(200).json({ success: true, message: "Cập nhật thông tin cá nhân thành công." });

  } catch (error) {
    console.error("Update user profile error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};

export const updateTaskerProfile = async (req, res) => {
  try {
    const { full_name, phone_number, identification,
      introduction, working_area, working_radius, BIN, account_number, bank_shortName, skills
     } = req.body;

    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(400).json({ success: false, message: "Không tìm thấy tài khoản người dùng của tasker!" });
    }

    const account = await Account.findById(user.account_id);
    if (!account) {
      return res.status(400).json({ success: false, message: "Không tìm thấy tài khoản!" });
    }

    const tasker = await Tasker.findOne({ user_id: user._id });
    if (!tasker) {
      return res.status(400).json({ success: false, message: "Không tìm thấy tasker!" });
    }

    if (phone_number) {
      const phoneExists = await User.findOne({ phone_number, _id: { $ne: user._id } });
      if (phoneExists) {
        return res.status(400).json({
          success: false,
          message: "Số điện thoại đã được sử dụng."
        });
      }

      user.phone_number = phone_number;
    }

    if (identification) {
      const idExists = await User.findOne({ identification, _id: { $ne: user._id } });
      if (idExists) {
        return res.status(400).json({
          success: false,
          message: "CCCD đã được sử dụng."
        });
      }

      user.identification = identification;
    }

    if (full_name) user.full_name = full_name;
    await user.save();

    if (introduction) tasker.introduction = introduction;
    if (working_area) tasker.working_area = working_area;
    if (working_radius) tasker.working_radius = working_radius;
    if (skills) tasker.skills = skills;

    if (BIN) {
      // const [binInTasker, binInCustomer] = await Promise.all([
      //   Tasker.findOne({ BIN, _id: { $ne: tasker._id } }),
      //   Customer.findOne({ BIN })
      // ]);

      // if (binInCustomer || binInTasker) {
      //   return res.status(400).json({
      //     success: false,
      //     message: "Số thẻ ngân hàng đã được sử dụng."
      //   });
      // }

      tasker.BIN = BIN;
    }

    if (account_number) {
      const [accountInTasker, accountInCustomer] = await Promise.all([
        Tasker.findOne({ account_number, _id: { $ne: tasker._id } }),
        Customer.findOne({ account_number })
      ]);

      if (accountInCustomer || accountInTasker) {
        return res.status(400).json({
          success: false,
          message: "Số tài khoản ngân hàng đã được sử dụng."
        });
      }

      tasker.account_number = account_number;
    }

    if (bank_shortName !== undefined) {
      tasker.bank_shortName = bank_shortName || null;
    }
    
    await tasker.save();

    return res.status(200).json({ success: true, message: "Cập nhật thông tin cá nhân thành công!" });

  } catch (error) {
    console.error("Update user profile error:", error);
    res.status(500).json({ success: false, message: "Internal Server Error" + error.message });
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

// Favorite Task Controllers
export const addFavoriteTask = async (req, res) => {
  try {
    const userId = req.userId;
    const { task_id, note } = req.body;

    if (!task_id)
      return res.status(400).json({ message: "Thiếu task_id" });

    if (!mongoose.isValidObjectId(task_id))
      return res.status(400).json({ message: "task_id không hợp lệ" });

    const existed = await FavoriteTask.findOne({
      user_id: userId,
      task_id
    });

    if (existed)
      return res.status(409).json({
        message: "Task này đã nằm trong danh sách dịch vụ yêu thích"
      });

    const favorite = await FavoriteTask.create({
      user_id: userId,
      task_id,
      note
    });

    return res.status(201).json({
      message: "Thêm dịch vụ vào danh sách yêu thích thành công",
      data: favorite
    });

  } catch (error) {
    console.error(error);

    if (error.code === 11000) {
      return res.status(409).json({
        message: "Dịch vụ này đã nằm trong danh sách yêu thích"
      });
    }

    return res.status(500).json({ message: "Lỗi server" + error.message });
  }
};

export const removeFavoriteTask = async (req, res) => {
  try {
    const userId = req.userId;
    const { task_id } = req.params;

    if (!mongoose.isValidObjectId(task_id))
      return res.status(400).json({ message: "task_id không hợp lệ" });

    const deleted = await FavoriteTask.findOneAndDelete({
      user_id: userId,
      task_id
    });

    if (!deleted)
      return res.status(404).json({
        message: "Dịch vụ này không nằm trong danh sách yêu thích"
      });

    return res.json({
      message: "Đã xóa dịch vụ khỏi danh sách yêu thích"
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Lỗi server" + error.message });
  }
};

export const getMyFavoriteTasks = async (req, res) => {
  try {
    const userId = req.userId;

    // Lấy danh sách favorite task của người dùng
    const favorites = await FavoriteTask.find({ user_id: userId })
      .select("-__v -created_at -updated_at")
      .populate({
        path: "task_id",
        select: "-__v -updated_at -created_at",
      })
      .sort({ created_at: -1 });

    if (!favorites.length) {
      return res.json({
        total: 0,
        data: []
      });
    }

    return res.json({
      total: favorites.length,
      data: favorites
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Lỗi server" + error.message });
  }
};

export const checkFavoriteTask = async (req, res) => {
  const userId = req.userId;
  const { task_id } = req.params;

  const exists = await FavoriteTask.exists({
    user_id: userId,
    task_id
  });

  res.json({ is_favorite: !!exists });
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

    // Lấy danh sách favorite tasker (tasker_id = User của tasker)
    const favorites = await FavoriteTasker.find({ user_id: userId })
      .select("-__v -created_at -updated_at")
      .populate({
        path: "tasker_id",
        select: "-__v -updated_at -created_at", // user info
      })
      .sort({ created_at: -1 });

    if (!favorites.length) {
      return res.json({
        total: 0,
        data: []
      });
    }

    // Lấy danh sách user_id của tasker
    const taskerUserIds = favorites
      .filter(f => f.tasker_id)
      .map(f => f.tasker_id._id);

    // Query bảng Tasker
    const taskers = await Tasker.find({
      user_id: { $in: taskerUserIds }
    }).select("-__v -created_at -updated_at");

    // Aggregate reviews cho các tasker
    const reviewsStats = await Review.aggregate([
      {
        $match: {
          reviewee_id: { $in: taskerUserIds },
          reviewee_role: "tasker",
          status: "visible"
        }
      },
      {
        $group: {
          _id: "$reviewee_id",
          review_count: { $sum: 1 },
          average_rating: { $avg: "$rating" }
        }
      }
    ]);

    const reviewMap = new Map(
      reviewsStats.map(r => [
        r._id.toString(),
        {
          review_count: r.review_count,
          average_rating: Number(r.average_rating.toFixed(1))
        }
      ])
    );

    // Merge Tasker + User + Favorite metadata
    const result = favorites.map(fav => 
    { 
      const taskerUserId = fav.tasker_id._id.toString();

      const taskerProfile = taskers.find(t => t.user_id.toString() === taskerUserId);

      const reviewStat = reviewMap.get(taskerUserId) || {
        review_count: 0,
        average_rating: 0
      };

      return {
        favorite_id: fav._id,
        favorited_at: fav.created_at,
        user: fav.tasker_id,      
        tasker: taskerProfile,     
        reviews: reviewStat
      };
    });

    return res.json({
      total: result.length,
      data: result
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

    const { user_id, label, longitude, latitude, full_address,
      street, ward, district, city, note, is_default } = req.body;

    const userId = req.userId? req.userId : user_id;

    if ( longitude === undefined || latitude === undefined || !full_address ||
      !street || !ward || !district || !city
    ) {
      return res.status(400).json({
        message: "Thiếu thông tin địa chỉ bắt buộc"
      });
    }

    if ( typeof longitude !== "number" || typeof latitude !== "number" ) {
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
      longitude,
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

    return res.status(200).json({
      total: addresses.length,
      data: addresses
    });

  } catch (error) {
    console.error(error);
    return res.status(500).json({
      message: "Lỗi server" + error.message
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


// TODO: viết hàm trả về các dịch vụ thường được khách hàng đặt
export const getUserPoints = async (req, res) => {
  try {
    const userId = req.userId;
    const user = await User.findById(userId).select("reputation_score");
    if (!user) {
      throw new Error("Không tìm thấy người dùng.");
    }

    res.json({
      success: true,
      points: user.reputation_score
    });

  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message,
    });
  }
}