// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import connectDB from "../config/db.js";
// import Task from "../models/tasks.js";

// dotenv.config();

// const runMigration = async () => {
//   try {
//     connectDB();
//     console.log("MongoDB connected");

//     const result = await Task.updateMany(
//       { task_type: { $exists: false } },
//       { $set: { task_type: "active" } }
//     );

//     console.log(`Migration done. Updated ${result.modifiedCount} tasks`);
//   } catch (err) {
//     console.error("Migration failed:", err);
//   } finally {
//     await mongoose.disconnect();
//     console.log("MongoDB disconnected");
//     process.exit(0);
//   }
// };

// runMigration();
