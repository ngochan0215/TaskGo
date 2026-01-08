import Discount from "../models/discounts.js";
import Order from "../models/orders.js";

/**
 * Tạo discount mới
 */
export async function createDiscount(data) {
  const discount = new Discount(data);
  await discount.save();
  return discount;
}

/**
 * Lấy danh sách discount còn hiệu lực
 */
export async function getAvailableDiscounts() {
  const now = new Date();
  return await Discount.find({
    begin_date: { $lte: now },
    end_date: { $gte: now },
    status: { $in: ["ongoing", "upcoming"] }
  });
}

/**
 * Kiểm tra discount hợp lệ cho order và trả về snapshot nếu hợp lệ
 */
export async function validateAndGetDiscountSnapshot(discountId) {
  const discount = await Discount.findById(discountId);
  if (!discount) throw new Error("Discount không tồn tại");
  const now = new Date();
  if (discount.begin_date && now < discount.begin_date)
    throw new Error("Discount chưa bắt đầu");
  if (discount.end_date && now > discount.end_date)
    throw new Error("Discount đã hết hạn");
  if (discount.status && discount.status === "completed")
    throw new Error("Discount đã hoàn thành");

  // Kiểm tra discount đã áp dụng cho order chưa (nếu cần)
  const used = await Order.findOne({ discount_snapshot: { discountId } });
  if (used)
    throw new Error("Order đã áp dụng discount này rồi");

  // Trả về snapshot
  return {
    discountId: discount._id,
    name: discount.name,
    description: discount.description,
    percentage: discount.percentage,
    begin_date: discount.begin_date,
    end_date: discount.end_date,
    appliedAt: new Date()
  };
}