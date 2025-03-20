const pdfParse = require("pdf-parse");
const OpenAI = require("openai");
const FAQ = require("../models/Faqs");

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// Extract FAQs using OpenAI
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
    return [];
  }
}

// **Handle multiple PDFs and store unique FAQs**
exports.uploadPDFs = async (req, res) => {
  try {
    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ status: 400, message: "No files uploaded" });
    }

    let allNewFAQs = [];

    // Loop through each uploaded PDF file
    for (const file of req.files) {
      const dataBuffer = file.buffer;
      const pdfData = await pdfParse(dataBuffer);
      const pdfText = pdfData.text;

      const extractedFAQs = await extractFAQs(pdfText);
      allNewFAQs.push(...extractedFAQs);
    }

    // Fetch existing FAQs from DB
    const existingFAQs = await FAQ.find({}, { question: 1 });

    // Convert existing questions into a Set for faster lookup
    const existingQuestions = new Set(existingFAQs.map(faq => faq.question.toLowerCase()));

    // Filter out duplicate FAQs
    const uniqueFAQs = allNewFAQs.filter(faq => !existingQuestions.has(faq.question.toLowerCase()));

    if (uniqueFAQs.length > 0) {
      await FAQ.insertMany(uniqueFAQs);
    }

    res.json({
      status: 200,
      message: uniqueFAQs.length > 0 ? "New FAQs added successfully!" : "No new FAQs added (all were duplicates).",
      data: uniqueFAQs
    });

  } catch (error) {
    res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
  }
};

// Chat API to get the best matching FAQ
exports.chatWithAI = async (req, res) => {
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
};
