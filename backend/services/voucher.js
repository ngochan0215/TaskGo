// services/voucher.js
import Voucher from "../models/vouchers.js";

/**
 * Tạo voucher mới
 */
export async function createVoucher(data) {
  const voucher = new Voucher(data);
  await voucher.save();
  return voucher;
}

/**
 * Lấy danh sách voucher còn hiệu lực và còn số lượng
 */
export async function getAvailableVouchers() {
  const now = new Date();
  return await Voucher.find({
    begin_date: { $lte: now },
    end_date: { $gte: now },
    quantity: { $gt: 0 }
  });
}

/**
 * Kiểm tra voucher hợp lệ cho user và trả về snapshot
 */
export async function checkAndGetVoucherSnapshot(voucherId, userId, userType) {
  const voucher = await Voucher.findById(voucherId);
  if (!voucher) throw new Error("Voucher không tồn tại");
  const now = new Date();
  if (voucher.begin_date && now < voucher.begin_date) throw new Error("Voucher chưa bắt đầu");
  if (voucher.end_date && now > voucher.end_date) throw new Error("Voucher đã hết hạn");
  if (voucher.quantity <= 0) throw new Error("Voucher đã hết lượt sử dụng");
  if (voucher.usage_rules.customer_type && voucher.usage_rules.customer_type !== userType)
    throw new Error("Bạn không đủ điều kiện sử dụng voucher này");

  // Kiểm tra số lần user đã dùng voucher này
  const usageCount = await Order.countDocuments({ voucher_id: voucherId, customer_id: userId });
  if (usageCount >= voucher.usage_rules.max_usage)
    throw new Error("Bạn đã dùng hết số lần cho phép");

  // Tạo snapshot để lưu vào order
  const voucherSnapshot = {
    voucherId: voucher._id,
    name: voucher.name,
    description: voucher.description,
    percentage: voucher.percentage,
    begin_date: voucher.begin_date,
    end_date: voucher.end_date,
    code: voucher.code || "",
  };

  return voucherSnapshot;
}

/**
 * Sử dụng voucher (giảm số lượng)
 */
export async function useVoucher(voucherId) {
  const voucher = await Voucher.findById(voucherId);
  if (!voucher) throw new Error("Voucher không tồn tại");
  if (voucher.quantity <= 0) throw new Error("Voucher đã hết lượt sử dụng");
  voucher.quantity -= 1;
  await voucher.save();
  return voucher;
}