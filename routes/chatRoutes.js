const express = require("express");
const chatController = require("../controllers/chatController");
const multer = require("multer");

const router = express.Router();
const upload = multer();

router.post("/send-message", upload.single("file"), chatController.sendMessage);
router.get("/last-message",chatController.getLastMessageByRoomId);
router.get("/fetch-messages",chatController.fetchMessagesByRoomId);
router.post("/get-room",chatController.createRooms);

module.exports = router;
