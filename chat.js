// const express = require("express");
// const multer = require("multer");
// const pdfParse = require("pdf-parse");
// const OpenAI = require("openai");
// const cors = require("cors");
// const fs = require("fs");
// const mongoose = require("mongoose");
// const http = require("http");
// const { Server } = require("socket.io");
// require("dotenv").config();

// const app = express();
// const server = http.createServer(app);
// const io = new Server(server, {
//   cors: { origin: "*" },
// });
// const port = 5000;
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// app.use(cors());
// app.use(express.json());

// // Ensure uploads directory exists
// const uploadDir = "uploads/";
// if (!fs.existsSync(uploadDir)) {
//   fs.mkdirSync(uploadDir, { recursive: true });
// }

// // File Upload Setup
// const storage = multer.diskStorage({
//   destination: function (req, file, cb) {
//     cb(null, uploadDir);
//   },
//   filename: function (req, file, cb) {
//     cb(null, Date.now() + "-" + file.originalname);
//   },
// });
// const upload = multer({ storage: storage });

// // MongoDB connection
// mongoose
//   .connect(process.env.MONGO_URI, {
//     useNewUrlParser: true,
//     useUnifiedTopology: true,
//   })
//   .then(() => console.log("📡 MongoDB Connected"))
//   .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// // User Schema
// const userSchema = new mongoose.Schema({
//   fullname: String,
//   username: String,
//   number:String,
//   userId: { type: Number, unique: true },
//   role: String,
// });
// const User = mongoose.model("User", userSchema);

// // Room Schema
// const roomSchema = new mongoose.Schema({
//   users: [{ userId: Number, autoId: mongoose.Schema.Types.ObjectId }],
// });
// const Room = mongoose.model("Room", roomSchema);

// // Message Schema
// const messageSchema = new mongoose.Schema({
//   roomId: String,
//   sender: String,
//   content: String, // Text or file path
//   type: String, // "text", "image", or "pdf"
//   timestamp: { type: Date, default: Date.now },
// });
// const Message = mongoose.model("Message", messageSchema);

// // Create User with Unique Number Validation
// app.post("/create-user", async (req, res) => {
//   try {
//     const { fullname, username, number, role } = req.body;
//     if (!fullname || !username || !number || !role) {
//       return res.status(400).json({ status: 400, message: "All fields are required" });
//     }

//     // Check if the number already exists
//     const existingUser = await User.findOne({ number });
//     if (existingUser) {
//       return res.status(409).json({ status: 409, message: "Number already exists. Please log in." });
//     }

//     // Generate a unique userId
//     const lastUser = await User.findOne().sort({ userId: -1 });
//     const userId = lastUser ? lastUser.userId + 1 : 1;

//     const newUser = new User({ fullname, username, userId, number, role });
//     await newUser.save();

//     res.json({ status: 200, message: "User created successfully!", data: newUser });
//   } catch (error) {
//     res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
//   }
// });


// // Fetch Users
// app.get("/fetch-users", async (req, res) => {
//   try {
//     const users = await User.find();
//     res.json({ status: 200, message: "Users fetched successfully!", data: users });
//   } catch (error) {
//     res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
//   }
// });


// // Get or Create Room
// app.post("/get-room", async (req, res) => {
//   try {
//     const { user1, user2 } = req.body;
//     if (!user1 || !user2) {
//       return res.status(400).json({ status: 400, message: "User IDs are required" });
//     }

//     // Fetch users from the database using userId
//     const userOne = await User.findOne({ userId: user1 });
//     const userTwo = await User.findOne({ userId: user2 });

//     if (!userOne || !userTwo) {
//       return res.status(404).json({ status: 404, message: "One or both users not found" });
//     }

//     // Check if a room already exists
//     let room = await Room.findOne({
//       "users.userId": { $all: [user1, user2] }
//     });

//     if (!room) {
//       // Create new room with userId and MongoDB _id
//       room = new Room({
//         users: [
//           { userId: userOne.userId, autoId: userOne._id },
//           { userId: userTwo.userId, autoId: userTwo._id }
//         ]
//       });

//       await room.save();
//     }

//     res.json({ status: 200, message: "Room retrieved successfully!", data: room });

//   } catch (error) {
//     res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
//   }
// });


// // Send Message (with File Upload Support)
// app.post("/send-message", upload.single("file"), async (req, res) => {
//   try {
//     const { roomId, sender, content, type } = req.body;
//     const file = req.file;

//     // Validate sender is in the room
//     const room = await Room.findById(roomId);
//     if (!room || !room.users.includes(sender)) {
//       return res.status(403).json({ status: 403, message: "Sender is not part of this room" });
//     }

//     let messageContent = content;
//     if (file) {
//       messageContent = `/uploads/${file.filename}`;
//     }

//     const newMessage = new Message({ roomId, sender, content: messageContent, type });
//     await newMessage.save();

//     io.to(roomId).emit("newMessage", newMessage);
//     res.json({ status: 200, message: "Message sent successfully!", data: newMessage });
//   } catch (error) {
//     res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
//   }
// });

// // Fetch Messages of a Room
// app.get("/fetch-messages/:roomId", async (req, res) => {
//   try {
//     const { roomId } = req.params;
//     const messages = await Message.find({ roomId }).sort({ timestamp: 1 });

//     res.json({ status: 200, message: "Messages fetched successfully!", data: messages });
//   } catch (error) {
//     res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
//   }
// });

// // Login API - Check if user exists by phone number
// app.post("/login", async (req, res) => {
//   try {
//     const { number } = req.body;
//     if (!number) return res.status(400).json({ status: 400, message: "Phone number is required" });

//     // Check if user exists
//     const user = await User.findOne({ number });
//     if (!user) {
//       return res.status(404).json({ status: 404, message: "User not found. Please sign up first." });
//     }

//     res.json({ status: 200, message: "Login successful!", data: user });
//   } catch (error) {
//     res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
//   }
// });



// // Fetch Last Message of a Room
// app.get("/last-message/:roomId", async (req, res) => {
//   try {
//     const { roomId } = req.params;
//     const lastMessage = await Message.findOne({ roomId }).sort({ timestamp: -1 });

//     res.json({ status: 200, message: "Last message fetched successfully!", data: lastMessage });
//   } catch (error) {
//     res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
//   }
// });

// // WebSocket Connection
// io.on("connection", (socket) => {
//   console.log("⚡ New client connected");

//   socket.on("joinRoom", (roomId) => {
//     socket.join(roomId);
//     console.log(`User joined room ${roomId}`);
//   });

//   socket.on("disconnect", () => {
//     console.log("❌ Client disconnected");
//   });
// });

// server.listen(port, () => {
//   console.log(`🚀 Server running on http://localhost:${port}`);
// });
