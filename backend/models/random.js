// import mongoose from "mongoose";
// import dotenv from "dotenv";
// import connectDB from "../config/db.js";
// import { Tasker, Customer, Order, Task, Service } from "../models/index.js";

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

//     const result = await Service.updateMany(
//   {
//     $or: [
//       { avatar_url: { $exists: false } },
//       { avatar_url: null },
//       { avatar_url: "" }
//     ]
//   },
//   {
//     $set: {
//       avatar_url: "hello world"
//     }
//   }
// );

// console.log("Updated documents:", result.modifiedCount);


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
