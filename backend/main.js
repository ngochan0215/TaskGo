import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import http from "http";
import path from "path";
import { fileURLToPath } from "url";
import connectDB from "./config/db.js";
import { initSocket } from "./sockets/index.js";
import { voucherStatusCron } from "./utils/voucherStatus.js";

import authRoutes from "./routes/auth.route.js";
import userRoutes from "./routes/user.route.js";
import adminRoutes from "./routes/admin.route.js";
import orderRoutes from "./routes/order.route.js";
import taskRoutes from "./routes/task.route.js";
import taskerRoutes from "./routes/tasker.route.js";
import discountRoutes from "./routes/discount.route.js";
import transactionRoutes from "./routes/transaction.route.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

// Serve static files từ thư mục templates
app.use('/payment', express.static(path.join(__dirname, 'templates')));

// Route cho trang thanh toán thành công
app.get('/payment/success', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'success.html'));
});

// Route cho trang thanh toán thất bại
app.get('/payment/cancel', (req, res) => {
  res.sendFile(path.join(__dirname, 'templates', 'cancel.html'));
});

app.use("/api/auth", authRoutes);
app.use("/api/user", userRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/order", orderRoutes);
app.use("/api/task", taskRoutes);
app.use("/api/tasker", taskerRoutes);
app.use("/api/discount", discountRoutes);
app.use("/api/transaction", transactionRoutes);

voucherStatusCron();

// Wrap express server in httpServer
const httpServer = http.createServer(app);

const io = initSocket(httpServer);      

httpServer.listen(PORT, () => {
  connectDB();
  console.log(`Server listening on port ${PORT}`);
});



