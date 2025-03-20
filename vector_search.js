// const express = require("express");
// const multer = require("multer");
// const pdfParse = require("pdf-parse");
// const OpenAI = require("openai");
// const cors = require("cors");
// const fs = require("fs");
// require("dotenv").config();
// const app = express();
// const port = 5000;
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
// app.use(cors());
// app.use(express.json());

// let faqs = [];

// // Load existing FAQs from file
// if (fs.existsSync("./faqs.json")) {
//   const data = fs.readFileSync("./faqs.json");
//   try {
//     faqs = JSON.parse(data).faqs || [];
//   } catch {
//     faqs = [];
//   }
// }
// //ft:gpt-4o-mini:my-custom-model
// // Extract FAQs from text using fine-tuned OpenAI model
// async function extractFAQs(text) {
//   const response = await openai.chat.completions.create({
//     model: "ft:gpt-4o-mini:my-custom-model", // Fine-tuned model
//     messages: [
//       {
//         role: "user",
//         content: `Extract FAQs from this text in strictly valid JSON format like this:
//         [
//           {
//             "question": "What is Zwing?",
//             "answer": "Zwing is an inventory management system."
//           },
//           {
//             "question": "How to create advice in Zwing?",
//             "answer": "Go to Inventory → Advice and click on + New Advice."
//           }
//         ]
//         Now extract FAQs from this text:
// ${text}`
//       }
//     ],
//     max_tokens: 1000,
//   });
//   let content = response.choices[0].message.content;
//   // ✅ Remove backticks and handle JSON properly
//   content = content.replace(/```json|```/g, "").trim();
//   try {
//     return JSON.parse(content);
//   } catch (error) {
//     console.error("❌ Invalid JSON from OpenAI:", error);
//     fs.writeFileSync("./invalid_faqs.json", content); // Save invalid response for debugging
//     return [];
//   }
// }
// // Upload PDF and extract FAQs
// const upload = multer();
// app.post("/upload-pdf", upload.single("file"), async (req, res) => {
//   try {
//     const dataBuffer = req.file.buffer;
//     const pdfData = await pdfParse(dataBuffer);
//     const pdfText = pdfData.text;
//     const newFAQs = await extractFAQs(pdfText);
//     faqs = [...faqs, ...newFAQs];
//     fs.writeFileSync("./faqs.json", JSON.stringify({ faqs }, null, 2));
//     res.json({ status: 200, message: "FAQs extracted successfully!", data: faqs });
//   } catch (error) {
//     res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
//   }
// });
// //text-embedding-ada-002
// // Generate embeddings for a given text
// async function getEmbedding(text) {
//   const response = await openai.embeddings.create({
//     model: "gpt-4o-mini",
//     input: text
//   });
//   return response.data[0].embedding;
// }
// // Store embeddings for FAQs
// async function generateFAQEmbeddings() {
//   for (let faq of faqs) {
//     if (!faq.embedding) {
//       faq.embedding = await getEmbedding(`${faq.question} ${faq.answer}`);
//     }
//   }
//   fs.writeFileSync("./faqs.json", JSON.stringify({ faqs }, null, 2));
// }
// // Generate embeddings for the first time
// generateFAQEmbeddings();
// // Find best FAQ match using embeddings
// app.post("/chat", async (req, res) => {
//   try {
//     const { query } = req.body;
//     if (!query) return res.status(400).json({ status: 400, message: "Query is required", data: null });
//     const queryEmbedding = await getEmbedding(query);
//     let bestMatch = null;
//     let highestScore = -1;
//     for (let faq of faqs) {
//       const dotProduct = faq.embedding.reduce((sum, val, i) => sum + val * queryEmbedding[i], 0);
//       const magnitudeA = Math.sqrt(faq.embedding.reduce((sum, val) => sum + val ** 2, 0));
//       const magnitudeB = Math.sqrt(queryEmbedding.reduce((sum, val) => sum + val ** 2, 0));
//       const similarity = dotProduct / (magnitudeA * magnitudeB);
//       if (similarity > highestScore) {
//         highestScore = similarity;
//         bestMatch = faq;
//       }
//     }
//     const relatedFAQs = faqs
//       .filter((faq) => faq.question !== (bestMatch ? bestMatch.question : ""))
//       .sort(() => 0.5 - Math.random())
//       .slice(0, 3)
//       .map((faq) => faq.question);
//     if (!bestMatch) {
//       return res.json({
//         status: 200,
//         message: "No relevant FAQ found!",
//         data: { response: "Shall I connect you to an Admin?", related_questions: relatedFAQs },
//       });
//     }
//     res.json({
//       status: 200,
//       message: "Success",
//       data: { response: `${bestMatch.answer}`, related_questions: relatedFAQs },
//     });
//   } catch (error) {
//     res.status(500).json({ status: 500, message: "Internal Server Error", data: error.message });
//   }
// });
// app.listen(port, () => {
//   console.log(`🚀 Server running on http://localhost:${port}`);
// });