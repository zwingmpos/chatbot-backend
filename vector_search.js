const express = require("express");
const multer = require("multer");
const pdfParse = require("pdf-parse");
const OpenAI = require("openai");
const cors = require("cors");
const fs = require("fs");
require("dotenv").config();

const app = express();
const port = 5000;
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

app.use(cors());
app.use(express.json());

let faqs = [];

// Load existing FAQs from file
if (fs.existsSync("./faqs.json")) {
  const data = fs.readFileSync("./faqs.json");
  try {
    faqs = JSON.parse(data).faqs || [];
  } catch {
    faqs = [];
  }
}

// Function to get embeddings from Hugging Face API
async function getEmbedding(text) {
  try {
    const response = await fetch("https://api-inference.huggingface.co/models/sentence-transformers/all-MiniLM-L6-v2", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${process.env.HUGGINGFACE_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        inputs: [text], // Pass text as an array (IMPORTANT FIX)
      })
    });

    const data = await response.json();

    console.log("Hugging Face API Response:", data);

    if (response.ok) {
      return data?.[0]?.embedding || [];
    } else {
      console.error("Hugging Face API Error:", data);
      return [];
    }
  } catch (error) {
    console.error("❌ Error fetching embeddings:", error);
    return [];
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

// Upload PDF and extract FAQs
const upload = multer();
app.post("/upload-pdf", upload.single("file"), async (req, res) => {
  try {
    const dataBuffer = req.file.buffer;
    const pdfData = await pdfParse(dataBuffer);
    const pdfText = pdfData.text;

    const newFAQs = await extractFAQs(pdfText);

    for (let faq of newFAQs) {
      const embedding = await getEmbedding(`${faq.question} ${faq.answer}`);
      faq.embedding = embedding;
      if (!embedding.length) {
        console.warn(`⚠️ Empty embedding for FAQ: ${faq.question}`);
      }
    }

    faqs = [...faqs, ...newFAQs];
    fs.writeFileSync("./faqs.json", JSON.stringify({ faqs }, null, 2));

    res.json({ status: 200, message: "FAQs extracted successfully!", data: faqs });
  } catch (error) {
    res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
  }
});

// Find best FAQ match using Vector Search
app.post("/chat", async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.status(400).json({ status: 400, message: "Query is required", data: null });

    const queryEmbedding = await getEmbedding(query);

    let bestMatch = null;
    let highestScore = -1;

    for (let faq of faqs) {
      const dotProduct = faq.embedding.reduce((sum, val, i) => sum + val * queryEmbedding[i], 0);
      const magnitudeA = Math.sqrt(faq.embedding.reduce((sum, val) => sum + val ** 2, 0));
      const magnitudeB = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val ** 2, 0));
      const similarity = dotProduct / (magnitudeA * magnitudeB);

      if (similarity > highestScore) {
        highestScore = similarity;
        bestMatch = faq;
      }
    }

    const relatedFAQs = faqs
      .filter((faq) => faq.question !== (bestMatch ? bestMatch.question : ""))
      .sort(() => 0.5 - Math.random())
      .slice(0, 3)
      .map((faq) => faq.question);

    if (!bestMatch || highestScore < 0.7) {
      return res.json({
        status: 200,
        message: "No relevant FAQ found!",
        data: { response: "Shall I connect you to an Admin?", related_questions: relatedFAQs },
      });
    }

    res.json({
      status: 200,
      message: "Success",
      data: { response: `${bestMatch.answer}`, related_questions: relatedFAQs },
    });
  } catch (error) {
    res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
  }
});

app.listen(port, () => {
  console.log(`🚀 Server running on http://localhost:${port}`);
});
