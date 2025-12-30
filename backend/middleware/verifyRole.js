import jwt from "jsonwebtoken";
import dotenv from "dotenv";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "secret_key";

export const isAdmin = (req, res, next) => {
  if (req.system_role !== "admin") {
    return res.status(403).json({ message: "You aren't Admin, not allowed to do this action." });
  }
  next();
};

export const isTasker = (req, res, next) => {
  if (req.system_role !== "tasker"){
      return res.status(403).json({ message: "You aren't Tasker, not allowed to do this action."});
  }
  next();
};

export const isCustomer = (req, res, next) => {
  if (req.system_role !== "customer"){
      return res.status(403).json({ message: "You aren't Customer, not allowed to do this action."});
  }
  next();
};
