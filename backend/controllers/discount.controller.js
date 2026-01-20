import { Discount, Voucher, VoucherUsage, Customer } from "../models/index.js";
import { validateDate } from "../utils/validateDate.js";

//------ DISCOUNT -------//
// export const createDiscount = async (req, res) => {
//   try {
//     const { name, description, begin_date, end_date, percentage, applied_model, applied_model_id } = req.body;

//     if (!name || !description || !begin_date || !end_date || !percentage || !applied_model) {
//       return res.status(400).json({
//         success: false,
//         message: "Please fill all the required information.",
//       });
//     }

//     const validDate = validateDate({ begin_date, end_date });
//     if (!validDate.valid)
//       return res.status(400).json({ success: false, message: validDate.message });

//     if (percentage <= 0 || percentage > 100) {
//       return res.status(400).json({ success: false, message: "Discount percentage must be between 1% and 100%." });
//     }

//     const existing = await Discount.findOne({ name });
//     if (existing) {
//       return res.status(400).json({ success: false, message: "Discount's name already existed." });
//     }

//     const discount = new Discount({ name, description, begin_date: validDate.begin, end_date: validDate.end, percentage, applied_model, applied_model_id });
//     await discount.save();

//     return res.status(201).json({ success: true, message: "Create new discount successfully!", discount });

//   } catch (err) {
//     console.error(err);
//     return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
//   }
// };
export const createDiscount = async (req, res) => {
  try {
    const { code, name, description, discount,
      conditions, begin_date, end_date, priority } = req.body;

    if (!code || !name || !discount || !discount.type || discount.value == null) {
      return res.status(400).json({
        success: false,
        message: "Thiếu thông tin bắt buộc (mã, tên, thể lệ khuyến mãi)"
      });
    }

    const existing = await Discount.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: "Mã khuyến mãi đã tồn tại." });
    }

    const existingName = await Discount.findOne({ name });
    if (existingName) {
      return res.status(400).json({ success: false, message: "Tên khuyến mãi đã tồn tại." });
    }

    if (!["PERCENT", "FIXED"].includes(discount.type)) {
      return res.status(400).json({
        success: false,
        message: "Loại hình khuyến mãi không hợp lệ"
      });
    }

    if (discount.type === "FIXED") {
      if (discount.value <= 0) {
        return res.status(400).json({
          success: false,
          message: "Số tiền khuyến mãi cố định phải > 0"
        });
      }
    }

    if (discount.type === "PERCENT") {
      if (discount.value <= 0 || discount.value > 100) {
        return res.status(400).json({
          success: false,
          message: "Phần trăm khuyến mãi phải nằm trong (0, 100]"
        });
      }

      if (!discount.max_discount || discount.max_discount <= 0) {
        return res.status(400).json({
          success: false,
          message: "Cần cung cấp số tiền khuyến mãi tối đa."
        });
      }
    }

    if (conditions) {
      const { min_order_value, days_of_week, hours_range, customer_tiers, task_ids } = conditions;

      if (min_order_value != null && min_order_value < 0) {
        return res.status(400).json({
          success: false,
          message: "Tiền đơn hàng tối thiểu không được âm"
        });
      }

      if (days_of_week) {
        if (!Array.isArray(days_of_week)) {
          return res.status(400).json({
            success: false,
            message: "days_of_week phải là mảng"
          });
        }
        const invalidDay = days_of_week.some(
          d => typeof d !== "number" || d < 0 || d > 6
        );
        if (invalidDay) {
          return res.status(400).json({
            success: false,
            message: "Ngày trong tuần chỉ nhận giá trị từ 0 đến 6 (0=Chủ nhật, 1=Thứ 2, ..., 6=Thứ 7)."
          });
        }
      }

      if (hours_range) {
        const { from, to } = hours_range;
        if (
          from == null || to == null ||
          from < 0 || from > 23 ||
          to < 0 || to > 23 ||
          from > to
        ) {
          return res.status(400).json({
            success: false,
            message: "Khung giờ khuyến mãi không hợp lệ"
          });
        }
      }

      if (customer_tiers) {
        if (!Array.isArray(customer_tiers)) {
          return res.status(400).json({
            success: false,
            message: "customer_tiers phải là mảng"
          });
        }
        const validTiers = ["NEW", "LOYAL", "VIP"];
        const invalidTier = customer_tiers.some(tier => !validTiers.includes(tier));
        if (invalidTier) {
          return res.status(400).json({
            success: false,
            message: "Hạng khách hàng chỉ nhận giá trị: NEW, LOYAL, VIP"
          });
        }
      }

      if (task_ids) {
        if (!Array.isArray(task_ids)) {
          return res.status(400).json({
            success: false,
            message: "task_ids phải là mảng"
          });
        }
        // Validate ObjectIds
        const mongoose = (await import("mongoose")).default;
        const invalidId = task_ids.some(id => !mongoose.isValidObjectId(id));
        if (invalidId) {
          return res.status(400).json({
            success: false,
            message: "task_ids chứa ID không hợp lệ"
          });
        }
      }
    }

    if (!begin_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: "Ngày bắt đầu và kết thúc là bắt buộc"
      });
    }

    const begin = new Date(begin_date);
    const end = new Date(end_date);
    const now = new Date();

    if (begin >= end) {
      return res.status(400).json({
        success: false,
        message: "Ngày bắt đầu phải nhỏ hơn ngày kết thúc."
      });
    }

    if (now > end) {
      return res.status(400).json({
        success: false,
        message: "Ngày kết thúc không được ở trong quá khứ"
      });
    }

    let is_active = false;
    let status = "upcoming";
    if (now >= begin && now <= end) {
      is_active = true;
      status = "ongoing";
    } else if (now > end) {
      status = "finished";
    }

    const newDiscount = await Discount.create({
      code: code.toUpperCase(),
      name,
      description,
      discount,
      conditions: conditions && Object.keys(conditions).length > 0 ? conditions : undefined,
      begin_date: begin,
      end_date: end,
      priority: priority || 1,
      is_active,
      status
    });

    return res.status(201).json({
      success: true,
      message: "Tạo discount thành công",
      data: newDiscount
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + err.message
    });
  }
};

