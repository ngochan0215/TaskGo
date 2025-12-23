import mongoose from "mongoose";

const messageSchema = new mongoose.Schema(
  {
    chat_id: { type: mongoose.Schema.Types.ObjectId, ref: "Chat", required: true },
    sender_id: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
    reply_to: { type: mongoose.Schema.Types.ObjectId, ref: "Message" },

    content: {
      type: String,
      required: true,
      trim: true,
      validate: {
        validator: (v) => v.trim().length > 0,
        message: "Nội dung tin nhắn không được để trống",
      },
    },

    message_type: { type: String, enum: ["text", "image", "file"], default: "text" },
    status: { type: String, enum: ["sent", "deleted", "read"], default: "sent" },
    deleted_at: { type: Date, default: null },

  },
  { 
    timestamps: { createdAt: "sent_at", updatedAt: "updated_at" }
  }
);

messageSchema.index({ chat_id: 1, sender_id: 1, sent_at: 1 });

const Message = mongoose.model("Message", messageSchema);
export default Message;
