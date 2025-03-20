const express = require("express");
const OpenAI = require("openai");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const fs = require("fs");
const FAQ = require("../models/Faqs"); // Import FAQ Model
require("dotenv").config();

const router = express.Router();
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Load existing FAQs from file (if needed)
let faqs = [];
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
          { "question": "What is Zwing?", "answer": "Zwing is an inventory management system." },
          { "question": "How to create advice in Zwing?", "answer": "Go to Inventory → Advice and click on + New Advice." }
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

// File Upload Setup
const upload = multer();

// Upload PDF and extract FAQs (Append instead of Overwrite)
router.post("/upload-pdf", upload.single("file"), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ status: 400, message: "No file uploaded" });

    const dataBuffer = req.file.buffer;
    const pdfData = await pdfParse(dataBuffer);
    const pdfText = pdfData.text;

    const newFAQs = await extractFAQs(pdfText);

    // Retrieve existing questions from the database
    const existingFAQs = await FAQ.find({}, { question: 1 });

    // Convert existing FAQs into a Set for faster lookup
    const existingQuestions = new Set(existingFAQs.map(faq => faq.question.toLowerCase()));

    // Filter out duplicates before inserting new FAQs
    const uniqueFAQs = newFAQs.filter(faq => !existingQuestions.has(faq.question.toLowerCase()));

    if (uniqueFAQs.length > 0) {
      await FAQ.insertMany(uniqueFAQs);
    }

    res.json({
      status: 200,
      message: uniqueFAQs.length > 0 ? "FAQs extracted and stored successfully!" : "No new FAQs were added (duplicates found).",
      data: uniqueFAQs
    });
  } catch (error) {
    res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
  }
});


// AI Chat API
router.post("/chat", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ status: 400, message: "Query is required", data: null });

    const faqs = await FAQ.find();

    const messages = [
      { role: "system", content: "You are a smart assistant who finds the most relevant answer from the given FAQs. If no match is found, respond with 'Shall I connect you to an Admin?'" },
      { role: "user", content: `Find the most relevant FAQ from this list:\n${JSON.stringify(faqs.map(f => f.answer))}\nQuery: ${query}` },
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

module.exports = router;