export const getAllDiscounts = async (req, res) => {
  try {
    const { status, type, code, name,
      min_order_value, customer_tier, date,
      day, hour, page = 1, limit = 10 } = req.query;

    const filter = {};

    if (status) filter.status = status;
    if (type) filter["discount.type"] = type;
    if (code) filter.code = code;
    if (name) filter.name = name;

    // date filter
    if (date) {
      const d = new Date(date);
      filter.begin_date = { $lte: d };
      filter.end_date = { $gte: d };
    }

    // condition filters
    if (min_order_value) {
      filter["conditions.min_order_value"] = { $lte: Number(min_order_value) };
    }

    if (customer_tier) {
      filter["conditions.customer_tiers"] = customer_tier;
    }

    if (day !== undefined) {
      filter["conditions.days_of_week"] = Number(day);
    }

    if (hour !== undefined) {
      filter["conditions.hours_range.from"] = { $lte: Number(hour) };
      filter["conditions.hours_range.to"] = { $gte: Number(hour) };
    }

    // const skip = (page - 1) * limit;

    // const [data, total] = await Promise.all([
    //   Discount.find(filter)
    //     .sort({ priority: -1, created_at: -1 })
    //     .skip(skip)
    //     .limit(Number(limit)),
    //   Discount.countDocuments(filter)
    // ]);

    const discounts = await Discount
      .find(filter)
      .select("-__v")
      .sort({ priority: -1, created_at: -1 })
      .lean();

    return res.json({
      success: true,
      total: discounts.length,
      discounts
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + err.message
    });
  }
};

export const getDiscountById = async (req, res) => {
  try {
    const { id } = req.params;

    const discount = await Discount.findById(id).select("-__v");
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy discount"
      });
    }

    return res.json({
      success: true,
      data: discount
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + err.message
    });
  }
};

export const deleteDiscount = async (req, res) => {
  try {
      const { id } = req.params;
      const discount = await Discount.findById(id);

      if (!discount)
        return res.status(404).json({ success: false, message: "Không tìm thấy khuyến mãi!" });

      // const now = new Date();
      // if (now >= discount.begin_date || discount.is_active || discount.status === "ongoing") {
      //   return res.status(400).json({
      //     success: false,
      //     message: "Không thể xóa vì khuyến mãi đã bắt đầu!"
      //   });
      // }

      await Discount.findByIdAndDelete(id);
      return res.status(200).json({ success: true, message: "Xóa khuyến mãi thành công!"});

  } catch (err) {
      console.error(err);
      return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
  }
};

export const unactivateDiscount = async (req, res) => {
  try {
    const { id } = req.params;

    const discount = await Discount.findById(id);
    if (!discount) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy discount"
      });
    }

    discount.is_active = false;
    discount.status = "finished";
    await discount.save();

    return res.json({
      success: true,
      message: "Dừng hoạt động discount thành công"
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + err.message
    });
  }
};

