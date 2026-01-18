import mongoose from "mongoose";

const chatSchema = new mongoose.Schema(
  {
    order_id: { type: mongoose.Schema.Types.ObjectId, ref: "Order", required: true, unique: true },

    participants: {
      type: [{
        user_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
        role: { type: String, enum: ["customer", "tasker"], required: true },
        last_seen_message_id: { type: mongoose.Schema.Types.ObjectId, ref: "Message", default: null},
        last_seen_at: { type: Date, default: null },
      }],
      validate: v => v.length === 2
    },

    last_message: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },
    status: { type: String, enum: ["active", "deleted", "completed"], default: "active" },
  },
  { 
    timestamps: { createdAt: 'created_at', updatedAt: 'updated_at' }
  }
);

const Chat = mongoose.models.Chat || mongoose.model("Chat", chatSchema);
export default Chat;
