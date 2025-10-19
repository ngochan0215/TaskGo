import Order from "../models/orders.js";

// Get order by id
export const getOrderById = async (req, res) => {
  try {
    const { id } = req.params;
    const order = await Order.findById(id).lean();
    if (!order)
      return res
        .status(404)
        .json({ success: false, message: "Order không tồn tại" });
    return res.status(200).json({ success: true, order });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
};

export const getAllOrdersByCustomerId = async (req, res) => {
  try {
    const { customerId, limit = 50, page = 1, status } = req.query;
    const q = {};
    if (customerId) q.customer = customerId;
    if (status) q.status = status;

    const skip = (Number(page) - 1) * Number(limit);
    const orders = await Order.find(q)
      .populate("service provider")
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(Number(limit));

    return res.status(200).json({ success: true, orders });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "Lỗi server" });
  }
};



