const mongoose = require("mongoose");

const messageSchema = new mongoose.Schema({
  roomId: String,
  sender: String,
  content: String, // Text or file path
  type: String, // "text", "image", or "pdf"
  timestamp: { type: Date, default: Date.now },
});

module.exports = mongoose.model("Message", messageSchema);
