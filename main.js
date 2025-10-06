import express from "express";
import connectDB from "./config/db.js";

const app = express();

// connect to mongodb
connectDB();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});