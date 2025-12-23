import { GoogleGenerativeAI } from "@google/generative-ai";

const API_KEY = "AIzaSyBbGFzQkwhEmNQduYxaZnnxxHR-DlQjj98";
const genAI = new GoogleGenerativeAI(API_KEY);

async function listModels() {
  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    console.log("Checking gemini-1.5-flash...");
    // Just try to generate something simple
    const result = await model.generateContent("Hello");
    console.log("Success! Response:", result.response.text());
  } catch (error) {
    console.error("Error with gemini-1.5-flash:", error.message);
  }

  try {
    console.log("Checking gemini-pro...");
    const model2 = genAI.getGenerativeModel({ model: "gemini-pro" });
    const result2 = await model2.generateContent("Hello");
    console.log("Success! Response:", result2.response.text());
  } catch (error) {
    console.error("Error with gemini-pro:", error.message);
  }
}

listModels();
