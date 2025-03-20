const mongoose = require("mongoose");

const userSchema = new mongoose.Schema({
  fullname: String,
  username: String,
  userId: { type: Number, unique: true },
  number: { type: String, unique: true },
  role: String,
});

module.exports = mongoose.model("User", userSchema);
