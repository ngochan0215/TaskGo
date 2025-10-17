// import mongoose from "mongoose";
// import Service from "./models/service.js";
// import Task from "./models/task.js";
// import dotenv from "dotenv";
// import mongoose from "mongoose";

// dotenv.config();
// await mongoose.connect(process.env.DB_URI);

// // Insert sample services
// const services = await Service.insertMany([
//     {
//     category_name: "House Cleaning",
//     description: "Professional cleaning services for houses, apartments, and offices.",
//     },
//     {
//     category_name: "Plumbing",
//     description: "Fixing leaks, installing faucets, and other plumbing works.",
//     },
//     {
//     category_name: "Electrical",
//     description: "Installation and maintenance of electrical systems.",
//     },
//     {
//     category_name: "Gardening",
//     description: "Lawn mowing, trimming, and garden maintenance.",
//     },
//     {
//     category_name: "Pet Care",
//     description: "Pet sitting, walking, and grooming services.",
//     },
// ]);

// console.log("Services inserted successfully!");

// // Insert sample tasks (each belongs to one service)
// const tasks = [
//     // House Cleaning
//     {
//     service_id: services[0]._id,
//     task_name: "Basic Home Cleaning",
//     description: "Vacuuming, mopping, dusting, and kitchen cleaning.",
//     pricing: { unit: "hour", amount: 15 },
//     },
//     {
//     service_id: services[0]._id,
//     task_name: "Deep Cleaning",
//     description: "Detailed cleaning including appliances, windows, and bathroom scrubbing.",
//     pricing: { unit: "job", amount: 100 },
//     },
//     // Plumbing
//     {
//     service_id: services[1]._id,
//     task_name: "Fix Leaky Faucet",
//     description: "Repair or replace leaking kitchen/bathroom faucets.",
//     pricing: { unit: "job", amount: 50 },
//     },
//     {
//     service_id: services[1]._id,
//     task_name: "Unclog Drain",
//     description: "Remove blockages from sink or bathroom drains.",
//     pricing: { unit: "job", amount: 40 },
//     },
//     // Electrical
//     {
//     service_id: services[2]._id,
//     task_name: "Install Ceiling Fan",
//     description: "Mount and connect ceiling fan with proper wiring.",
//     pricing: { unit: "job", amount: 60 },
//     },
//     {
//     service_id: services[2]._id,
//     task_name: "Light Fixture Replacement",
//     description: "Replace or repair light fixtures and bulbs.",
//     pricing: { unit: "job", amount: 30 },
//     },
//     // Gardening
//     {
//     service_id: services[3]._id,
//     task_name: "Lawn Mowing",
//     description: "Trim and maintain grass for small or large yards.",
//     pricing: { unit: "hour", amount: 25 },
//     },
//     {
//     service_id: services[3]._id,
//     task_name: "Tree Trimming",
//     description: "Prune trees and remove dead branches.",
//     pricing: { unit: "job", amount: 120 },
//     },
//     // Pet Care
//     {
//     service_id: services[4]._id,
//     task_name: "Dog Walking",
//     description: "Daily walking and outdoor exercise for your dog.",
//     pricing: { unit: "hour", amount: 20 },
//     },
//     {
//     service_id: services[4]._id,
//     task_name: "Pet Grooming",
//     description: "Bathing, nail trimming, and brushing for pets.",
//     pricing: { unit: "job", amount: 45 },
//     },
// ];

// await Task.insertMany(tasks);
// console.log("✅ Tasks inserted");

// console.log("Data inserted successfully!");
// await mongoose.disconnect();
