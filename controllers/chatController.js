const Room = require("../models/Room");
const Message = require("../models/Message");
const multer = require("multer");

// File Upload Setup
const upload = multer({ dest: "uploads/" });

// Get or Create Room
exports.createRooms =  async (req, res) => {
    try {
      const { user1, user2 } = req.body;
      if (!user1 || !user2) {
        return res.status(400).json({ status: 400, message: "User IDs are required" });
      }
  
      // Fetch users from the database using userId
      const userOne = await User.findOne({ userId: user1 });
      const userTwo = await User.findOne({ userId: user2 });
  
      if (!userOne || !userTwo) {
        return res.status(404).json({ status: 404, message: "One or both users not found" });
      }
  
      // Check if a room already exists
      let room = await Room.findOne({
        "users.userId": { $all: [user1, user2] }
      });
  
      if (!room) {
        // Create new room with userId and MongoDB _id
        room = new Room({
          users: [
            { userId: userOne.userId, autoId: userOne._id },
            { userId: userTwo.userId, autoId: userTwo._id }
          ]
        });
  
        await room.save();
      }
  
      res.json({ status: 200, message: "Room retrieved successfully!", data: room });
  
    } catch (error) {
      res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
    }
  };

// Send Message (with File Upload Support)
exports.sendMessage = async (req, res) => {
    try {
      const { roomId, sender, content, type } = req.body;
      const file = req.file;
  
      // Validate sender is in the room
      const room = await Room.findById(roomId);
      if (!room || !room.users.includes(sender)) {
        return res.status(403).json({ status: 403, message: "Sender is not part of this room" });
      }
  
      let messageContent = content;
      if (file) {
        messageContent = `/uploads/${file.filename}`;
      }
  
      const newMessage = new Message({ roomId, sender, content: messageContent, type });
      await newMessage.save();
  
      io.to(roomId).emit("newMessage", newMessage);
      res.json({ status: 200, message: "Message sent successfully!", data: newMessage });
    } catch (error) {
      res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
    }
  };


// Fetch Messages of a Room
exports.fetchMessagesByRoomId = async (req, res) => {
    try {
      const { roomId } = req.params;
      const messages = await Message.find({ roomId }).sort({ timestamp: 1 });
  
      res.json({ status: 200, message: "Messages fetched successfully!", data: messages });
    } catch (error) {
      res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
    }
  };

  // Fetch Last Message of a Room
exports.getLastMessageByRoomId = async (req, res) => {
    try {
      const { roomId } = req.params;
      const lastMessage = await Message.findOne({ roomId }).sort({ timestamp: -1 });
  
      res.json({ status: 200, message: "Last message fetched successfully!", data: lastMessage });
    } catch (error) {
      res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
    }
  };
