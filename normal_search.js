const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");
const mongoose = require("mongoose");
require("dotenv").config();

const app = express();
const port = 5000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY || "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"});

app.use(cors());
app.use(express.json());

// MongoDB connection
mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
}).then(() => console.log("📡 MongoDB Connected"))
  .catch(err => console.error("❌ MongoDB Connection Error:", err));

// FAQ Schema
const faqSchema = new mongoose.Schema({
  question: String,
  answer: String,
});

const FAQ = mongoose.model("FAQ", faqSchema);

// Load existing FAQs from file
if (fs.existsSync("./faqs.json")) {
  const data = fs.readFileSync("./faqs.json");
  try {
    faqs = JSON.parse(data).faqs || [];
  } catch {
    faqs = [];
  }
}

// Extract FAQs from text using OpenAI
async function extractFAQs(text) {
  const response = await openai.chat.completions.create({
    model: "gpt-4o-mini",
    messages: [
      {
        role: "user",
        content: `Extract FAQs from this text in strictly valid JSON format like this:
        [
          {
            "question": "What is Zwing?",
            "answer": "Zwing is an inventory management system."
          },
          {
            "question": "How to create advice in Zwing?",
            "answer": "Go to Inventory → Advice and click on + New Advice."
          }
        ]
        Now extract FAQs from this text:\n${text}`
      }
    ],
    max_tokens: 1000,
  });

  let content = response.choices[0].message.content;
  content = content.replace(/```json|```/g, "").trim();

  try {
    return JSON.parse(content);
  } catch (error) {
    console.error("❌ Invalid JSON from OpenAI:", error);
    fs.writeFileSync("./invalid_faqs.json", content);
    return [];
  }
}

// Upload PDF and extract FAQs
const upload = multer();
app.post("/upload-pdf", upload.single("file"), async (req, res) => {
  try {
    const dataBuffer = req.file.buffer;
    const pdfData = await pdfParse(dataBuffer);
    const pdfText = pdfData.text;

    const newFAQs = await extractFAQs(pdfText);

    await FAQ.insertMany(newFAQs);

    res.json({ status: 200, message: "FAQs extracted and stored in MongoDB successfully!", data: newFAQs });
  } catch (error) {
    res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
  }
});

// Chat API
app.post("/chat", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ status: 400, message: "Query is required", data: null });

    const faqs = await FAQ.find();

    const messages = [
      { role: "system", content: "You are a smart assistant who finds the most relevant answer from the given FAQs. If no match is found, respond with 'Shall I connect you to an Admin?'" },
      { role: "user", content: `Given the following FAQs: ${JSON.stringify(faqs)}\n\nFind the most relevant FAQ for this query: ${query}` },
    ];

    const response = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: messages,
      max_tokens: 500,
    });

    const answer = response.choices[0].message.content;

    const relatedFAQs = faqs
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map((faq) => faq.question);

    const isFallbackResponse = answer.includes("Shall I connect you to an Admin?");

    res.json({
      status: 200,
      message: isFallbackResponse ? "No relevant FAQ found!" : "Success",
      data: { response: answer, related_questions: relatedFAQs },
    });
  } catch (error) {
    res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