export const updateDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    const discount = await Discount.findById(id);
    if (!discount) {
      return res.status(404).json({ 
        success: false, 
        message: "Không tìm thấy khuyến mãi" 
      });
    }

    const now = new Date();
    const isRunning = discount.is_active && now >= discount.begin_date && now <= discount.end_date;

    // Chặn update một số trường quan trọng khi đang chạy (tùy chọn - có thể bỏ nếu muốn cho phép update)
    // if (isRunning) {
    //   const blockedFields = ["begin_date", "discount", "conditions"];
    //   for (const field of blockedFields) {
    //     if (payload[field] !== undefined) {
    //       return res.status(400).json({
    //         success: false,
    //         message: "Không thể chỉnh sửa khuyến mãi đang hoạt động."
    //       });
    //     }
    //   }
    // }

    // Check trùng code
    if (payload.code) {
      const exist = await Discount.findOne({
        code: payload.code.toUpperCase(),
        _id: { $ne: id }
      });
      if (exist) {
        return res.status(400).json({ 
          success: false, 
          message: "Mã khuyến mãi đã tồn tại." 
        });
      }
      discount.code = payload.code.toUpperCase();
    }

    // Check trùng name
    if (payload.name) {
      const exist = await Discount.findOne({
        name: payload.name,
        _id: { $ne: id }
      });
      if (exist) {
        return res.status(400).json({ 
          success: false, 
          message: "Tên khuyến mãi đã tồn tại." 
        });
      }
      discount.name = payload.name;
    }

    // Update description
    if (payload.description !== undefined) {
      discount.description = payload.description;
    }

    // Validate & update date
    if (payload.begin_date || payload.end_date) {
      const begin = payload.begin_date ? new Date(payload.begin_date) : discount.begin_date;
      const end = payload.end_date ? new Date(payload.end_date) : discount.end_date;

      if (isNaN(begin.getTime()) || isNaN(end.getTime())) {
        return res.status(400).json({ 
          success: false, 
          message: "Định dạng ngày không hợp lệ." 
        });
      }

      if (end <= begin) {
        return res.status(400).json({ 
          success: false, 
          message: "Ngày kết thúc phải sau ngày bắt đầu." 
        });
      }

      discount.begin_date = begin;
      discount.end_date = end;
      
      // Cập nhật is_active và status
      if (now >= begin && now <= end) {
        discount.is_active = true;
        discount.status = "ongoing";
      } else if (now < begin) {
        discount.is_active = false;
        discount.status = "upcoming";
      } else {
        discount.is_active = false;
        discount.status = "finished";
      }
    }

    // Update priority
    if (payload.priority !== undefined) {
      if (typeof payload.priority !== "number" || payload.priority < 1) {
        return res.status(400).json({
          success: false,
          message: "Độ ưu tiên phải là số >= 1"
        });
      }
      discount.priority = payload.priority;
    }

    // Update discount object
    if (payload.discount) {
      const { type, value, max_discount } = payload.discount;

      if (!["PERCENT", "FIXED"].includes(type)) {
        return res.status(400).json({ 
          success: false, 
          message: "Loại giảm giá không hợp lệ." 
        });
      }

      if (value == null || value <= 0) {
        return res.status(400).json({ 
          success: false, 
          message: "Giá trị giảm phải lớn hơn 0." 
        });
      }

      if (type === "PERCENT") {
        if (value > 100) {
          return res.status(400).json({ 
            success: false, 
            message: "Giảm % không vượt quá 100." 
          });
        }
        if (!max_discount || max_discount <= 0) {
          return res.status(400).json({
            success: false,
            message: "Cần cung cấp số tiền khuyến mãi tối đa cho loại phần trăm."
          });
        }
      }

      discount.discount = {
        type,
        value,
        max_discount: type === "PERCENT" ? max_discount : undefined
      };
    }

    // Update conditions
    if (payload.conditions !== undefined) {
      // Nếu conditions là null, xóa tất cả conditions
      if (payload.conditions === null) {
        discount.conditions = {};
      } else {
        const { min_order_value, days_of_week, hours_range, customer_tiers, task_ids } = payload.conditions;

        // Validate min_order_value
        if (min_order_value !== undefined) {
          if (min_order_value < 0) {
            return res.status(400).json({
              success: false,
              message: "Tiền đơn hàng tối thiểu không được âm"
            });
          }
        }

        // Validate days_of_week
        if (days_of_week !== undefined) {
          if (days_of_week !== null && !Array.isArray(days_of_week)) {
            return res.status(400).json({
              success: false,
              message: "days_of_week phải là mảng hoặc null"
            });
          }
          if (Array.isArray(days_of_week)) {
            const invalidDay = days_of_week.some(
              d => typeof d !== "number" || d < 0 || d > 6
            );
            if (invalidDay) {
              return res.status(400).json({
                success: false,
                message: "Ngày trong tuần chỉ nhận giá trị từ 0 đến 6 (0=Chủ nhật, 1=Thứ 2, ..., 6=Thứ 7)."
              });
            }
          }
        }

        // Validate hours_range
        if (hours_range !== undefined) {
          if (hours_range === null) {
            // Cho phép xóa hours_range bằng cách set null
          } else if (hours_range) {
            const { from, to } = hours_range;
            if (
              from == null || to == null ||
              from < 0 || from > 23 ||
              to < 0 || to > 23 ||
              from > to
            ) {
              return res.status(400).json({
                success: false,
                message: "Khung giờ khuyến mãi không hợp lệ"
              });
            }
          }
        }

        // Validate customer_tiers
        if (customer_tiers !== undefined) {
          if (customer_tiers !== null && !Array.isArray(customer_tiers)) {
            return res.status(400).json({
              success: false,
              message: "customer_tiers phải là mảng hoặc null"
            });
          }
          if (Array.isArray(customer_tiers)) {
            const validTiers = ["NEW", "LOYAL", "VIP"];
            const invalidTier = customer_tiers.some(tier => !validTiers.includes(tier));
            if (invalidTier) {
              return res.status(400).json({
                success: false,
                message: "Hạng khách hàng chỉ nhận giá trị: NEW, LOYAL, VIP"
              });
            }
          }
        }

        // Validate task_ids
        if (task_ids !== undefined) {
          if (task_ids !== null && !Array.isArray(task_ids)) {
            return res.status(400).json({
              success: false,
              message: "task_ids phải là mảng hoặc null"
            });
          }
          if (Array.isArray(task_ids)) {
            const mongoose = (await import("mongoose")).default;
            const invalidId = task_ids.some(id => !mongoose.isValidObjectId(id));
            if (invalidId) {
              return res.status(400).json({
                success: false,
                message: "task_ids chứa ID không hợp lệ"
              });
            }
          }
        }

        // Merge conditions - chỉ update các field được gửi lên
        discount.conditions = discount.conditions || {};
        
        if (min_order_value !== undefined) {
          if (min_order_value > 0) {
            discount.conditions.min_order_value = min_order_value;
          } else {
            delete discount.conditions.min_order_value;
          }
        }
        
        if (days_of_week !== undefined) {
          if (days_of_week === null || (Array.isArray(days_of_week) && days_of_week.length === 0)) {
            delete discount.conditions.days_of_week;
          } else if (Array.isArray(days_of_week)) {
            discount.conditions.days_of_week = days_of_week;
          }
        }
        
        if (hours_range !== undefined) {
          if (hours_range === null) {
            delete discount.conditions.hours_range;
          } else if (hours_range) {
            discount.conditions.hours_range = hours_range;
          }
        }
        
        if (customer_tiers !== undefined) {
          if (customer_tiers === null || (Array.isArray(customer_tiers) && customer_tiers.length === 0)) {
            delete discount.conditions.customer_tiers;
          } else if (Array.isArray(customer_tiers)) {
            discount.conditions.customer_tiers = customer_tiers;
          }
        }
        
        if (task_ids !== undefined) {
          if (task_ids === null || (Array.isArray(task_ids) && task_ids.length === 0)) {
            delete discount.conditions.task_ids;
          } else if (Array.isArray(task_ids)) {
            discount.conditions.task_ids = task_ids;
          }
        }
      }
    }

    await discount.save();

    return res.status(200).json({ 
      success: true, 
      message: "Cập nhật khuyến mãi thành công",
      data: discount
    });

  } catch (err) { 
    console.error(err);
    return res.status(500).json({ 
      success: false, 
      message: "SERVER ERROR: " + err.message 
    });
  }
};

