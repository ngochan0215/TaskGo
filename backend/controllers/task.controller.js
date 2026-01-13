import { Service, Task, Order } from "../models/index.js";
import mongoose from "mongoose";

//---- SERVICE ----//
export const createService = async (req, res) => {
	try {
		const { category_name, description } = req.body;
		if (!category_name || !description) 
			return res.status(400).json({ success: false, message: "Data required." });

		const existing = await Service.findOne({ category_name });
		if (existing) 
			return res.status(400).json({ success: false, message: "Service (category) already exists." });

		const s = new Service({ category_name, description });
		await s.save();

		return res.status(201).json({ success: true, service: s });

	} catch (err) {
		console.error(err);
    	return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

export const updateService = async (req, res) => {
	try {
		const { id } = req.params;
		const { category_name, description } = req.body;

		const service = await Service.findById(id);
		if (!service) 
			return res.status(404).json({ success: false, message: "Service not found." });

		if (category_name) service.category_name = category_name;
		if (description) service.description = description;

		await service.save();
		return res.status(200).json({ success: true, service });

	} catch (err) {
		console.error(err);
	    return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

// khi mới tạo service mặc định là đang phát triển, admin cần kích hoạt để sử dụng
export const activateService = async (req, res) => {
	try {
		const { id } = req.params;

		const service = await Service.findById(id);
		if (!service) 
			return res.status(404).json({ success: false, message: "Service not found." });

		service.status = "active";

		await Task.updateMany(
			{ service_id: service._id },
			{ $set: { status: "active" } }
		);

		await service.save();
		return res.status(200).json({ success: true, service });

	} catch (err) {
		console.error(err);
	    return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

// hủy cung cấp dịch vụ, nhưng vẫn lưu trong DB
export const unactivateService = async (req, res) => {
	try {
		const { id } = req.params;

		const service = await Service.findById(id);
		if (!service) 
			return res.status(404).json({ success: false, message: "Service not found." });

		service.status = "inactive";
		await Task.updateMany(
			{ service_id: service._id },
			{ $set: { status: "inactive" } }
		);

		await service.save();
		return res.status(200).json({ success: true, service });

	} catch (err) {
		console.error(err);
	    return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

// Pass query ?force=true to delete tasks together with service.
export const deleteService = async (req, res) => {
	try {
		const { id } = req.params;
		const force = req.query?.force === 'true';

		const service = await Service.findById(id);
		if (!service) 
			return res.status(404).json({ success: false, message: "Service not found." });

		const relatedTasksCount = await Task.countDocuments({ service_id: id });
		if (relatedTasksCount > 0 && !force) {
			return res.status(400).json({ success: false, message: `Service has ${relatedTasksCount} tasks. Use ?force=true to delete all related tasks.` });
		}

		if (force) {
			await Task.deleteMany({ service_id: id });
		}

		await Service.findByIdAndDelete(id);
		return res.status(200).json({ success: true, message: "Delete service successfully." });

	} catch (err) {
		console.error(err);
	    return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

// Get all services (optionally paginated)
export const getAllServices = async (req, res) => {
	try {
		const { page = 1, limit = 50, search, status, task_status } = req.query;
		const q = {};
		if (search) {
			q.category_name = { $regex: search, $options: 'i' };
		}
		if (status) {
			q.status = status;
		}

		const skip = (Number(page) - 1) * Number(limit);
		const services = await Service.find(q)
			.select("-__v -createdAt -updatedAt")
			.populate({
				path: "tasks", 
				match: { status: task_status },
				select: "-__v -createdAt -updatedAt",
				options: { sort: { createdAt: -1 } },
			})
			.sort({ createdAt: -1 })
			.skip(skip)
			.limit(Number(limit))
			.lean();

		const total = await Service.countDocuments(q);
		return res.status(200).json({
			success: true,
			total,
			page: Number(page),
			limit: Number(limit),
			services
		});

	} catch (err) {
		console.error(err);
		return res.status(500).json({ success: false, message: "SERVER ERROR:", error: err.message });
	}
};

export const getServiceById = async (req, res) => {
  try {
    const { id } = req.params;

    const service = await Service.findById(id)
	  .select("-__v -createdAt -updatedAt -id")
      .populate({
        path: "tasks",
        select: "task_name description pricing unit status",
        options: { sort: { createdAt: -1 } }
      });

    if (!service) {
      return res.status(404).json({
        success: false,
        message: "Service not found"
      });
    }

    return res.status(200).json({
      success: true,
      data: service
    });
  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "SERVER ERROR",
      err: err.message
    });
  }
};

//---- TASK ----//
export const createTask = async (req, res) => {
	try {
		const { service_id, task_name, description, pricing, task_type } = req.body;
		let status = "launching";

		if (!service_id || !task_name || !description || !pricing) 
			return res.status(400).json({ success: false, message: "Data required." });

		const svc = await Service.findById(service_id);
		if (!svc) 
			return res.status(404).json({ success: false, message: "Service not found." });

		if (svc.status !== "active")
			return res.status(400).json({ success: false, message: "Cannot add task to inactive service." });
		else if (svc.status === "active")
			status = "active";
		
		const existing = await Task.findOne({ service_id, task_name });
		if (existing) 
			return res.status(400).json({ success: false, message: "Task already exists for this service." });

		const task = new Task({ service_id, task_name, description, pricing, task_type, status });
		await task.save();
		return res.status(201).json({ success: true, task });

	} catch (err) {
		console.error(err);
    	return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

export const getTaskById = async (req, res) => {
	try {
		const { id } = req.params;

		const task = await Task.findById(id).select("-__v -createdAt -updatedAt").lean();
		if (!task) 
			return res.status(404).json({ success: false, message: "Task not found." });

		return res.status(200).json({ success: true, task });

	} catch (err) {
		console.error(err);
    	return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

// List tasks optionally filtered by service_id, with pagination
export const getAllTasks = async (req, res) => {
	try {
		const { serviceId, status, page = 1, limit = 50 } = req.query;
		const q = {};

		if (serviceId) q.service_id = serviceId;
		if (status) q.status = status;

		const skip = (Number(page) - 1) * Number(limit);
		const tasks = await Task.find(q)
			.select("-__v -createdAt -updatedAt")
			.sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();

		return res.status(200).json({ success: true, tasks });

	} catch (err) {
		console.error(err);
    	return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

export const updateTask = async (req, res) => {
	try {
		const { id } = req.params;
		const { task_name, description, pricing, status, task_type } = req.body;

		const task = await Task.findById(id);
		if (!task) 
			return res.status(404).json({ success: false, message: "Task not found." });

		if(task_name) task.task_name = task_name;
		if (description) task.description = description;
		if (pricing) task.pricing = pricing;
		if (task_type) task.task_type = task_type;

		if (status && status !== 'inactive') {
			return res.status(400).json({ success: false, message: "You can only update task's status to inactive." });
		}

		await task.save();
		return res.status(200).json({ success: true, task });

	} catch (err) {
		console.error(err);
    	return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

export const deleteTask = async (req, res) => {
	try {
		const { id } = req.params;

		const task = await Task.findByIdAndDelete(id);
		if (!task) 
			return res.status(404).json({ success: false, message: "Task not found." });

		return res.status(200).json({ success: true, message: "Delete task successfully." });

	} catch (err) {
		console.error(err);
    	return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

// viết hàm lấy các dịch vụ thường được sử dụng dựa trên lịch sử đơn hàng của user
export const getUserFavoriteTasks = async(req, res) => {
  try {
    const limit = 5;
    const customerId = req.userId;

    return Order.aggregate([
    // chỉ lấy đơn của user + đã hoàn thành
    {
      $match: {
        customer_id: new mongoose.Types.ObjectId(customerId),
        status: "completed"
      }
    },

    // group theo task
    {
      $group: {
        _id: "$task_id",
        total_orders: { $sum: 1 },
        task_name: { $first: "$task_snapshot.name" }
      }
    },

    // sort theo số lần đặt
    {
      $sort: { total_orders: -1 }
    },

    // giới hạn
    {
      $limit: limit
    },

    // format
    {
      $project: {
        _id: 0,
        task_id: "$_id",
        task_name: 1,
        total_orders: 1
      }
    }
  ]);
  } catch (error) {
    console.error("GET USER FAVORITE TASKS ERROR:", error.message);
    return res.status(500).json({ success: false, message: "SERVER ERROR: " + error.message });
  }
}

// top 5 dịch vụ phổ biến nhất
export const getTopPopularTasks = async(req, res) => {
  try {
    const limit = 5;
    return Order.aggregate([
      // chỉ lấy đơn đã hoàn thành
      {
        $match: {
          status: "completed"
        }
      },

      // group theo task
      {
        $group: {
          _id: "$task_id",
          total_orders: { $sum: 1 },
          task_name: { $first: "$task_snapshot.name" }
        }
      },

      // sắp xếp giảm dần theo số lần đặt
      {
        $sort: { total_orders: -1 }
      },

      // lấy top N
      {
        $limit: limit
      },

      // format output
      {
        $project: {
          _id: 0,
          task_id: "$_id",
          task_name: 1,
          total_orders: 1
        }
      }
    ]);
  } catch (error) {
    console.error("GET POPULAR TASKS ERROR:", error.message);
    return res.status(500).json({ success: false, message: "SERVER ERROR: " + error.message });
  }
}