import mongoose from "mongoose";
import dotenv from "dotenv";
import Service from "./models/services.js";

dotenv.config();

const testInsert = async () => {
  try {
    await mongoose.connect(process.env.DB_URI);
    console.log("Connected to MongoDB");

    // Try inserting one test document
    const newService = await Service.create({
      category_name: "Gardening",
      description: "Professional garden maintenance and landscaping."
    });

    console.log("Inserted service:", newService);
  } catch (error) {
    console.error("Error inserting service:", error.message);
  } finally {
    // 3️⃣ Always close the connection after test
    await mongoose.disconnect();
    console.log("Disconnected from MongoDB");
  }
};

testInsert();