//------ VOUCHER -----//
export const createVoucher = async (req, res) => {
  try {
    const { code, name, description, begin_date, end_date, discount,
      applicable_model, conditions, per_user_limit, total_quantity } = req.body;

    if (!code || !name || !description || !begin_date || !end_date) {
      return res.status(400).json({
        success: false,
        message: "Yêu cầu điền đầy đủ thông tin.",
      });
    }

    const begin = new Date(begin_date);
    const end = new Date(end_date);
    const isActive = new Date() >= begin;

    if (isNaN(begin.getTime()) || isNaN(end.getTime())) {
      return res.status(400).json({ message: "Định dạng ngày không hợp lệ." });
    }
    if (end <= begin) {
      return res.status(400).json({ message: "Ngày kết thúc phải sau ngày bắt đầu." });
    }
    if (begin <= new Date()) {
      return res.status(400).json({ message: "Ngày bắt đầu không được ở trong quá khứ." });
    }

    if (!total_quantity || total_quantity < 1) {
      return res.status(400).json({ message: "Tổng số voucher ít nhất phải là 1." });
    }

    if (!per_user_limit || per_user_limit < 1) {
      return res.status(400).json({ message: "Số lượt voucher một khách hàng được sử dụng ít nhất phải là 1." });
    }

    // loại voucher
    if (!["PERCENT", "FIXED"].includes(discount.type)) {
      return res.status(400).json({ message: "Loại giảm giá không hợp lệ, chỉ có giảm theo % hoặc cố định." });
    }

    if (discount.value <= 0) {
      return res.status(400).json({ message: "Tỉ lệ giảm giá không được bé hơn 0." });
    }

    // loại voucher là giảm giá xx% theo giá trị đơn hàng
    if (discount.type === "PERCENT") {
      if (discount.value > 100) {
        return res.status(400).json({ message: "Phần trăm giảm giá không được vượt quá 100%." });
      }

      if ( discount.max_discount !== undefined && discount.max_discount <= 0 ) {
        return res.status(400).json({ message: "Phần trăm giảm giá không được bé hơn 0." });
      }
    }

    // điều kiện áp dụng voucher
    if (conditions) {
      const { rule_type, min_order_value } = conditions;

      if (rule_type && !["FIRST_ORDER", "GENERAL"].includes(rule_type)) {
        return res.status(400).json({ message: "Điều kiện áp dụng voucher không hợp lệ." });
      }

      if ( rule_type === "GENERAL" && min_order_value !== undefined && min_order_value < 0) {
        return res.status(400).json({ message: "Giá trị đơn hàng tối thiểu phải lớn hơn 0." });
      }
    }

    const existing = await Voucher.findOne({ code: code.toUpperCase() });
    if (existing) {
      return res.status(400).json({ success: false, message: "Mã voucher đã tồn tại." });
    }

    const existingName = await Voucher.findOne({ name });
    if (existingName) {
      return res.status(400).json({ success: false, message: "Tên voucher đã tồn tại." });
    }

    const voucher = new Voucher({ 
      code, name, description, begin_date: begin, end_date: end, discount,
      total_quantity, applicable_model, conditions, per_user_limit, is_active: isActive
    });
    await voucher.save();

    return res.status(201).json({ success: true, message: "Thêm voucher mới thành công!", voucher });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
  }
};

export const getAllVouchers = async (req, res) => {
  try {
    const { code, is_active, rule_type, customer_tier, service,
      status, page = 1, limit = 10 } = req.query;

    const filter = {};

    if (code) filter.code = code;
    if (status) filter.status = status;
    if (is_active) filter.is_active = is_active;

    if (rule_type) {
      filter["conditions.rule_type"] = rule_type;
    }

    if (customer_tier) {
      filter["conditions.customer_tiers"] = customer_tier;
    }

    if (service) {
      filter.$or = [
        { applicable_model: { $size: 0 } },
        { applicable_model: service }
      ];
    }

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const vouchers = await Voucher
      .find(filter)
      .select("-__v")
      .sort({ created_at: -1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    const total = await Voucher.countDocuments(filter);

    return res.status(200).json({
      success: true,
      page: Number(page),
      limit: Number(limit),
      total,
      data: vouchers
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
  }
};

export const getVoucherById = async (req, res) => {
  try {
    const { id } = req.params;
    const voucher = await Voucher.findById(id).select("-__v -created_at -updated_at");

    if (!voucher)
      return res.status(404).json({ success: false, message: "Không tìm thấy voucher!" });

    return res.status(200).json({ success: true, voucher });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
  }
};

export const deleteVoucher = async (req, res) => {
  try {
    const { id } = req.params;

    const voucher = await Voucher.findById(id);
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy voucher!"
      });
    }

    const now = new Date();

    // đang trong thời gian hoạt động
    if (voucher.is_active && now >= voucher.begin_date && now <= voucher.end_date) {
      return res.status(400).json({
        success: false,
        message: "Không thể xóa voucher đang trong thời gian hoạt động."
      });
    }

    await Voucher.findByIdAndDelete(id);

    return res.status(200).json({
      success: true,
      message: "Xóa voucher thành công!"
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + err.message
    });
  }
};

export const unactivateVoucher = async (req, res) => {
  try {
    const { id } = req.params;

    const voucher = await Voucher.findById(id);
    if (!voucher) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy voucher"
      });
    }

    voucher.is_active = false;
    voucher.status = "finished";
    await voucher.save();

    return res.json({
      success: true,
      message: "Dừng hoạt động voucher thành công"
    });

  } catch (err) {
    return res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + err.message
    });
  }
};

