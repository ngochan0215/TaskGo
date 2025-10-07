import mongoose from "mongoose";

const taskSchema = new mongoose.Schema(
    {
        service_id: { type: mongoose.Schema.Types.ObjectId, ref: 'Service', required: true }, 
        task_name: {type: String, required: true, trim: true},
        description: {type: String, required: true, trim: true},
        pricing: {
            unit: { type: String, enum: ['hour', 'job'], default: 'hour' },
            amount: { type: Number, default: 0 },
        }
    }, 
    { timestamps: true }
);

taskSchema.index({ service_id: 1, task_name: 1 }, { unique: true });

const Task = mongoose.models.Task || mongoose.model("Task", taskSchema);
export default Task;