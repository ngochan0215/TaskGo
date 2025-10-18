//Controller tạo đơn hàng ngay hoặc đặt trước, thực hiện hủy đơn hàng
import Order from "../models/orders.js";
import Task from "../models/tasks.js";
import Voucher from "../models/vouchers.js";
import Discount from "../models/discounts.js";

export const createOrderByCustomer = async (req, res) => {
  try {
    const {
      customer_id,
      task_id,
      scheduled_at,
      location,
      note,
      voucher_id,
      discount_id,
      quantity,
      base_fee,
      discount_amount = 0,
      tip_amount = 0,
    } = req.body;
    if (!customer_id || !task_id || !scheduled_at || !base_fee || !quantity)
      return res.status(400).json({ message: "Thiếu input đầu vào" });

    const customer = await User.findById({ customer_id });
    if (!customer)
      return res.status(404).json({ message: "Customer không tồn tại" });

    const task = await Task.findById(task_id);
    if (!task) return res.status(404).json({ message: "Task không tồn tại" });

    //Tìm voucher và discount
    const voucher = await Voucher.findById({ voucher_id });
    const discount = await Discount.findById({ discount_id });

    const order = await Order.create({
      customer: customer,
      service: serviceId,
      tasker_id: null,
      task_id: task,
      scheduled_at: scheduled_at,
      complete_at: null,
      location: location || null,
      note: note || "",

      voucher_id: voucher || null,
      discount_id: discount || null,
      quantity: quantity,
      base_fee: base_fee,
      discount_amount: discount_amount,
      tip_amount: tip_amount,
      status: "pending",
    });

    return res.status(201).json({ success: true, order });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
};


// Hủy order (khách yêu cầu)
export const cancelOrderByCustomer = async (req, res) => {
  try {
    const { id } = req.params;
    const { customerId, reason } = req.body;

    const order = await Order.findById(id);
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order không tồn tại" });

    // Nếu cung cấp customerId thì kiểm tra quyền
    if (customerId && String(order.customer) !== String(customerId)) {
      return res
        .status(403)
        .json({ success: false, message: "Không có quyền hủy order này" });
    }

    // Cập nhật trạng thái
    order.status = "cancelled";
    order.cancelReason = reason || null;
    order.cancelledAt = new Date();
    await order.save();

    return res.status(200).json({ success: true, order });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
};
