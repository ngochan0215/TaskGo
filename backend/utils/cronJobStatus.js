import cron from "node-cron";
import { Voucher, VoucherUsage, OrderStatusLog, Order } from "../models/index.js";
import { denyTaskRequest } from "../services/taskers.service.js";
import { pushNotification } from "../services/notification.service.js";

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

export const orderStatusCron = () => {
  cron.schedule(
    "* * * * * *", // mỗi phút
    async () => {
      try {
        const now = new Date();
        const TWO_MINUTES_AGO = new Date(now.getTime() - 2 * 60 * 1000);

        // tìm các log assigned quá 2 phút
        const assignedLogs = await OrderStatusLog.find({
          to_status: "assigned",
          created_at: { $lte: TWO_MINUTES_AGO }
        }).lean();

        if (!assignedLogs.length) return;

        for (const log of assignedLogs) {
          const order = await Order.findById(log.order_id);
          if (!order) continue;

          // chỉ xử lý nếu order vẫn đang assigned
          if (order.status !== "assigned") continue;

          // gọi denyTask (coi như tasker không phản hồi)
          try {
            // thông báo cho tasker
            await pushNotification(
              order.tasker_id,
              "Hết thời giạn nhận đơn hàng!",
              `Đơn hàng có ID: ${order._id} đã tự động gán cho người khác vì quá hạn nhận đơn. 
              Hãy chú ý đến điểm uy tín của mình nhé.`,
              "order",
              "Order",
              order._id,
              "unread"
            );

            await denyTaskRequest(
              order.tasker_id, 
              order._id,
              "Tasker không phản hồi trong thời gian quy định kể từ lúc được gán đơn."
            );

            console.log(
              `[CRON] Auto deny tasker ${order.tasker_id} for order ${order._id}`
            );
          } catch (err) {
            console.error(
              `[CRON][DENY_TASK] order=${order._id}`,
              err.message
            );
          }
        }
      } catch (err) {
        console.error("[CRON][AUTO_DENY_TASK]", err.message);
      }
    },
    {
      timezone: "Asia/Ho_Chi_Minh"
    }
  );
}