const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");
const mongoose = require("mongoose");
const http = require("http");
const { Server } = require("socket.io");
require("dotenv").config();

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});
const port = 5000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose
  .connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log("📡 MongoDB Connected"))
  .catch((err) => console.error("❌ MongoDB Connection Error:", err));

// User Schema
const userSchema = new mongoose.Schema({
  fullname: String,
  username: String,
  userId: { type: Number, unique: true },
  role: String,
});
const User = mongoose.model("User", userSchema);

// Room Schema
const roomSchema = new mongoose.Schema({
  users: [String], // Array of user IDs
});
const Room = mongoose.model("Room", roomSchema);

// Message Schema
const messageSchema = new mongoose.Schema({
  roomId: String,
  sender: String,
  content: String,
  type: String, // "text" or "image"
  timestamp: { type: Date, default: Date.now },
});
const Message = mongoose.model("Message", messageSchema);

// Create User
app.post("/create-user", async (req, res) => {
  try {
    const { fullname, username, role } = req.body;
    if (!fullname || !username || !role) return res.status(400).json({ status: 400, message: "All fields are required" });

    const lastUser = await User.findOne().sort({ userId: -1 });
    const userId = lastUser ? lastUser.userId + 1 : 1;

    const newUser = new User({ fullname, username, userId, role });
    await newUser.save();
    res.json({ status: 200, message: "User created successfully!", data: newUser });
  } catch (error) {
    res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
  }
});

// Fetch Users
app.get("/fetch-users", async (req, res) => {
  try {
    const users = await User.find();
    res.json({ status: 200, message: "Users fetched successfully!", data: users });
  } catch (error) {
    res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
  }
});

// Get or Create Room
app.post("/get-room", async (req, res) => {
  try {
    const { user1, user2 } = req.body;
    if (!user1 || !user2) return res.status(400).json({ status: 400, message: "User IDs are required" });

    let room = await Room.findOne({ users: { $all: [user1, user2] } });
    if (!room) {
      room = new Room({ users: [user1, user2] });
      await room.save();
    }
    res.json({ status: 200, message: "Room retrieved successfully!", data: room });
  } catch (error) {
    res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
  }
});

// Send Message
app.post("/send-message", async (req, res) => {
  try {
    const { roomId, sender, content, type } = req.body;
    if (!roomId || !sender || !content || !type) return res.status(400).json({ status: 400, message: "Invalid input" });

    const newMessage = new Message({ roomId, sender, content, type });
    await newMessage.save();

    io.to(roomId).emit("newMessage", newMessage);
    res.json({ status: 200, message: "Message sent successfully!", data: newMessage });
  } catch (error) {
    res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
  }
});

// Fetch Messages for a Room
app.get("/fetch-messages/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    const messages = await Message.find({ roomId }).sort({ timestamp: 1 });
    res.json({ status: 200, message: "Messages fetched successfully!", data: messages });
  } catch (error) {
    res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
  }
});

// Get Last Message for a Room
app.get("/last-message/:roomId", async (req, res) => {
  try {
    const { roomId } = req.params;
    const lastMessage = await Message.findOne({ roomId }).sort({ timestamp: -1 });
    res.json({ status: 200, message: "Last message fetched successfully!", data: lastMessage });
  } catch (error) {
    res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
  }
});

// WebSocket Connection
io.on("connection", (socket) => {
  console.log("⚡ New client connected");

  socket.on("joinRoom", (roomId) => {
    socket.join(roomId);
    console.log(`User joined room ${roomId}`);
  });

  socket.on("disconnect", () => {
    console.log("❌ Client disconnected");
  });
});

server.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});

