import { Discount, Voucher } from "../models/index.js";
import { validateDate } from "../utils/validateDate.js";

//------ DISCOUNT -------//
export const createDiscount = async (req, res) => {
  try {
    const { name, description, begin_date, end_date, percentage, appliesTo } = req.body;

    if (!name || !description || !begin_date || !end_date || !percentage || !appliesTo) {
      return res.status(400).json({
        success: false,
        message: "Please fill all the required information.",
      });
    }

    const validDate = validateDate({ begin_date, end_date });
    if (!validDate.valid)
      return res.status(400).json({ success: false, message: validDate.message });

    if (percentage <= 0 || percentage > 100) {
      return res.status(400).json({ success: false, message: "Discount percentage must be between 1% and 100%." });
    }

    const existing = await Discount.findOne({ name });
    if (existing) {
      return res.status(400).json({ success: false, message: "Discount's name already existed." });
    }

    const discount = new Discount({ name, description, begin_date: validDate.begin, end_date: validDate.end, percentage, appliesTo });
    await discount.save();

    return res.status(201).json({ success: true, message: "Create new discount successfully!", discount });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
  }
};

export const getAllDiscounts = async (req, res) => {
    try {
        const discounts = await Discount.find().sort({ createdAt: -1 });
        return res.status(200).json({ success: true, discounts });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

export const getDiscountById = async (req, res) => {
    try {
        const { id } = req.params;
        const discount = await Discount.findById(id);

        if (!discount)
          return res.status(404).json({ success: false, message: "Discount not found!" });

        return res.status(200).json({ success: true, discount });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

export const deleteDiscount = async (req, res) => {
    try {
        const { id } = req.params;
        const discount = await Discount.findByIdAndDelete(id);

        if (!discount)
          return res.status(404).json({ success: false, message: "Discount not found!" });

        const now = new Date();
        if (now >= discount.begin_date) {
          return res.status(400).json({
            success: false,
            message: "Unable to delete as discount already began!"
          });
        }

        return res.status(200).json({ success: true, message: "Delete discount successfully!"});

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

export const updateDiscount = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, begin_date, end_date, percentage, appliesTo } = req.body;

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
    if (appliesTo) discount.appliesTo = appliesTo;

    if (typeof percentage !== "undefined") {
      if (percentage < 0 || percentage > 100)
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
    const { name, description, begin_date, end_date, percentage, appliesTo, quantity, usage_rules } = req.body;

    if (!name || !description || !begin_date || !end_date || !percentage || !appliesTo || !quantity || !usage_rules) {
      return res.status(400).json({
        success: false,
        message: "Please fill all the required information.",
      });
    }

    const validDate = validateDate({ begin_date, end_date });
    if (!validDate.valid)
      return res.status(400).json({ success: false, message: validDate.message });

    if (percentage <= 0 || percentage > 100) {
      return res.status(400).json({ success: false, message: "Voucher percentage must be between 1% and 100%." });
    }

    const existing = await Voucher.findOne({ name });
    if (existing) {
      return res.status(400).json({ success: false, message: "Voucher's name already existed." });
    }

    const voucher = new Voucher({ name, description, begin_date: validDate.begin, end_date: validDate.end, percentage, appliesTo, quantity, usage_rules });
    await voucher.save();

    return res.status(201).json({ success: true, message: "Create new voucher successfully!", voucher });

  } catch (err) {
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR:", err: err.message });
  }
};

export const getAllVouchers = async (req, res) => {
    try {
        const vouchers = await Voucher.find().sort({ createdAt: -1 });
        return res.status(200).json({ success: true, vouchers });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

export const getVoucherById = async (req, res) => {
    try {
        const { id } = req.params;
        const voucher = await Voucher.findById(id);

        if (!voucher)
          return res.status(404).json({ success: false, message: "Voucher not found!" });

        return res.status(200).json({ success: true, voucher });

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

export const deleteVoucher = async (req, res) => {
    try {
        const { id } = req.params;
        const voucher = await Voucher.findByIdAndDelete(id);

        if (!voucher)
          return res.status(404).json({ success: false, message: "Voucher not found!" });

        const now = new Date();
        if (now >= voucher.begin_date) {
          return res.status(400).json({
            success: false,
            message: "Unable to delete as voucher already began!"
          });
        }

        return res.status(200).json({ success: true, message: "Delete voucher successfully!"});

    } catch (err) {
        console.error(err);
        return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
    }
};

export const updateVoucher = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, begin_date, end_date, percentage, appliesTo, usage_rules, quantity } = req.body;

    const voucher = await Voucher.findById(id);
    if (!voucher)
      return res.status(404).json({ success: false, message: "Voucher not found!" });

    const now = new Date();
    if (now >= voucher.begin_date) {
      return res.status(400).json({
        success: false,
        message: "Unable to update as voucher already began!"
      });
    }

    if (begin_date || end_date) {
      const validDate = validateDate({ begin_date, end_date });
      if (!validDate.valid)
        return res.status(400).json({ success: false, message: validDate.message });

      voucher.begin_date = validDate.begin;
      voucher.end_date = validDate.end;
    }

    if (name && name !== voucher.name) {
      const existing = await Voucher.findOne({ name, _id: { $ne: id } });
      if (existing)
          return res.status(400).json({ success: false, message: "Voucher'name already exists." });
      voucher.name = name;
    }

    if (description) voucher.description = description;
    if (appliesTo) voucher.appliesTo = appliesTo;
    if (quantity) voucher.quantity = quantity;

    if (typeof percentage !== "undefined") {
      if (percentage < 0 || percentage > 100)
        return res.status(400).json({ success: false, message: "Voucher's percentage must be between 1%  and 100%." });
      voucher.percentage = percentage;
    }

    await voucher.save();
    return res.status(200).json({ success: true, message: "Update voucher successfully!", voucher });

  } catch (err) { 
    console.error(err);
    return res.status(500).json({ success: false, message: "SERVER ERROR: " + err.message });
  }
};

