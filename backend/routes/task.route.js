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
	getAllServices,
	activateService,
	getServiceById,
	unactivateService,
	getUserFavoriteTasks,
	getTopPopularTasks,
	updateServiceAvatar,
	updateTaskAvatar
} from "../controllers/task.controller.js";
import { isAdmin } from "../middleware/verifyRole.js";
import { verifyToken } from "../middleware/verifyToken.js";
import uploadServiceAvatar from "../middleware/uploadServiceAvatar.js";
import uploadTaskAvatar from "../middleware/uploadTaskAvatar.js";

const router = express.Router();

// admin manage service category
router.post('/service/new', verifyToken, isAdmin, createService);
router.patch('/service/update/:id', verifyToken, isAdmin, updateService);
router.patch('/service/activate/:id', verifyToken, isAdmin, activateService);
router.patch('/service/unactivate/:id', verifyToken, isAdmin, unactivateService);
router.delete('/service/delete/:id', verifyToken, isAdmin, deleteService);
router.put('/service/update-avatar/:id', verifyToken, isAdmin, uploadServiceAvatar.single("avatar"), updateServiceAvatar);

// admin manage tasks
router.post('/new', verifyToken, isAdmin, createTask);
router.patch('/update/:id', verifyToken, isAdmin, updateTask);
router.delete('/delete/:id', verifyToken, isAdmin, deleteTask);
router.put('/update-avatar/:id', verifyToken, isAdmin, uploadTaskAvatar.single("avatar"), updateTaskAvatar);

// users can see all tasks and services
router.get('/all', getAllTasks);
router.get('/service/all', verifyToken, getAllServices);
router.get('/service/:id', verifyToken, getServiceById);

// Popular and favorite tasks (must be before /:id route)
router.get("/favorite/by-user", verifyToken, getUserFavoriteTasks);
router.get("/top-popular/by-orders", getTopPopularTasks);

router.get('/:id', verifyToken, getTaskById);

export default router;