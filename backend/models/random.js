// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import connectDB from "../config/db.js";
// import { Tasker, Customer, Order, Task, Service, PayoutTasker } from "../models/index.js";

// dotenv.config();

// const runMigration = async () => {
//   try {
//     connectDB();
//     console.log("MongoDB connected");

//     // const result = await Tasker.updateMany(
//     //     { working_area: { $exists: false } },
//     //     {
//     //         $set: {
//     //         working_area: {
//     //             full_address: "",
//     //             latitude: null,
//     //             longitude: null,
//     //         },
//     //         },
//     //     }
//     //     );

//     const result = await PayoutTasker.updateMany(
//   { amount: { $exists: true } },
//   [
//     { $set: { total_amount: "$amount" } },
//     { $unset: "amount" }
//   ]
// )

//     console.log(`Migration done. Updated ${result.modifiedCount} services`);
//   } catch (err) {
//     console.error("Migration failed:", err);
//   } finally {
//     await mongoose.disconnect();
//     console.log("MongoDB disconnected");
//     process.exit(0);
//   }
// };

// runMigration();
