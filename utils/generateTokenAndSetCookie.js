import jwt from "jsonwebtoken";

export const generateTokenAndSetCookie = async (res, userId, role) => {
  const token = jwt.sign({ userId, role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });

  res.cookie("token", token, {
    maxAge: 7 * 24 * 60 * 60 * 1000,
    httpOnly: true, // Prevent XSS attacks
    sameSite: "strict", // Prevent CSRF attacks
    secure: process.env.NODE_ENV === "production",
  });

  return token;
};
