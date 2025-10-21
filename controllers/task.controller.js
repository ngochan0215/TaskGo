
// Controller xử lí các công việc liên quan đến task gồm:
// - Tạo/ cập nhật/ xóa Service (category)
// - Tạo/ lấy/ cập nhật/ xóa Task trong một Service
// Toàn bộ những công việc này chỉ ADMIN được phép làm
// Các hàm trả về JSON và có validate cơ bản


import Service from "../models/services.js";
import Task from "../models/tasks.js";

// Create a new service (category)
export const createService = async (req, res) => {
	try {
		const { category_name, description } = req.body;
		if (!category_name || !description) return res.status(400).json({ success: false, message: "Data required." });

		const existing = await Service.findOne({ category_name });
		if (existing) return res.status(400).json({ success: false, message: "Service (category) already exists." });

		const s = new Service({ category_name, description });
		await s.save();
		return res.status(201).json({ success: true, service: s });
	} catch (err) {
		console.error(err);
    	return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

// Update a service (category)
export const updateService = async (req, res) => {
	try {
		const { id } = req.params;
		const { category_name, description } = req.body;
		const service = await Service.findById(id);
		if (!service) return res.status(404).json({ success: false, message: "Service not found." });

		if (category_name) service.category_name = category_name;
		if (description) service.description = description;

		await service.save();
		return res.status(200).json({ success: true, service });
	} catch (err) {
		console.error(err);
	    return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

// Delete a service. By default, prevent deletion if tasks exist under it.
// There will be a pop-up form to ensure ADMIN's operation.
// Pass query ?force=true to delete tasks together with service.
export const deleteService = async (req, res) => {
	try {
		const { id } = req.params;
		const force = req.query?.force === 'true';

		const service = await Service.findById(id);
		if (!service) return res.status(404).json({ success: false, message: "Service not found." });

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

// Create a new task under a service
export const createTask = async (req, res) => {
	try {
		const { service_id, task_name, description, pricing } = req.body;
		if (!service_id || !task_name || !description) return res.status(400).json({ success: false, message: "Data required." });

		// validate service exists
		const svc = await Service.findById(service_id);
		if (!svc) return res.status(404).json({ success: false, message: "Service not found." });

		const existing = await Task.findOne({ service_id, task_name });
		if (existing) return res.status(400).json({ success: false, message: "Task already exists for this service." });

		const task = new Task({ service_id, task_name, description, pricing });
		await task.save();
		return res.status(201).json({ success: true, task });

	} catch (err) {
		console.error(err);
    	return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

// Get a single task by id
export const getTaskById = async (req, res) => {
	try {
		const { id } = req.params;
		const task = await Task.findById(id).lean();
		if (!task) return res.status(404).json({ success: false, message: "Task not found." });
		return res.status(200).json({ success: true, task });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ success: false, message: "Lỗi server" });
	}
};

// List tasks optionally filtered by service_id, with pagination
export const listTasks = async (req, res) => {
	try {
		const { serviceId, page = 1, limit = 50 } = req.query;
		const q = {};
		if (serviceId) q.service_id = serviceId;
		const skip = (Number(page) - 1) * Number(limit);
		const tasks = await Task.find(q).sort({ createdAt: -1 }).skip(skip).limit(Number(limit)).lean();
		return res.status(200).json({ success: true, tasks });
	} catch (err) {
		console.error(err);
		return res.status(500).json({ success: false, message: "Lỗi server" });
	}
};

// Update a task
export const updateTask = async (req, res) => {
	try {
		const { id } = req.params;
		const { task_name, description, pricing } = req.body;

		const task = await Task.findById(id);
		if (!task) return res.status(404).json({ success: false, message: "Task not found." });

		if(!task_name) task.task_name = task_name;
		if (!description) task.description = description;
		if (!pricing) task.pricing = pricing;

		await task.save();
		return res.status(200).json({ success: true, task });

	} catch (err) {
		console.error(err);
    	return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};

// Delete a task, will ensure ADMIN's operation one more time
export const deleteTask = async (req, res) => {
	try {
		const { id } = req.params;

		const task = await Task.findByIdAndDelete(id);
		if (!task) return res.status(404).json({ success: false, message: "Task not found." });

		return res.status(200).json({ success: true, message: "Delete task successfully." });

	} catch (err) {
		console.error(err);
    	return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
	}
};
