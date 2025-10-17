import jwt from "jsonwebtoken";
import dotenv from "dotenv";
import Account from "../models/accounts.js";

dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET || "secret_key";

export const isAdmin = (req, res, next) => {
  if (req.system_role !== "admin") {
    return res.status(403).json({ message: "You are not allowed to do this action." });
  }
  next();
};

export const isTasker = (req, res, next) => {
    if (req.system_role !== "tasker"){
        return res.status(403).json({ message: "You are not allowed to do this action."});
    }
    next();
};
