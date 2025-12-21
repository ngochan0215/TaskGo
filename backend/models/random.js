// import mongoose from "mongoose";
// import connectDB from "../config/db.js";
// import {Task} from "../models/index.js";

// // chuẩn hóa string: lowercase + bỏ dấu
// function normalize(str = "") {
//   return str
//     .toLowerCase()
//     .normalize("NFD")
//     .replace(/[\u0300-\u036f]/g, "");
// }

// function getIconByTaskName(taskName) {
//   const name = normalize(taskName);

//   for (const rule of ICON_MAP) {
//     if (rule.keywords.some(k => name.includes(normalize(k)))) {
//       return rule.icon;
//     }
//   }

//   return "handyman"; // fallback
// }

// const ICON_MAP = [
//   { keywords: ["dọn", "vệ sinh nhà", "lau dọn"], icon: "cleaning_services" },
//   { keywords: ["tổng vệ sinh"], icon: "housekeeping" },

//   { keywords: ["máy lạnh", "điều hòa"], icon: "climate_mini_split" },
//   { keywords: ["máy giặt"], icon: "local_laundry_service" },

//   { keywords: ["giặt", "ủi"], icon: "laundry" },
//   { keywords: ["đi chợ"], icon: "shopping_cart" },
//   { keywords: ["nấu ăn"], icon: "skillet" },

//   { keywords: ["trông trẻ"], icon: "child_care" },
//   { keywords: ["người già", "cao tuổi"], icon: "elderly" },
//   { keywords: ["người bệnh"], icon: "sick" },

//   { keywords: ["sửa điện"], icon: "electrical_services" },
//   { keywords: ["ống nước"], icon: "plumbing" },

//   { keywords: ["chuyển đồ", "bốc vác"], icon: "moving" },
//   { keywords: ["massage"], icon: "massage" },
// ];

// async function migrateIcons() {
//   await connectDB();

//   const tasks = await Task.find({
//     $or: [{ icon: { $exists: false } }, { icon: "" }],
//   });

//   let updated = 0;

//   for (const task of tasks) {
//     const icon = getIconByTaskName(task.task_name);
//     task.icon = icon;
//     await task.save();
//     updated++;
//   }

//   console.log(`✅ Migrated ${updated}/${tasks.length} tasks`);
//   process.exit();
// }

// migrateIcons();
