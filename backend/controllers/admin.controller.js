import { User, Account, Tasker, Customer } from "../models/index.js";

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
