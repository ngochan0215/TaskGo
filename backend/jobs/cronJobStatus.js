import cron from "node-cron";
import { Voucher, Discount, OrderStatusLog, Order, Account, Notification 

} from "../models/index.js";
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

export const discountStatusCron = () => {

  // chạy mỗi ngày lúc 0h
  cron.schedule("0 0 * * *", async () => {
    try {
      const now = new Date();

      // kích hoạt voucher
      await Discount.updateMany(
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
      await Discount.updateMany(
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

      console.log("[CRON] Discount status updated");

    } catch (err) {
      console.error("[CRON][Discount]", err.message);
    }
  });
};

export const orderStatusCron = () => {
  cron.schedule(
    "* * * * * *", // mỗi phút
    async () => {
      try {
        const now = new Date();
        const THREE_MINUTES_AGO = new Date(now.getTime() - 3 * 60 * 1000);

        // tìm các log assigned quá 3 phút
        const assignedLogs = await OrderStatusLog.find({
          to_status: "assigned",
          created_at: { $lte: THREE_MINUTES_AGO }
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
              "Hết thời gian nhận đơn hàng!",
              `Đơn hàng có ID: ${order._id} đã tự động gán cho người khác vì quá hạn nhận đơn 
              (quá 3 phút kể từ lúc thông báo được gán). Hãy chú ý đến điểm uy tín của mình nhé.`,
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

// gửi thông báo 1 tiếng trước giờ đặt hẹn
export const scheduledTaskReminderCron = () => {
  cron.schedule(
    "*/5 * * * *", 
    async () => {
      try {
        const now = new Date();

        const oneHourFromNow = new Date(now.getTime() + 60 * 60 * 1000);
        const fiveMinutesBefore = new Date(now.getTime() + 55 * 60 * 1000);
        const fiveMinutesAfter = new Date(now.getTime() + 65 * 60 * 1000);

        const scheduledOrders = await Order.find({
          type: "scheduled",
          status: { $in: ["assigned", "accepted", "departed", "arrived"] },
          tasker_id: { $exists: true, $ne: null },
          scheduled_at: {
            $gte: fiveMinutesBefore,
            $lte: fiveMinutesAfter
          }
        })
          .populate("customer_id", "full_name")
          .populate("tasker_id", "full_name")
          .lean();

        if (!scheduledOrders.length) return;

        const admins = await Account.find({ role: "admin" }).select("user_id").lean();
        const adminUserIds = admins.map(admin => admin.user_id);

        for (const order of scheduledOrders) {
          try {

            const twoHoursAgo = new Date(now.getTime() - 2 * 60 * 60 * 1000);
            const existingNotification = await Notification.findOne({
              "reference.refId": order._id,
              "reference.kind": "Order",
              $or: [
                { title: "Nhắc nhở: Công việc sắp bắt đầu" },
                { title: "Nhắc nhở: Dịch vụ sắp bắt đầu" },
                { title: "Nhắc nhở: Đơn hàng đã lên lịch sắp bắt đầu" }
              ],
              created_at: {
                $gte: twoHoursAgo
              }
            });

            if (existingNotification) {
              console.log(`[CRON] Skipping order ${order._id} - reminder already sent`);
              continue;
            }

            const scheduledTime = new Date(order.scheduled_at);
            const timeStr = scheduledTime.toLocaleTimeString("vi-VN", {
              hour: "2-digit",
              minute: "2-digit"
            });
            const dateStr = scheduledTime.toLocaleDateString("vi-VN", {
              day: "2-digit",
              month: "2-digit",
              year: "numeric"
            });

            const serviceName = order.task_snapshot?.name || "dịch vụ";
            const customerName = order.customer_id?.full_name || "Khách hàng";
            const taskerName = order.tasker_id?.full_name || "Tasker";

            // thông báo cho tasker
            if (order.tasker_id) {
              await pushNotification(
                order.tasker_id,
                "Nhắc nhở: Công việc sắp bắt đầu",
                `Bạn có một công việc "${serviceName}" thuộc đơn hàng ID: ${order._id} sẽ bắt đầu 
                  vào ${timeStr}, ${dateStr}. Vui lòng chuẩn bị sẵn sàng.`,
                "order",
                "Order",
                order._id,
                "unread"
              );
            }

            // thông báo khách hàng
            if (order.customer_id) {
              await pushNotification(
                order.customer_id,
                "Nhắc nhở: Dịch vụ sắp bắt đầu",
                `Dịch vụ "${serviceName}" thuộc đơn hàng ID: ${order._id} của bạn sẽ bắt đầu 
                  vào ${timeStr}, ${dateStr}. Tasker ${taskerName} sẽ đến đúng giờ.`,
                "order",
                "Order",
                order._id,
                "unread"
              );
            }

            // thông báo cho admin
            if (adminUserIds.length > 0) {
              await Promise.all(
                adminUserIds.map(adminUserId =>
                  pushNotification(
                    adminUserId,
                    "Nhắc nhở: Đơn hàng đã lên lịch sắp bắt đầu",
                    `Đơn hàng có ID: ${order._id} (${serviceName}) sẽ bắt đầu vào ${timeStr}, ${dateStr}. 
                      Khách hàng: ${customerName}, Tasker: ${taskerName}.`,
                    "order",
                    "Order",
                    order._id,
                    "unread"
                  )
                )
              );
            }

            console.log(
              `[CRON] Sent 1-hour reminder for scheduled order ${order._id} (scheduled at ${scheduledTime.toISOString()})`
            );
          } catch (err) {
            console.error(
              `[CRON][SCHEDULED_REMINDER] Error processing order ${order._id}:`,
              err.message
            );
          }
        }
      } catch (err) {
        console.error("[CRON][SCHEDULED_TASK_REMINDER]", err.message);
      }
    },
    {
      timezone: "Asia/Ho_Chi_Minh"
    }
  );
}

// Gửi thông báo khi đơn hàng quá hạn hoàn thành (5 phút sau thời điểm kết thúc dự kiến)
export const overdueOrderNotificationCron = () => {
  cron.schedule(
    "* * * * *", // Chạy mỗi 5 phút
    async () => {
      try {
        const now = new Date();

        // Tìm các đơn hàng đã có tasker và đang trong quá trình thực hiện
        // nhưng chưa hoàn thành và đã quá 10 phút kể từ thời điểm kết thúc dự kiến
        const activeOrders = await Order.find({
          status: { 
            $in: ["accepted", "departed", "arrived", "in_progress", "awaiting_payment"]
          },
          tasker_id: { $exists: true, $ne: null }
        })
          .populate("customer_id", "full_name")
          .populate("tasker_id", "full_name")
          .lean();

        if (!activeOrders.length) return;

        const admins = await Account.find({ role: "admin" }).select("user_id").lean();
        const adminUserIds = admins.map(admin => admin.user_id);

        for (const order of activeOrders) {
          try {
            // Tính thời gian kết thúc dự kiến
            const scheduledAt = new Date(order.scheduled_at);
            const totalTimeMinutes = order.task_payload?.total_time || 120; // Mặc định 120 phút nếu không có
            const expectedEndTime = new Date(scheduledAt.getTime() + totalTimeMinutes * 60 * 1000);
            
            // Kiểm tra nếu đã qua 10 phút kể từ thời điểm kết thúc dự kiến
            const tenMinutesAfterExpectedEnd = new Date(expectedEndTime.getTime() + 10 * 60 * 1000);
            
            if (now < tenMinutesAfterExpectedEnd) {
              // Chưa đến lúc gửi thông báo
              continue;
            }

            // Kiểm tra xem đã gửi thông báo chưa (trong vòng 1 giờ qua)
            const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
            const existingNotification = await Notification.findOne({
              "reference.refId": order._id,
              "reference.kind": "Order",
              $or: [
                { title: "Cảnh báo: Đơn hàng quá hạn hoàn thành" },
                { title: "Thông báo: Đơn hàng chưa được hoàn thành" }
              ],
              created_at: {
                $gte: oneHourAgo
              }
            });

            if (existingNotification) {
              console.log(`[CRON] Skipping order ${order._id} - overdue notification already sent`);
              continue;
            }

            const serviceName = order.task_snapshot?.name || "dịch vụ";
            const customerName = order.customer_id?.full_name || "Khách hàng";
            const taskerName = order.tasker_id?.full_name || "Tasker";
            const orderIdShort = order._id.toString().slice(-6).toUpperCase();

            // Thông báo cho tasker
            if (order.tasker_id) {
              await pushNotification(
                order.tasker_id,
                "Cảnh báo: Đơn hàng quá hạn hoàn thành",
                `Đơn hàng #${orderIdShort} (${serviceName}) đã quá 10 phút kể từ thời điểm dự kiến hoàn thành. 
                  Vui lòng xác nhận hoàn thành đơn hàng ngay lập tức hoặc liên hệ với khách hàng nếu có vấn đề.`,
                "order",
                "Order",
                order._id,
                "unread"
              );
            }

            // Thông báo cho khách hàng
            if (order.customer_id) {
              await pushNotification(
                order.customer_id,
                "Thông báo: Đơn hàng chưa được hoàn thành",
                `Đơn hàng #${orderIdShort} (${serviceName}) của bạn đã quá thời gian dự kiến hoàn thành. 
                  Tasker ${taskerName} chưa xác nhận hoàn thành. Vui lòng kiểm tra hoặc liên hệ hỗ trợ nếu cần.`,
                "order",
                "Order",
                order._id,
                "unread"
              );
            }

            // Thông báo cho admin
            if (adminUserIds.length > 0) {
              await Promise.all(
                adminUserIds.map(adminUserId =>
                  pushNotification(
                    adminUserId,
                    "Cảnh báo: Đơn hàng quá hạn hoàn thành",
                    `Đơn hàng #${orderIdShort} (${serviceName}) đã quá 10 phút kể từ thời điểm dự kiến hoàn thành. 
                      Khách hàng: ${customerName}, Tasker: ${taskerName}. Trạng thái hiện tại: ${order.status}.`,
                    "order",
                    "Order",
                    order._id,
                    "unread"
                  )
                )
              );
            }

            console.log(
              `[CRON] Sent overdue notification for order ${order._id} (expected end: ${expectedEndTime.toISOString()})`
            );
          } catch (err) {
            console.error(
              `[CRON][OVERDUE_ORDER] Error processing order ${order._id}:`,
              err.message
            );
          }
        }
      } catch (err) {
        console.error("[CRON][OVERDUE_ORDER_NOTIFICATION]", err.message);
      }
    },
    {
      timezone: "Asia/Ho_Chi_Minh"
    }
  );
}