export const updateVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const payload = req.body;

    const voucher = await Voucher.findById(id);
    if (!voucher) {
      return res.status(404).json({ message: "Không tìm thấy voucher." });
    }

    const now = new Date();
    const isRunning = voucher.is_active && now >= voucher.begin_date && now <= voucher.end_date;

    // chặn update logic quan trọng khi đang chạy
    if (isRunning) {
      const blockedFields = ["begin_date", "discount", "conditions"];
      for (const field of blockedFields) {
        if (payload[field] !== undefined) {
          return res.status(400).json({
            message: "Không thể chỉnh sửa voucher đang hoạt động."
          });
        }
      }
    }

    // check trùng code
    if (payload.code) {
      const exist = await Voucher.findOne({
        code: payload.code.toUpperCase(),
        _id: { $ne: id }
      });
      if (exist) {
        return res.status(400).json({ message: "Mã voucher đã tồn tại." });
      }
      voucher.code = payload.code.toUpperCase();
    }

    // check trùng name
    if (payload.name) {
      const exist = await Voucher.findOne({
        name: payload.name,
        _id: { $ne: id }
      });
      if (exist) {
        return res.status(400).json({ message: "Tên voucher đã tồn tại." });
      }
      voucher.name = payload.name;
    }

    // validate & update date
    if (payload.begin_date || payload.end_date) {
      const begin = payload.begin_date ? new Date(payload.begin_date) : voucher.begin_date;
      const end = payload.end_date ? new Date(payload.end_date) : voucher.end_date;

      if (end <= begin) {
        return res.status(400).json({ message: "Ngày kết thúc phải sau ngày bắt đầu." });
      }

      voucher.begin_date = begin;
      voucher.end_date = end;
      voucher.is_active = now >= begin;
    }

    // discount
    if (payload.discount) {
      const { type, value, max_discount } = payload.discount;

      if (!["PERCENT", "FIXED"].includes(type)) {
        return res.status(400).json({ message: "Loại giảm giá không hợp lệ." });
      }

      if (value <= 0) {
        return res.status(400).json({ message: "Giá trị giảm phải lớn hơn 0." });
      }

      if (type === "PERCENT" && value > 100) {
        return res.status(400).json({ message: "Giảm % không vượt quá 100." });
      }

      voucher.discount = payload.discount;
    }

    // điều kiện áp dụng voucher
    if (payload.conditions) {
      const { rule_type, min_order_value } = payload.conditions;

      if (rule_type && !["FIRST_ORDER", "GENERAL"].includes(rule_type)) {
        return res.status(400).json({ message: "Điều kiện áp dụng voucher không hợp lệ." });
      }

      if ( rule_type === "GENERAL" && min_order_value !== undefined && min_order_value < 0) {
        return res.status(400).json({ message: "Giá trị đơn hàng tối thiểu phải lớn hơn 0." });
      }

      voucher.conditions = payload.conditions;
    }

    if (payload.total_quantity !== undefined) {
      if (payload.total_quantity < 1)
        return res.status(400).json({ message: "Tổng số voucher ít nhất phải là 1." });

      voucher.total_quantity = payload.total_quantity;
    }

    if (payload.per_user_limit !== undefined) {
      if (payload.per_user_limit < 1)
        return res.status(400).json({ message: "Số lượt voucher một khách hàng được sử dụng ít nhất phải là 1." });

      voucher.per_user_limit = payload.per_user_limit;
    }

    if (payload.description !== undefined) {
      voucher.description = payload.description;
    }

    if (payload.applicable_model !== undefined) {
      voucher.applicable_model = payload.applicable_model;
    }

    await voucher.save();

    return res.status(200).json({
      success: true,
      message: "Cập nhật voucher thành công",
      voucher
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ message: err.message });
  }
};

// hàm trả về danh sách voucher phù hợp với khách hàng
export const getEligibleVouchers = async (req, res) => {
  try {
    const { total_amount, customer_id } = req.body;
    const userId = customer_id? customer_id : req.userId;

    if (!total_amount || total_amount <= 0) {
      return res.status(400).json({
        success: false,
        message: "Tổng tiền đơn hàng không hợp lệ."
      });
    }

    const now = new Date();

    // lấy các voucher còn hiệu lực theo thời gian
    const vouchers = await Voucher.find({
      is_active: true,
      begin_date: { $lte: now },
      end_date: { $gte: now },
      $or: [
        { total_quantity: null }, // không giới hạn lượt dùng
        {
          $expr: { $lt: ["$used_quantity", "$total_quantity"] }
        }
      ]
    }).lean();


    if (!vouchers.length) {
      return res.json({ success: true, total: 0, vouchers: [] });
    }

    // lấy usage của user
    const usages = await VoucherUsage.aggregate([
      { $match: { user_id: userId } },
      {
        $group: {
          _id: "$voucher_id",
          used_count: { $sum: "$used_count" }
        }
      }
    ]);

    const usageMap = new Map();
    usages.forEach(u => {
      usageMap.set(String(u._id), u.used_count);
    });

    // đếm tổng số voucher user đã dùng (cho voucher đơn hàng đầu tiên)
    const totalUserUsed = usages.reduce((sum, u) => sum + u.used_count, 0);

    // lấy hạng khách
    const customer = await Customer.findOne({ user_id: userId }).select("type");
    if (!customer) {
      return res.status(404).json({ message: "Không tìm thấy khách hàng." });
    }
    const customerType = (customer.type).toUpperCase();
    console.log("CUSTOMER TYPE: ", customerType);

    // lọc voucher hợp lệ
    const eligibleVouchers = [];

    for (const voucher of vouchers) {
      const conditions = voucher.conditions || {};
      const usedByUser = usageMap.get(String(voucher._id)) || 0;

      // số lần sử dụng trên người
      if (voucher.per_user_limit != null && usedByUser >= voucher.per_user_limit) continue;

      // giá trị tối thiểu của đơn hàng
      if (
        conditions.min_order_value !== undefined &&
        total_amount < conditions.min_order_value
      ) continue;

      // đơn hàng đầu tiên
      if (
        conditions.rule_type === "FIRST_ORDER" &&
        customer.total_completed_orders > 0
      ) continue;

      // hạng thành viên
      const allowedTypes = conditions.customer_tiers || [];
      if (
        allowedTypes.length > 0 &&
        !allowedTypes.includes(customerType)
      ) continue;

      // tính preview discount
      let discountPreview = 0;

      if (voucher.discount.type === "PERCENT") {
        discountPreview = total_amount * (voucher.discount.value / 100);

        if (
          voucher.discount.max_discount &&
          discountPreview > voucher.discount.max_discount
        ) {
          discountPreview = voucher.discount.max_discount;
        }
      }

      if (voucher.discount.type === "FIXED") {
        discountPreview = voucher.discount.value;
      }

      discountPreview = Math.min(discountPreview, total_amount);
      eligibleVouchers.push({
        _id: voucher._id,
        code: voucher.code,
        name: voucher.name,
        description: voucher.description,
        discount_preview: Math.round(discountPreview)
      });
    }

    eligibleVouchers.sort(
      (a, b) => b.discount_preview - a.discount_preview
    );

    return res.json({
      success: true,
      total: eligibleVouchers.length,
      vouchers: eligibleVouchers
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: err.message
    });
  }
};

