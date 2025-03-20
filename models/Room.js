const mongoose = require("mongoose");

const roomSchema = new mongoose.Schema({
    users: [{ userId: Number, autoId: mongoose.Schema.Types.ObjectId }],
  });

module.exports = mongoose.model("Room", roomSchema);

