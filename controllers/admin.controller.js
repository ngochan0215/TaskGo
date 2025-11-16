import { User, Account, Tasker, Customer } from "../models/index.js";

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

