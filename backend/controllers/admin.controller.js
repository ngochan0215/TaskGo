import { User, Account, Tasker, Customer } from "../models/index.js";
import mongoose from "mongoose";

export const getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.find()
      .select("-__v")
      .populate({
        path: "user_id",
        populate: {
          path: "account_id",
          select: "email status",
        },
      });

    res.status(200).json(customers);
  } catch (error) {
    res.status(500).json({ message: "SERVER ERROR", error: error.message });
  }
};

export const getAllTaskers = async (req, res) => {
  try {
    const {
      status,
      working_status,
      account_status,
      search,
      sort_by = "created_at",
      sort_dir = "desc",
      page = 1,
      limit = 10
    } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (working_status) filter.working_status = working_status;

    // Search by name
    if (search) {
      const users = await User.find({
        full_name: { $regex: search, $options: "i" }
      }).select("_id");
      const userIds = users.map(u => u._id);
      if (userIds.length > 0) {
        filter.user_id = { $in: userIds };
      } else {
        // No users found, return empty result
        return res.status(200).json({
          success: true,
          page: Number(page),
          limit: Number(limit),
          total: 0,
          data: []
        });
      }
    }

    // Build query
    let query = Tasker.find(filter)
      .select("-__v")
      .populate({
        path: "user_id",
        select: "full_name phone_number identification avatar_url",
        populate: {
          path: "account_id",
          select: "email status is_verified",
        },
      });

    const taskers = await query
      .sort({ [sort_by]: sort_dir === "desc" ? -1 : 1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    // Filter by account status after populate
    let filteredTaskers = taskers;
    if (account_status) {
      filteredTaskers = taskers.filter(t => 
        t.user_id && t.user_id.account_id && t.user_id.account_id.status === account_status
      );
    }

    // Count total (need to handle account_status filter separately)
    let totalQuery = Tasker.find(filter);
    if (account_status) {
      // For account_status, we need to count after populate, so we'll do a simpler approach
      const allTaskers = await Tasker.find(filter)
        .select("user_id")
        .populate({
          path: "user_id",
          select: "account_id",
          populate: {
            path: "account_id",
            select: "status",
          },
        });
      const total = allTaskers.filter(t => 
        t.user_id && t.user_id.account_id && t.user_id.account_id.status === account_status
      ).length;
      return res.status(200).json({
        success: true,
        page: Number(page),
        limit: Number(limit),
        total,
        data: filteredTaskers
      });
    }

    const total = await Tasker.countDocuments(filter);

    res.status(200).json({
      success: true,
      page: Number(page),
      limit: Number(limit),
      total,
      data: filteredTaskers
    });
  } catch (error) {
    res.status(500).json({ message: "SERVER ERROR", error: error.message });
  }
};

export const updateTaskerProfile = async (req, res) => {
  try {
    const { taskerId } = req.params;
    const { hourly_rate, account_status, tasker_status } = req.body;
    // account status là tình trạng tài khoản: bị ban....
    // tasker_status là tình trạng làm việc: còn làm hay đã nghỉ làm

    console.log("req user: ", req.system_role);  
    if (req.system_role !== "admin") {
      return res.status(403).json({ message: "Access denied: admin only" });
    }

    const tasker = await Tasker.findById(taskerId);
    if (!tasker) {
      return res.status(404).json({ message: "Tasker not found." });
    }

    if (hourly_rate !== undefined) {
      if (typeof hourly_rate !== "number" || hourly_rate < 0) {
        return res.status(400).json({ message: "Invalid hourly_rate value." });
      }
      tasker.hourly_rate = hourly_rate;
    }

    if (tasker_status !== undefined) {
      tasker.working_status = tasker_status;
    }

    if (account_status !== undefined) {
      const user = await User.findById(tasker.user_id);
      if (!user) {
        return res
          .status(404)
          .json({ message: "User linked to Tasker not found." });
      }

      const account = await Account.findById(user.account_id);
      if (!account) {
        return res
          .status(404)
          .json({ message: "Account linked to User not found." });
      }

      // update account status
      account.status = account_status;
      await account.save();
    }

    const updatedTasker = await tasker.save();
    res.status(200).json({
      success: true,
      message: "Tasker updated successfully",
      tasker: updatedTasker,
    });
  } catch (error) {
    res.status(500).json({ message: "SERVER ERROR: " + error.message });
  }
};

export const approveTasker = async (req, res) => {
  try {
    const { taskerId } = req.params;

    const tasker = await Tasker.findById(taskerId).populate("user_id");
    if (!tasker) return res.status(404).json({ message: "Tasker not found" });

    tasker.status = "working";        
    tasker.working_status = "available";
    await tasker.save();

    await Account.updateOne(
      { user_id: tasker.user_id._id },
      { status: "active" }
    );

    res.json({ message: "Tasker approved successfully" });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error });
  }
};

export const rejectTasker = async (req, res) => {
  const { taskerId } = req.params;

  await Tasker.findByIdAndUpdate(taskerId, {
    status: "pending",
    working_status: "inactive",
  });

  await Account.updateOne(
      { user_id: tasker.user_id._id },
      { status: "inactive" }
    );

  res.json({ message: "Tasker rejected and kept inactive" });
};

export const banCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findById(customerId).populate("user_id");
    if (!customer) 
      return res.status(404).json({ message: "Không tìm thấy khách hàng." });

    const account = await Account.findOne({ user_id: customer.user_id });
    if (!account) 
      return res.status(404).json({ message: "Không tìm thấy tài khoản khách hàng." });

    account.status = "suspended";        
    await account.save();

    res.json({ message: "Ban tài khoản khách hàng thành công." });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error });
  }
};

export const unbanCustomer = async (req, res) => {
  try {
    const { customerId } = req.params;

    const customer = await Customer.findById(customerId).populate("user_id");
    if (!customer) 
      return res.status(404).json({ message: "Không tìm thấy khách hàng." });

    const account = await Account.findOne({ user_id: customer.user_id });
    if (!account) 
      return res.status(404).json({ message: "Không tìm thấy tài khoản khách hàng." });

    if (account.status !== "suspended") 
      return res.status(404).json({ message: "Tài khoản khách hàng đang không ở trạng thái bị ban." });

    account.status = "active";        
    await account.save();

    res.json({ message: "Gỡ ban tài khoản khách hàng thành công." });

  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Server error", error });
  }
};

