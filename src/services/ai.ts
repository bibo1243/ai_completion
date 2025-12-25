
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
  strengths?: string;
  blindSpots?: string;
  collaboration?: string;
  nextSteps?: string;
  fullResponse?: string;
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
    "gemini-1.5-flash",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash-lite-preview-02-05",
    "gemini-1.5-pro",
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

      console.log("AI Raw Response:", text);

      try {
        // Find JSON block or extract from text
        let jsonStr = text;
        const jsonMatch = text.match(/\{[\s\S]*\}/);
        if (jsonMatch) {
          jsonStr = jsonMatch[0];
        }
        const cleanText = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
        try {
          return JSON.parse(cleanText);
        } catch (e) {
          // Fallback: if there are literal newlines in the string values, 
          // attempt to escape them and try again.
          // A better approach for this specific AI-generated "one-field" JSON:
          if (cleanText.includes('"fullResponse": "')) {
            const startTag = '"fullResponse": "';
            const startIdx = cleanText.indexOf(startTag) + startTag.length;
            const endIdx = cleanText.lastIndexOf('"');
            if (startIdx > startTag.length - 1 && endIdx > startIdx) {
              const content = cleanText.substring(startIdx, endIdx);
              const escapedContent = content.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
              return { fullResponse: escapedContent };
            }
          }
          throw e;
        }
      } catch (parseErr) {
        console.warn("JSON Parse failed, returning raw text in fallback structure");
        if (prompt.includes("strengths")) {
          return {
            strengths: text.slice(0, 500),
            blindSpots: "無法解析 AI 回傳格式",
            collaboration: "請檢查內容或指令是否過於簡短",
            nextSteps: "建議手動嘗試優化指令"
          };
        }
        throw parseErr;
      }
    } catch (err: any) {
      console.warn(`Model ${modelName} failed:`, err.message);
      lastError = err;
      continue;
    }
  }
  throw lastError;
};

const executeOpenAIRequest = async (prompt: string, expectJson: boolean = true): Promise<any> => {
  const { openaiKey, baseUrl, modelName } = getAISettings();

  if (!openaiKey) {
    throw new Error("API Key is missing. Please set it in Settings.");
  }

  let url = baseUrl.trim();
  if (url.endsWith('/')) url = url.slice(0, -1);

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
          { role: "system", content: expectJson ? "You are a helpful assistant. Output valid JSON only." : "You are a helpful assistant." },
          { role: "user", content: prompt }
        ],
        temperature: 0.7,
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API Error: ${response.status} ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const text = data.choices[0]?.message?.content || "";

    console.log("AI Raw Response:", text);

    if (!expectJson) return text;

    try {
      let jsonStr = text;
      const jsonMatch = text.match(/\{[\s\S]*\}/);
      if (jsonMatch) jsonStr = jsonMatch[0];
      const cleanText = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();
      try {
        return JSON.parse(cleanText);
      } catch (err) {
        // Fallback for OpenAI as well
        if (cleanText.includes('"fullResponse": "')) {
          const startTag = '"fullResponse": "';
          const startIdx = cleanText.indexOf(startTag) + startTag.length;
          const endIdx = cleanText.lastIndexOf('"');
          if (startIdx > startTag.length - 1 && endIdx > startIdx) {
            const content = cleanText.substring(startIdx, endIdx);
            const escapedContent = content.replace(/\n/g, '\\n').replace(/\r/g, '\\r').replace(/\t/g, '\\t');
            return { fullResponse: escapedContent };
          }
        }
        throw err;
      }
    } catch (err) {
      console.warn("OpenAI JSON Parse failed");
      throw err;
    }

  } catch (error) {
    console.error("OpenAI Provider Error:", error);
    throw error;
  }
};

const executeGeminiSimpleRequest = async (prompt: string): Promise<string> => {
  const genAI = getGenAIModel();
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
  const result = await model.generateContent(prompt);
  const response = await result.response;
  return response.text().trim();
};

const executeSimpleAIRequest = async (prompt: string): Promise<string> => {
  const { provider } = getAISettings();
  if (provider === 'openai') {
    const result = await executeOpenAIRequest(prompt, false);
    return typeof result === 'string' ? result : JSON.stringify(result);
  }
  return await executeGeminiSimpleRequest(prompt);
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

export interface AIAssistantResponse {
  fullResponse: string;
}

export const askAIAssistant = async (content: string, currentTitle: string, customPrompt?: string): Promise<AIAssistantResponse> => {
  const defaultBasePrompt = `你是一位全能且智慧的 AI 助手。請根據以下內容提供深度且有見地的分析與擬議建議。
  
  【標題】：${currentTitle}
  【詳細內容】：${content}
  
  請提供一個結構清晰、文字優美且具有洞察力的回覆。`;

  const finalInstruction = (customPrompt && customPrompt.trim()) ? customPrompt : defaultBasePrompt;

  const finalPrompt = `【系統指令】：
${finalInstruction}

【目標內容標題】：
"${currentTitle}"

【目標內容備註】：
"${content}"

要求：
1. 請提供詳盡、完整且具備實質價值的回答。
2. 針對內容中的細節進行具體展開與深度分析。
3. 語氣專業、同理且具啟發性。
4. 使用繁體中文（Traditional Chinese）。
5. 回應必須封裝在 JSON 格式中：
{
  "fullResponse": "您的詳細回應內容（支援 Markdown 格式）"
}`;

  try {
    if (!content.trim()) throw new Error("內容為空，無法分析");
    return await executeAIRequest(finalPrompt);
  } catch (error) {
    console.error("AI Assistant Error:", error);
    throw error;
  }
};

export const generatePromptTitle = async (promptText: string): Promise<string> => {
  const prompt = `請為以下 AI 指令（Prompt）擬定一個極簡短的標題（不超過 10 個字），用於指令庫中方便辨識。輸出標題文字即可，不要包含任何引用符號。
  
  指令內容：
  "${promptText}"`;

  try {
    const result = await executeSimpleAIRequest(prompt);
    return result.trim().replace(/^"|"$/g, '');
  } catch (error) {
    console.error("Generate Prompt Title Error:", error);
    return promptText.slice(0, 15) + (promptText.length > 15 ? "..." : "");
  }
};
