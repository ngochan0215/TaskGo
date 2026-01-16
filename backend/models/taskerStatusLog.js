import mongoose from "mongoose";

const taskerStatusLogSchema = new mongoose.Schema(
  {
    tasker_id: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Tasker",
      required: true
    },

    actor_type: {
      type: String,
      enum: ["customer", "tasker", "system"],
      required: true
    },

    actor_id: { type: mongoose.Schema.Types.ObjectId },

    from_status: {
      type: String,
      required: true
    },

    to_status: {
      type: String,
      required: true
    },

    reason: { type: String  }
  },
  {
    timestamps: { createdAt: "created_at", updatedAt: "updated_at" }
  }
);

const TaskerStatusLog = mongoose.models.TaskerStatusLog || mongoose.model("TaskerStatusLog", taskerStatusLogSchema);
export default TaskerStatusLog;
