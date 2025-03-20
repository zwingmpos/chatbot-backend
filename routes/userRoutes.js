const express = require("express");
const userController = require("../controllers/userController");

const router = express.Router();

router.post("/login", userController.login);
router.get("/fetch-users", userController.getUsers );
router.post("/create",userController.createUser);

module.exports = router;