// hàm xem trước khuyến mãi
export const getPreviewDiscount = async (req, res) => {
  try {
    const userId = req.userId;

    // Lấy thông tin customer
    const customer = await Customer.findOne({ user_id: userId }).select("type");
    const customerTier = customer?.type?.toUpperCase() || "NEW";

    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();

    // Tìm tất cả discount phù hợp (không filter theo taskId, lấy cả global và specific)
    const discounts = await Discount.find({
      is_active: true,
      begin_date: { $lte: now },
      end_date: { $gte: now },
      $and: [
        // theo hạng khách
        {
          $or: [
            { "conditions.customer_tiers": { $exists: false } },
            { "conditions.customer_tiers": { $size: 0 } },
            { "conditions.customer_tiers": customerTier }
          ]
        },
        // theo ngày trong tuần
        {
          $or: [
            { "conditions.days_of_week": { $exists: false } },
            { "conditions.days_of_week": { $size: 0 } },
            { "conditions.days_of_week": dayOfWeek }
          ]
        },
        // theo giờ
        {
          $or: [
            { "conditions.hours_range": { $exists: false } },
            {
              "conditions.hours_range.from": { $lte: hour },
              "conditions.hours_range.to": { $gte: hour }
            }
          ]
        }
      ]
    }).sort({ priority: -1 });

    return res.status(200).json({
      success: true,
      discounts: discounts.map(d => ({
        id: d._id,
        code: d.code,
        name: d.name,
        description: d.description,
        type: d.discount.type,
        value: d.discount.value,
        max_discount: d.discount.max_discount,
        priority: d.priority,
        is_global: !d.conditions?.task_ids || d.conditions.task_ids.length === 0,
        conditions: d.conditions ? {
          min_order_value: d.conditions.min_order_value,
          task_ids: d.conditions.task_ids || [],
          days_of_week: d.conditions.days_of_week || [],
          hours_range: d.conditions.hours_range,
          customer_tiers: d.conditions.customer_tiers || []
        } : null
      }))
    });

  } catch (err) {
    console.error(err);
    return res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + err.message
    });
  }
};

