import express from "express";
import {
	createService,
	createTask,
	getTaskById,
    updateService,
    deleteService,
	getAllTasks,
	updateTask,
	deleteTask,
	getAllServices
} from "../controllers/task.controller.js";
import { isAdmin } from "../middleware/verifyRole.js";
import { verifyToken } from "../middleware/verifyToken.js";

const router = express.Router();

// admin manage service category
router.post('/service/new', verifyToken, isAdmin, createService);
router.patch('/service/update/:id', verifyToken, isAdmin, updateService);
router.delete('/service/delete/:id', verifyToken, isAdmin, deleteService);

// admin manage tasks
router.post('/task/new', verifyToken, isAdmin, createTask);
router.patch('/task/update/:id', verifyToken, isAdmin, updateTask);
router.delete('/task/delete/:id', verifyToken, isAdmin, deleteTask);

// users can see all tasks and services
router.get('/task', verifyToken, getAllTasks);
router.get('/task/:id', verifyToken, getTaskById);
router.get('/service', verifyToken, getAllServices);

export default router;