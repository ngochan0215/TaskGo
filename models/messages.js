import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    chat_id: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
    sender_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    content: { type: String, trim: true },
    message_type: { type: String, enum: ["text", "image", "file"], default: "text" },
    attachment_url: { type: String, trim: true }, // for images/files
    status: { type: String, enum: ["read", "unread"] }
  },
  { timestamps: true }
);

// messageSchema.index({ chat_id: 1 });
// messageSchema.index({ sender_id: 1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;
