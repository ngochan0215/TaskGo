import express from "express";
import {
	createService,
	createTask,
	getTaskById,
    updateService,
    deleteService,
	listTasks,
	updateTask,
	deleteTask,
} from "../controllers/task.controller.js";

const router = express.Router();

// Service (category)
router.post('/service', createService);
router.patch('/service/:id', updateService);
router.delete('/service/:id', deleteService);

// Tasks
router.post('/', createTask);
router.get('/', listTasks);
router.get('/:id', getTaskById);
router.patch('/:id', updateTask);
router.delete('/:id', deleteTask);

export default router;