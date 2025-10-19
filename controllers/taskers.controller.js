import { acceptTaskRequest, confirmDepartureTask, denyTaskRequest } from "../services/taskers.service.js";

export const acceptTask = async (req, res) =>{
    const {  orderId } = req.params;
    try {
        await acceptTaskRequest(req.userId, orderId);
        //TODO: send notification to customer
        res.status(200).json({ message: "Order accepted successfully" });
    }
    catch (error) {
        res.status(400).json({ message: "Failed to accept order", error: error.message });
    }
}

export const confirmDeparture = async (req, res) =>{
    const {  orderId } = req.params;
    try {
        await confirmDepartureTask(req.userId, orderId);
        //TODO: send notification to customer
        res.status(200).json({ message: "Tasker confirm departure successfully" });
    }
    catch (error) {
        res.status(400).json({ message: "Failed to confirm departure", error: error.message });
    }
}
export const denyTask = async (req, res) =>{
    const {  orderId } = req.params;
    try {
        const newTasker = await denyTaskRequest(req.userId, orderId);
        //TODO: send notification to customer and newTasker
        res.status(200).json({ message: "Order denied and assign task to another tasker successfully" });
    }
    catch (error) {
        res.status(400).json({ message: "Failed to deny order", error: error.message });
    }
}