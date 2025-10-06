import mongoose from "mongoose";
import dotenv from "dotenv"

dotenv.config();
console.log("🔍 DB_URI:", process.env.DB_URI);

const connectDB = async () => {
    try {
        const mongoURI = process.env.DB_URI;
        if (!mongoURI) {
            throw new Error("Lỗi kết nối: biến môi trường DB_URI không được tìm thấy");
        }

        await mongoose.connect(mongoURI, {
            useNewUrlParser: true,
            useUnifiedTopology: true,
        });

        console.log("Kết nối MongoDB thành công");
    } catch (error) {
        console.error("Lỗi kết nối MongoDB:", error.message);
        process.exit(1);
    }
};

export default connectDB;