// Hàm lấy danh sách discount và voucher đang hoạt động cho customer (để hiển thị trên trang chủ)
export const getActivePromotions = async (req, res) => {
  try {
    const userId = req.userId;
    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();

    // Lấy thông tin customer
    const customer = await Customer.findOne({ user_id: userId }).select("type total_completed_orders");
    const customerTier = customer?.type?.toUpperCase() || "NEW";

    // Lấy discount đang hoạt động và phù hợp
    const discounts = await Discount.find({
      is_active: true,
      begin_date: { $lte: now },
      end_date: { $gte: now },
      $and: [
        {
          $or: [
            { "conditions.customer_tiers": { $exists: false } },
            { "conditions.customer_tiers": { $size: 0 } },
            { "conditions.customer_tiers": customerTier }
          ]
        },
        {
          $or: [
            { "conditions.days_of_week": { $exists: false } },
            { "conditions.days_of_week": { $size: 0 } },
            { "conditions.days_of_week": dayOfWeek }
          ]
        },
        {
          $or: [
            { "conditions.hours_range": { $exists: false } },
            {
              "conditions.hours_range.from": { $lte: hour },
              "conditions.hours_range.to": { $gte: hour }
            }
          ]
        }
      ]
    })
      .select("-__v")
      .sort({ priority: -1, created_at: -1 })
      .limit(10)
      .lean();

    // Lấy voucher đang hoạt động
    const vouchers = await Voucher.find({
      is_active: true,
      begin_date: { $lte: now },
      end_date: { $gte: now },
      $or: [
        { total_quantity: null },
        { $expr: { $lt: ["$used_quantity", "$total_quantity"] } }
      ]
    })
      .select("-__v")
      .sort({ created_at: -1 })
      .limit(10)
      .lean();

    // Lấy usage của user cho voucher
    const { VoucherUsage } = await import("../models/index.js");
    const usages = await VoucherUsage.aggregate([
      { $match: { user_id: userId } },
      {
        $group: {
          _id: "$voucher_id",
          used_count: { $sum: "$used_count" }
        }
      }
    ]);
    const usageMap = new Map();
    usages.forEach(u => {
      usageMap.set(String(u._id), u.used_count);
    });

    // Format discount
    const formattedDiscounts = discounts.map(d => {
      const discountText = d.discount.type === "PERCENT"
        ? `Giảm ${d.discount.value}%${d.discount.max_discount ? ` (tối đa ${d.discount.max_discount.toLocaleString("vi-VN")}đ)` : ""}`
        : `Giảm ${d.discount.value.toLocaleString("vi-VN")}đ`;

      return {
        id: d._id.toString(),
        type: "discount",
        code: d.code,
        name: d.name,
        description: d.description || "",
        discount_text: discountText,
        discount_type: d.discount.type,
        discount_value: d.discount.value,
        max_discount: d.discount.max_discount,
        begin_date: d.begin_date,
        end_date: d.end_date,
        conditions: d.conditions || {},
        priority: d.priority || 1
      };
    });

    // Format voucher (lọc theo điều kiện customer)
    const formattedVouchers = [];
    for (const v of vouchers) {
      const conditions = v.conditions || {};
      const usedByUser = usageMap.get(String(v._id)) || 0;

      // Kiểm tra per_user_limit
      if (v.per_user_limit != null && usedByUser >= v.per_user_limit) continue;

      // Kiểm tra đơn hàng đầu tiên
      if (conditions.rule_type === "FIRST_ORDER" && customer?.total_completed_orders > 0) continue;

      // Kiểm tra hạng thành viên
      const allowedTypes = conditions.customer_tiers || [];
      if (allowedTypes.length > 0 && !allowedTypes.includes(customerTier)) continue;

      const discountText = v.discount.type === "PERCENT"
        ? `Giảm ${v.discount.value}%${v.discount.max_discount ? ` (tối đa ${v.discount.max_discount.toLocaleString("vi-VN")}đ)` : ""}`
        : `Giảm ${v.discount.value.toLocaleString("vi-VN")}đ`;

      formattedVouchers.push({
        id: v._id.toString(),
        type: "voucher",
        code: v.code,
        name: v.name,
        description: v.description || "",
        discount_text: discountText,
        discount_type: v.discount.type,
        discount_value: v.discount.value,
        max_discount: v.discount.max_discount,
        begin_date: v.begin_date,
        end_date: v.end_date,
        conditions: v.conditions || {},
        total_quantity: v.total_quantity,
        used_quantity: v.used_quantity,
        per_user_limit: v.per_user_limit,
        applicable_model: v.applicable_model || []
      });
    }

    // Gộp và sắp xếp: discount trước (priority cao), sau đó voucher
    const allPromotions = [
      ...formattedDiscounts.map(d => ({ ...d, sortKey: d.priority * 1000 })),
      ...formattedVouchers.map(v => ({ ...v, sortKey: 0 }))
    ].sort((a, b) => b.sortKey - a.sortKey).slice(0, 10);

    return res.json({
      success: true,
      promotions: allPromotions
    });

  } catch (err) {
    console.error("Error getting active promotions:", err);
    return res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + err.message
    });
  }
};

