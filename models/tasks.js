import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
    {
        service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true }, 
        task_name: {type: String, required: true, trim: true},
        description: {type: String, required: true, trim: true},
        fee_perhour: {type: Number, default: 0},
    }
);

const Task = mongoose.models.Task || mongoose.model("Task", taskSchema);

export default Task;