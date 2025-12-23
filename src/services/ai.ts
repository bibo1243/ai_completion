
import { GoogleGenerativeAI } from "@google/generative-ai";

const DEFAULT_API_KEY = "AIzaSyBbGFzQkwhEmNQduYxaZnnxxHR-DlQjj98";

// Helper to get settings from storage
const getAISettings = () => {
    return {
        provider: localStorage.getItem('ai_provider') || 'gemini',
        googleKey: localStorage.getItem('google_ai_key') || DEFAULT_API_KEY,
        openaiKey: localStorage.getItem('openai_api_key') || '',
        baseUrl: localStorage.getItem('ai_base_url') || 'https://api.openai.com/v1',
        modelName: localStorage.getItem('ai_model') || 'gpt-3.5-turbo'
    };
};

export interface AIResponse {
  newTitle: string;
  newContent: string;
  summary: string;
}

export interface AIExpertAnalysis {
  strengths: string;
  blindSpots: string;
  collaboration: string;
  nextSteps: string;
}

const getGenAIModel = () => {
    const { googleKey } = getAISettings();
    if (!googleKey) {
        throw new Error("Google API Key is missing. Please set it in Settings.");
    }
    const genAI = new GoogleGenerativeAI(googleKey);
    return genAI;
};

const executeGeminiRequest = async (prompt: string): Promise<any> => {
    const genAI = getGenAIModel();
    const modelsToTry = [
        "gemini-2.0-flash-001",
        "gemini-2.0-flash-lite-preview-02-05", 
        "gemini-flash-latest", 
        "gemini-pro-latest"
    ];
    
    let lastError;
    
    for (const modelName of modelsToTry) {
        try {
            console.log(`Attempting to use AI model: ${modelName}`);
            const model = genAI.getGenerativeModel({ 
                model: modelName,
                generationConfig: {
                    temperature: 0.7,
                    topK: 40,
                    topP: 0.95,
                    maxOutputTokens: 2048,
                }
            });

            const result = await model.generateContent(prompt);
            const response = await result.response;
            const text = response.text();
            
            console.log("AI Raw Response:", text); // Debug log

            // Clean up markdown code blocks if present
            const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
            return JSON.parse(cleanText);
        } catch (err: any) {
            console.warn(`Model ${modelName} failed:`, err.message);
            lastError = err;
            continue;
        }
    }
    throw lastError;
};

const executeOpenAIRequest = async (prompt: string): Promise<any> => {
    const { openaiKey, baseUrl, modelName } = getAISettings();
    
    if (!openaiKey) {
        throw new Error("API Key is missing. Please set it in Settings.");
    }

    // Ensure baseUrl doesn't end with slash if we append /chat/completions, 
    // BUT usually users provide the base URL like https://api.deepseek.com
    // The standard endpoint is /chat/completions
    let url = baseUrl.trim();
    if (url.endsWith('/')) url = url.slice(0, -1);
    if (!url.endsWith('/v1')) {
         // Some providers might need /v1, some might not. 
         // Best practice: User provides full base URL including /v1 if needed, 
         // OR we try to be smart. 
         // Let's assume user provides "https://api.deepseek.com" -> we append "/chat/completions"
         // If user provides "https://api.deepseek.com/v1" -> we append "/chat/completions"
         // Actually, most SDKs take "baseURL" as "https://api.example.com/v1".
    }
    
    // Construct the endpoint
    const endpoint = `${url}/chat/completions`;

    console.log(`Using OpenAI-compatible provider: ${url}, model: ${modelName}`);

    try {
        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiKey}`
            },
            body: JSON.stringify({
                model: modelName,
                messages: [
                    { role: "system", content: "You are a helpful assistant. Output valid JSON only." },
                    { role: "user", content: prompt }
                ],
                temperature: 0.7,
                // stream: false // default
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
        }

        const data = await response.json();
        const text = data.choices[0]?.message?.content || "";
        
        console.log("AI Raw Response:", text);

        const cleanText = text.replace(/```json/g, '').replace(/```/g, '').trim();
        return JSON.parse(cleanText);

    } catch (error) {
        console.error("OpenAI Provider Error:", error);
        throw error;
    }
};

const executeAIRequest = async (prompt: string): Promise<any> => {
    const { provider } = getAISettings();
    if (provider === 'openai') {
        return await executeOpenAIRequest(prompt);
    }
    return await executeGeminiRequest(prompt);
};

export const polishContent = async (content: string, currentTitle: string): Promise<AIResponse> => {
  const prompt = `
    You are a professional editor with a gentle, helpful personality (similar to Things 3's design language). 
    Please review the following text (which is a journal entry or task description) and the current title.
    
    Current Title: "${currentTitle}"
    Content:
    "${content}"
    
    Tasks:
    1. Improve the title to be more concise and professional in Traditional Chinese (繁體中文).
    2. Improve the content for grammar, clarity, and tone in Traditional Chinese (繁體中文).
    3. Provide a brief, gentle summary of what you changed in Traditional Chinese (繁體中文). The summary should be one short sentence, like "已為您優化標題與內文語氣" or "已修正錯別字並潤飾語句".
    
    Output JSON format ONLY:
    {
      "newTitle": "Improved Title (Traditional Chinese)",
      "newContent": "Improved Content (Traditional Chinese)",
      "summary": "Gentle summary of changes (Traditional Chinese)"
    }
    
    If the content is HTML, preserve the HTML structure/tags in "newContent" but improve the text inside.
    If the content is plain text, keep it plain text.
    ENSURE ALL OUTPUT IS IN TRADITIONAL CHINESE (繁體中文).
  `;

  try {
    if (!content.trim()) throw new Error("Content is empty");
    return await executeAIRequest(prompt);
  } catch (error) {
    console.error("AI Service Error Details:", error);
    throw error;
  }
};

export const analyzeContentAsExpert = async (content: string, currentTitle: string): Promise<AIExpertAnalysis> => {
  const prompt = `
    Role: You are an experienced supervisor at a Children's Placement Agency in Taiwan (台灣兒家安置機構主管).
    Task: Analyze the following task/journal entry from a management perspective.
    
    Current Title: "${currentTitle}"
    Content:
    "${content}"
    
    Analysis Requirements:
    1. **Strengths (做得好的地方)**: Identify what is being done well in the content, praising the effort or strategy.
    2. **Potential Blind Spots (思考盲點)**: Point out potential risks, overlooked aspects, or problems with this way of thinking.
    3. **Cross-unit Collaboration (跨單合作)**: Suggest how to collaborate with other units/departments (e.g., social workers, psychologists, administration) to handle this better.
    4. **Next Steps (下一步行動)**: Provide concrete, actionable next steps.
    
    Output JSON format ONLY:
    {
      "strengths": "Analysis of strengths (Traditional Chinese)",
      "blindSpots": "Analysis of blind spots (Traditional Chinese)",
      "collaboration": "Suggestions for collaboration (Traditional Chinese)",
      "nextSteps": "Actionable next steps (Traditional Chinese)"
    }
    
    Tone: Professional, empathetic, constructive, and experienced. Use Traditional Chinese (繁體中文).
    Format: The output text should be formatted as clean paragraphs or bullet points within the JSON strings.
  `;

  try {
    if (!content.trim()) throw new Error("Content is empty");
    return await executeAIRequest(prompt);
  } catch (error) {
    console.error("AI Expert Analysis Error:", error);
    throw error;
  }
};
