import express from "express";
import dotenv from "dotenv";
import cookieParser from "cookie-parser";
import cors from "cors";
import http from "http";

import connectDB from "./config/db.js";
import initRoute from './routes/index.route.js';

import { initSocket } from "./sockets/index.js";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cookieParser());
app.use(cors({ origin: true, credentials: true }));

initRoute(app)

// Wrap express server in httpServer
const httpServer = http.createServer(app);

const io = initSocket(httpServer);      

httpServer.listen(PORT, () => {
  connectDB();
  console.log(`Server listening on port ${PORT}`);
});