// Hàm lấy chi tiết discount hoặc voucher theo ID
export const getPromotionDetail = async (req, res) => {
  try {
    const { id, type } = req.params; // type = "discount" hoặc "voucher"
    const userId = req.userId;

    if (type === "discount") {
      const discount = await Discount.findById(id).select("-__v");
      if (!discount) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy khuyến mãi"
        });
      }

      // Lấy thông tin customer để kiểm tra điều kiện
      const customer = await Customer.findOne({ user_id: userId }).select("type");
      const customerTier = customer?.type?.toUpperCase() || "NEW";
      const now = new Date();
      const dayOfWeek = now.getDay();
      const hour = now.getHours();

      // Kiểm tra điều kiện
      let isEligible = true;
      const reasons = [];

      if (discount.conditions?.customer_tiers && discount.conditions.customer_tiers.length > 0) {
        if (!discount.conditions.customer_tiers.includes(customerTier)) {
          isEligible = false;
          reasons.push(`Chỉ áp dụng cho khách hàng hạng: ${discount.conditions.customer_tiers.join(", ")}`);
        }
      }

      if (discount.conditions?.days_of_week && discount.conditions.days_of_week.length > 0) {
        if (!discount.conditions.days_of_week.includes(dayOfWeek)) {
          isEligible = false;
          const dayNames = ["Chủ nhật", "Thứ 2", "Thứ 3", "Thứ 4", "Thứ 5", "Thứ 6", "Thứ 7"];
          const validDays = discount.conditions.days_of_week.map(d => dayNames[d]).join(", ");
          reasons.push(`Chỉ áp dụng vào: ${validDays}`);
        }
      }

      if (discount.conditions?.hours_range) {
        const { from, to } = discount.conditions.hours_range;
        if (hour < from || hour > to) {
          isEligible = false;
          reasons.push(`Chỉ áp dụng trong khung giờ: ${from}:00 - ${to}:00`);
        }
      }

      const discountText = discount.discount.type === "PERCENT"
        ? `Giảm ${discount.discount.value}%${discount.discount.max_discount ? ` (tối đa ${discount.discount.max_discount.toLocaleString("vi-VN")}đ)` : ""}`
        : `Giảm ${discount.discount.value.toLocaleString("vi-VN")}đ`;

      return res.json({
        success: true,
        promotion: {
          id: discount._id.toString(),
          type: "discount",
          code: discount.code,
          name: discount.name,
          description: discount.description || "",
          discount_text: discountText,
          discount_type: discount.discount.type,
          discount_value: discount.discount.value,
          max_discount: discount.discount.max_discount,
          begin_date: discount.begin_date,
          end_date: discount.end_date,
          conditions: discount.conditions || {},
          priority: discount.priority || 1,
          is_active: discount.is_active,
          status: discount.status,
          is_eligible: isEligible,
          eligibility_reasons: reasons
        }
      });
    } else if (type === "voucher") {
      const voucher = await Voucher.findById(id).select("-__v");
      if (!voucher) {
        return res.status(404).json({
          success: false,
          message: "Không tìm thấy voucher"
        });
      }

      // Lấy thông tin customer
      const customer = await Customer.findOne({ user_id: userId }).select("type total_completed_orders");
      const customerTier = customer?.type?.toUpperCase() || "NEW";

      // Lấy usage
      const { VoucherUsage } = await import("../models/index.js");
      const usage = await VoucherUsage.aggregate([
        { $match: { user_id: userId, voucher_id: voucher._id } },
        { $group: { _id: null, used_count: { $sum: "$used_count" } } }
      ]);
      const usedByUser = usage[0]?.used_count || 0;

      // Kiểm tra điều kiện
      let isEligible = true;
      const reasons = [];
      const conditions = voucher.conditions || {};

      if (voucher.per_user_limit != null && usedByUser >= voucher.per_user_limit) {
        isEligible = false;
        reasons.push(`Bạn đã sử dụng hết lượt (${voucher.per_user_limit} lượt)`);
      }

      if (conditions.rule_type === "FIRST_ORDER" && customer?.total_completed_orders > 0) {
        isEligible = false;
        reasons.push("Chỉ áp dụng cho đơn hàng đầu tiên");
      }

      if (conditions.customer_tiers && conditions.customer_tiers.length > 0) {
        if (!conditions.customer_tiers.includes(customerTier)) {
          isEligible = false;
          reasons.push(`Chỉ áp dụng cho khách hàng hạng: ${conditions.customer_tiers.join(", ")}`);
        }
      }

      if (voucher.total_quantity != null && voucher.used_quantity >= voucher.total_quantity) {
        isEligible = false;
        reasons.push("Voucher đã hết lượt sử dụng");
      }

      const discountText = voucher.discount.type === "PERCENT"
        ? `Giảm ${voucher.discount.value}%${voucher.discount.max_discount ? ` (tối đa ${voucher.discount.max_discount.toLocaleString("vi-VN")}đ)` : ""}`
        : `Giảm ${voucher.discount.value.toLocaleString("vi-VN")}đ`;

      return res.json({
        success: true,
        promotion: {
          id: voucher._id.toString(),
          type: "voucher",
          code: voucher.code,
          name: voucher.name,
          description: voucher.description || "",
          discount_text: discountText,
          discount_type: voucher.discount.type,
          discount_value: voucher.discount.value,
          max_discount: voucher.discount.max_discount,
          begin_date: voucher.begin_date,
          end_date: voucher.end_date,
          conditions: voucher.conditions || {},
          total_quantity: voucher.total_quantity,
          used_quantity: voucher.used_quantity,
          remaining_quantity: voucher.total_quantity ? voucher.total_quantity - voucher.used_quantity : null,
          per_user_limit: voucher.per_user_limit,
          used_by_user: usedByUser,
          remaining_for_user: voucher.per_user_limit ? voucher.per_user_limit - usedByUser : null,
          applicable_model: voucher.applicable_model || [],
          is_active: voucher.is_active,
          status: voucher.status,
          is_eligible: isEligible,
          eligibility_reasons: reasons
        }
      });
    } else {
      return res.status(400).json({
        success: false,
        message: "Loại khuyến mãi không hợp lệ (phải là 'discount' hoặc 'voucher')"
      });
    }

  } catch (err) {
    console.error("Error getting promotion detail:", err);
    return res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + err.message
    });
  }
};

// Hàm lấy giá sau discount cho danh sách services
export const getServicePricesWithDiscount = async (req, res) => {
  try {
    const userId = req.userId;
    const { task_ids, check_time } = req.body; // task_ids là array of task IDs

    if (!task_ids || !Array.isArray(task_ids) || task_ids.length === 0) {
      return res.status(400).json({
        success: false,
        message: "Cần cung cấp danh sách task_ids"
      });
    }

    // Lấy thông tin tasks để có base price
    const { Task } = await import("../models/index.js");
    const tasks = await Task.find({
      _id: { $in: task_ids }
    }).select("_id pricing");

    if (tasks.length === 0) {
      return res.status(404).json({
        success: false,
        message: "Không tìm thấy dịch vụ nào"
      });
    }

    // Tính discount cho từng service
    const { calculateDiscountForService } = await import("../services/discount.service.js");
    const checkTime = check_time ? new Date(check_time) : new Date();

    const results = await Promise.all(
      tasks.map(async (task) => {
        const result = await calculateDiscountForService({
          userId,
          taskId: task._id.toString(),
          basePrice: task.pricing,
          checkTime
        });

        const originalPrice = task.pricing || 0;
        const discountAmount = result.discountAmount || 0;
        const finalPrice = result.finalPrice || originalPrice;
        const discountPercent = originalPrice > 0 
          ? Math.round((discountAmount / originalPrice) * 100) 
          : 0;

        return {
          task_id: task._id.toString(),
          original_price: originalPrice,
          discount_amount: discountAmount,
          final_price: finalPrice,
          discount_percent: discountPercent,
          has_discount: discountAmount > 0,
          discount_info: result.discountInfo ? {
            id: result.discountInfo.id,
            code: result.discountInfo.code,
            name: result.discountInfo.name,
            description: result.discountInfo.description,
            type: result.discountInfo.type,
            value: result.discountInfo.value,
            discount_amount: result.discountInfo.discountAmount
          } : null
        };
      })
    );

    return res.json({
      success: true,
      services: results
    });

  } catch (err) {
    console.error("Error getting service prices with discount:", err);
    return res.status(500).json({
      success: false,
      message: "SERVER ERROR: " + err.message
    });
  }
};



