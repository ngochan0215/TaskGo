import mongoose from "mongoose";

const serviceSchema = new mongoose.Schema(
    {
        category_name: {type: String, required: true, unique: true, trim: true},
        description: {type: String, required: true, trim: true},
    }
);



const Service = mongoose.models.Service || mongoose.model("Service", serviceSchema);
export default Service;