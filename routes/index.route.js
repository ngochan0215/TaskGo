import authRoutes from "./auth.route.js";
import userRoutes from "./user.route.js";
import adminRoutes from "./admin.route.js";
import orderRoutes from "./order.route.js"
import taskRoutes from "./task.route.js"

const initRoute = (app) => {
  app.use("/api/auth", authRoutes);
  app.use("/api/user", userRoutes);
  app.use("/api/admin", adminRoutes);
  app.use("/api/orders", orderRoutes);
  app.use("/api/tasks", taskRoutes);
};

export default initRoute;