// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import connectDB from "../config/db.js";
// import { Tasker, Customer } from "../models/index.js";

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

//     const result = await Tasker.updateMany(
//         { type: { $exists: false } },
//         {
//             $set: { 
//                 total_completed_orders: 0,
//                 rejection_counts: 0
//             }
//         }
//     );

//     console.log(`Migration done. Updated ${result.modifiedCount} taskers`);
//   } catch (err) {
//     console.error("Migration failed:", err);
//   } finally {
//     await mongoose.disconnect();
//     console.log("MongoDB disconnected");
//     process.exit(0);
//   }
// };

// runMigration();
