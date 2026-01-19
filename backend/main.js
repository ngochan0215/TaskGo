import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import http from "http";
import path from "path";
import fetch from "node-fetch";

import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import { initSocket } from "./sockets/index.js";
import { voucherStatusCron, orderStatusCron, scheduledTaskReminderCron } from "./jobs/cronJobStatus.js";
import '../backend/jobs/transactionStatusJob.js'; 

import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import adminRoutes from "./routes/admin.route.js";
import orderRoutes from "./routes/order.route.js";
import taskRoutes from "./routes/task.route.js";
import taskerRoutes from "./routes/tasker.route.js";
import discountRoutes from "./routes/discount.route.js";
import transactionRoutes from "./routes/transaction.route.js";
import notificationRoutes from "./routes/notification.route.js";
import chatRoutes from "./routes/chat.route.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

// Serve static files từ thư mục frontend
console.log('__dirname =', __dirname);

app.use('/frontend', express.static(path.join(__dirname, '..', 'frontend')));

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/task", taskRoutes);
app.use("/api/tasker", taskerRoutes);
app.use("/api/discount", discountRoutes);
app.use("/api/transaction", transactionRoutes);
app.use("/api/notification", notificationRoutes);

voucherStatusCron();
//orderStatusCron();
scheduledTaskReminderCron();

app.use("/api/chats", chatRoutes);

app.get("/api/momo/bankcodes", async (req, res) => {
  const response = await fetch(
    "https://payment.momo.vn/v2/gateway/api/bankcodes"
  );
  const data = await response.json();
  res.json(data);
});

const httpServer = http.createServer(app);
initSocket(httpServer);      

httpServer.listen(PORT, () => {
  connectDB();
  console.log(`Server listening on port ${PORT}`);
});



