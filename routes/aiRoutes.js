const express = require("express");
const multer = require("multer");
const aiController = require("../controllers/aiController");

const router = express.Router();
const upload = multer(); // File upload middleware

router.post("/upload-pdfs", upload.array("files"), aiController.uploadPDFs);
router.post("/chat", aiController.chatWithAI);

module.exports = router;
