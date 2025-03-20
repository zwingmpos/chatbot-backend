const mongoose = require("mongoose");

// FAQ Schema
const faqSchema = new mongoose.Schema({
    question: String,
    answer: String,
  });

  module.exports =  mongoose.model("FAQ", faqSchema);