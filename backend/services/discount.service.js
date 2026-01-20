import { Discount, Customer } from "../models/index.js";
import mongoose from "mongoose";

const { Types: { ObjectId } } = mongoose;

/**
 * Tìm khuyến mãi tốt nhất cho một khách hàng dựa trên các điều kiện
 * @param {Object} params
 * @param {String} params.userId - ID của user (customer)
 * @param {String} params.taskId - ID của task/service (optional, nếu không có thì tìm discount global)
 * @param {Number} params.basePrice - Giá gốc (optional, để kiểm tra min_order_value)
 * @param {Date} params.checkTime - Thời gian kiểm tra (mặc định là hiện tại)
 * @returns {Object|null} Discount document hoặc null nếu không tìm thấy
 */
export async function findBestDiscountForCustomer({ userId, taskId = null, basePrice = null, checkTime = new Date() }) {
  try {
    // Lấy thông tin customer
    const customer = await Customer.findOne({ user_id: userId }).select("type");
    const customerTier = customer?.type?.toUpperCase() || "NEW"; // new, loyal, vip

    const now = checkTime;
    const dayOfWeek = now.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
    const hour = now.getHours(); // 0-23

    // Xây dựng query conditions
    const queryConditions = [
      // Theo hạng khách hàng
      {
        $or: [
          { "conditions.customer_tiers": { $exists: false } },
          { "conditions.customer_tiers": { $size: 0 } },
          { "conditions.customer_tiers": customerTier }
        ]
      },
      // Theo ngày trong tuần
      {
        $or: [
          { "conditions.days_of_week": { $exists: false } },
          { "conditions.days_of_week": { $size: 0 } },
          { "conditions.days_of_week": dayOfWeek }
        ]
      },
      // Theo giờ
      {
        $or: [
          { "conditions.hours_range": { $exists: false } },
          {
            "conditions.hours_range.from": { $lte: hour },
            "conditions.hours_range.to": { $gte: hour }
          }
        ]
      }
    ];

    // Nếu có taskId, thêm điều kiện task_ids
    if (taskId) {
      queryConditions.push({
        $or: [
          { "conditions.task_ids": { $exists: false } },
          { "conditions.task_ids": { $size: 0 } },
          { "conditions.task_ids": mongoose.isValidObjectId(taskId) ? new ObjectId(taskId) : taskId }
        ]
      });
    } else {
      // Nếu không có taskId, chỉ lấy discount global (không có task_ids hoặc task_ids rỗng)
      queryConditions.push({
        $or: [
          { "conditions.task_ids": { $exists: false } },
          { "conditions.task_ids": { $size: 0 } }
        ]
      });
    }

    // Tìm các discount phù hợp
    const discounts = await Discount.find({
      is_active: true,
      begin_date: { $lte: now },
      end_date: { $gte: now },
      $and: queryConditions
    }).sort({ priority: -1 }); // Sắp xếp theo priority cao nhất

    if (!discounts || discounts.length === 0) {
      return null;
    }

    // Lọc discount phù hợp với min_order_value nếu có basePrice
    let eligibleDiscounts = discounts;
    if (basePrice !== null) {
      eligibleDiscounts = discounts.filter(discount => {
        if (!discount.conditions?.min_order_value) return true;
        return basePrice >= discount.conditions.min_order_value;
      });
    }

    // Nếu không có discount nào phù hợp với min_order_value, trả về null
    if (eligibleDiscounts.length === 0) {
      return null;
    }

    // Trả về discount có priority cao nhất (đã được sort ở trên)
    return eligibleDiscounts[0];
  } catch (error) {
    console.error("Error finding best discount for customer:", error);
    return null;
  }
}

/**
 * Tính discount cho một service/task cụ thể
 * @param {Object} params
 * @param {String} params.userId - ID của user (customer)
 * @param {String} params.taskId - ID của task/service
 * @param {Number} params.basePrice - Giá gốc của service
 * @param {Date} params.checkTime - Thời gian kiểm tra (mặc định là hiện tại)
 * @returns {Object} { discount, discountAmount, finalPrice, discountInfo }
 */
export async function calculateDiscountForService({ userId, taskId, basePrice, checkTime = new Date() }) {
  try {
    // Tìm discount tốt nhất
    const bestDiscount = await findBestDiscountForCustomer({
      userId,
      taskId,
      basePrice,
      checkTime
    });

    if (!bestDiscount) {
      return {
        discount: null,
        discountAmount: 0,
        finalPrice: basePrice,
        discountInfo: null
      };
    }

    // Tính discount amount
    let discountAmount = 0;

    if (bestDiscount.discount.type === "PERCENT") {
      discountAmount = basePrice * (bestDiscount.discount.value / 100);

      // Áp dụng max_discount nếu có
      if (bestDiscount.discount.max_discount && discountAmount > bestDiscount.discount.max_discount) {
        discountAmount = bestDiscount.discount.max_discount;
      }
    } else if (bestDiscount.discount.type === "FIXED") {
      discountAmount = bestDiscount.discount.value;
    }

    // Đảm bảo discount không vượt quá basePrice
    discountAmount = Math.min(discountAmount, basePrice);
    const finalPrice = Math.max(0, basePrice - discountAmount);

    return {
      discount: bestDiscount,
      discountAmount: Math.round(discountAmount),
      finalPrice: Math.round(finalPrice),
      discountInfo: {
        id: bestDiscount._id,
        code: bestDiscount.code,
        name: bestDiscount.name,
        description: bestDiscount.description,
        type: bestDiscount.discount.type,
        value: bestDiscount.discount.value,
        discountAmount: Math.round(discountAmount),
        originalPrice: basePrice,
        finalPrice: Math.round(finalPrice)
      }
    };
  } catch (error) {
    console.error("Error calculating discount for service:", error);
    // Trả về giá gốc nếu có lỗi
    return {
      discount: null,
      discountAmount: 0,
      finalPrice: basePrice,
      discountInfo: null,
      error: error.message
    };
  }
}

/**
 * Tính discount cho nhiều services cùng lúc
 * @param {Object} params
 * @param {String} params.userId - ID của user
 * @param {Array} params.services - Array of { taskId, basePrice }
 * @param {Date} params.checkTime - Thời gian kiểm tra
 * @returns {Object} Map of taskId -> discount info
 */
export async function calculateDiscountsForServices({ userId, services, checkTime = new Date() }) {
  const results = {};

  for (const service of services) {
    const result = await calculateDiscountForService({
      userId,
      taskId: service.taskId,
      basePrice: service.basePrice,
      checkTime
    });

    results[service.taskId] = result;
  }

  return results;
}
