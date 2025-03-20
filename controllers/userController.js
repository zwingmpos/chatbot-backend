const User = require("../models/User");

// Create User 
exports.createUser = async (req, res) => {
  try {
    const { fullname, username, number, role } = req.body;
    if (!fullname || !username || !number || !role) {
      return res.status(400).json({ status: 400, message: "All fields are required" });
    }

    const existingUser = await User.findOne({ number });
    if (existingUser) {
      return res.status(409).json({ status: 409, message: "Number already exists. Please login." });
    }

    const lastUser = await User.findOne().sort({ userId: -1 });
    const userId = lastUser ? lastUser.userId + 1 : 1;

    const newUser = new User({ fullname, username, number, userId, role });
    await newUser.save();

    res.json({ status: 200, message: "User created successfully!", data: newUser });
  } catch (error) {
    res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
  }
};

// Fetch Users
exports.getUsers = async (req, res) => {
    try {
      const users = await User.find();
      res.json({ status: 200, message: "Users fetched successfully!", data: users });
    } catch (error) {
      res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
    }
  };

// Login
exports.login = async (req, res) => {
  try {
    const { number } = req.body;
    if (!number) return res.status(400).json({ status: 400, message: "Number is required" });

    const user = await User.findOne({ number });
    if (!user) {
      return res.status(404).json({ status: 404, message: "User not found. Please signup." });
    }

    res.json({ status: 200, message: "Login successful", data: user });
  } catch (error) {
    res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
  }
};
