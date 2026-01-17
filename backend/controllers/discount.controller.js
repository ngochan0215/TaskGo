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
      const { min_order_value, days_of_week, hours_range } = conditions;

      if (min_order_value != null && min_order_value < 0) {
        return res.status(400).json({
          success: false,
          message: "Tiền đơn hàng tối thiểu không được âm"
        });
      }

      if (days_of_week) {
        const invalidDay = days_of_week.some(
          d => typeof d !== "number" || d < 0 || d > 6
        );
        if (invalidDay) {
          return res.status(400).json({
            success: false,
            message: "Ngày trong tuần chỉ nhận giá trị từ 0 đến 6 (thứ 2 đến chủ nhật)."
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
    if (now >= begin && now <= end) {
      is_active = true;
    }

    const newDiscount = await Discount.create({
      code,
      name,
      description,
      discount,
      conditions,
      begin_date: begin,
      end_date: end,
      priority,
      is_active,
      status: is_active? "ongoing" : "upcoming"
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
      .select("-__v -created_at -updated_at")
      .sort({ created_at: -1 })
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
    const { name, description, begin_date, end_date, percentage, applied_model, applied_model_id } = req.body;

    const discount = await Discount.findById(id);
    if (!discount)
      return res.status(404).json({ success: false, message: "Discount not found!" });

    const now = new Date();
    if (now >= discount.begin_date) {
      return res.status(400).json({
        success: false,
        message: "Unable to update as discount already began!"
      });
    }

    if (discount.end_date < now) {
      return res.status(400).json({
        success: false,
        message: "Cannot update completed discount"
      });
    }

    if (begin_date || end_date) {
      const validDate = validateDate({ begin_date, end_date });
      if (!validDate.valid)
        return res.status(400).json({ success: false, message: validDate.message });

      discount.begin_date = validDate.begin;
      discount.end_date = validDate.end;
    }

    if (name && name !== discount.name) {
      const existing = await Discount.findOne({ name, _id: { $ne: id } });
      if (existing)
        return res.status(400).json({ success: false, message: "Discount's name already exists." });
      discount.name = name;
    }

    if (description) discount.description = description;
    if (applied_model) discount.applied_model = applied_model;

    if (typeof percentage !== "undefined") {
      if (percentage <= 0 || percentage > 100)
        return res.status(400).json({ success: false, message: "Discount's percentage must be between 1% and 100%." });
      discount.percentage = percentage;
    }

    await discount.save();
    return res.status(200).json({ success: true, message: "Update discount successfully!", discount });

  } catch (err) { 
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
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

    const vouchers = await Voucher
      .find(filter)
      .select("-__v -created_at -updated_at")
      .sort({ created_at: -1 })
      .lean();

    return res.status(200).json({
      total: vouchers.length,
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

    // lấy thông tin customer
    const customer = await Customer.findOne({ user_id: userId }).select("tier");
    const customerTier = customer?.tier;

    const now = new Date();
    const dayOfWeek = now.getDay();
    const hour = now.getHours();

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
        type: d.discount.type,
        value: d.discount.value,
        priority: d.priority,
        is_global:
          !d.conditions?.task_ids || d.conditions.task_ids.length === 0
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



