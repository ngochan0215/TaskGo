import cron from "node-cron";
import { Voucher, VoucherUsage } from "../models/index.js";

export const voucherStatusCron = () => {

  // chạy mỗi ngày lúc 0h
  cron.schedule("0 0 * * *", async () => {
    try {
      const now = new Date();

      // kích hoạt voucher
      await Voucher.updateMany(
        {
          is_active: false,
          begin_date: { $lte: now },
          end_date: { $gte: now }
        },
        {
          $set: {
            is_active: true,
            status: "ongoing"
          }
        }
      );

      // tắt voucher đến hạn
      await Voucher.updateMany(
        {
          is_active: true,
          end_date: { $lt: now }
        },
        {
          $set: {
            is_active: false,
            status: "finished"
          }
        },
        {
          timezone: "Asia/Ho_Chi_Minh"
        }
      );

      console.log("[CRON] Voucher status updated");

    } catch (err) {
      console.error("[CRON][Voucher]", err.message);
    }
  });
};