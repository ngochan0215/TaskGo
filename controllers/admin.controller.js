import User from "../models/users.js";
import Account from "../models/accounts.js";
import Tasker from "../models/taskers.js";
import Customer from "../models/customers.js";

// Show all taskers in the system along with their information
export const getAllTaskers = async (req, res) => {
  try {
    const taskers = await Tasker.find()
      .select("-__v")
      .populate({
        path: "user_id",
        select: "-_id",
        populate: {
          path: "account_id",
          select: "email status -_id",
        },
      });

    res.status(200).json(taskers);
  } catch (error) {
    res.status(500).json({ message: "SERVER ERROR", error: error.message });
  }
};

// Show all customers in the system along with their information
export const getAllCustomers = async (req, res) => {
  try {
    const customers = await Customer.find()
      .select("-__v")
      .populate({
        path: "user_id",
        select: "-_id",
        populate: {
          path: "account_id",
          select: "email status -_id",
        },
      });

    res.status(200).json(customers);
  } catch (error) {
    res.status(500).json({ message: "SERVER ERROR", error: error.message });
  }
};

// Update tasker profile, includes: Lương cơ bản, tình trạng tài khoản, tình trạng làm việc
export const updateTaskerProfile = async (req, res) => {
  try {
    const { taskerId } = req.params;
    const { hourly_rate, account_status, tasker_status } = req.body;
    // account status là tình trạng tài khoản: bị ban....
    // tasker_status là tình trạng làm việc: còn làm hay đã nghỉ làm

    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Access denied: admin only" });
    }

    const tasker = await Tasker.findById(taskerId);
    if (!tasker) {
      return res.status(404).json({ message: "Tasker not found." });
    }

    // validation a bit
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
    res.status(500).json({ message: "SERVER ERROR: ", error: error.message });
  }
};

// Các hàm liên quan tới order: getAllOrders, updateOrderById, deleteOrderById
// List orders with optional filters (customer_id, tasker_id, status) and pagination
export const getAllOrders = async (req, res) => {
  try {
    const { customer_id, tasker_id, status, page = 1, limit = 50 } = req.query;
    const q = {};
    if (customer_id) q.customer_id = customer_id;
    if (tasker_id) q.tasker_id = tasker_id;
    if (status) q.status = status;
    const skip = (Number(page) - 1) * Number(limit);
    const orders = await Order.find(q)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit))
      .lean();
    return res.status(200).json({ success: true, orders });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
  }
};

// Delete order
export const deleteOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findByIdAndDelete(id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order not found." });
    return res
      .status(200)
      .json({ success: true, message: "Delete order successfully." });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
  }
};
