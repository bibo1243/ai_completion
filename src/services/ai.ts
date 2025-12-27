
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
  const modelsToTry = [
    "gemini-1.5-flash",
    "gemini-2.0-flash-001",
    "gemini-2.0-flash-lite-preview-02-05",
    "gemini-1.5-pro",
    "gemini-pro"
  ];

  let lastError;

  for (const modelName of modelsToTry) {
    try {
      console.log(`[SimpleAI] Attempting to use model: ${modelName}`);
      const model = genAI.getGenerativeModel({ model: modelName });
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const text = response.text();
      if (text) return text.trim();
    } catch (e) {
      console.warn(`[SimpleAI] Model ${modelName} failed:`, e);
      lastError = e;
      continue;
    }
  }

  throw lastError || new Error("All AI models failed to respond");
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

export const polishContent = async (content: string, currentTitle: string, customPrompt?: string): Promise<AIResponse> => {
  const defaultPrompt = `
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

  const customInstructionPrompt = `
    You are a professional editor. Please review the following text and current title according to the custom instruction provided.
    
    Current Title: "${currentTitle}"
    Content:
    "${content}"
    
    Custom Instruction:
    "${customPrompt}"
    
    Tasks:
    1. Follow the custom instruction to improve the title in Traditional Chinese (繁體中文).
    2. Follow the custom instruction to improve the content in Traditional Chinese (繁體中文).
    3. Provide a brief summary of what you changed in Traditional Chinese (繁體中文).
    
    Output JSON format ONLY:
    {
      "newTitle": "Improved Title (Traditional Chinese)",
      "newContent": "Improved Content (Traditional Chinese)",
      "summary": "Summary of changes (Traditional Chinese)"
    }
    
    If the content is HTML, preserve the HTML structure/tags in "newContent" but improve the text inside.
    If the content is plain text, keep it plain text.
    ENSURE ALL OUTPUT IS IN TRADITIONAL CHINESE (繁體中文).
  `;

  const prompt = customPrompt && customPrompt.trim() ? customInstructionPrompt : defaultPrompt;

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

  const isStrictPolish = customPrompt?.includes("請僅提供潤飾後的文字") || customPrompt?.includes("嚴格限制純粹潤飾文字");

  // Only include title section if title is provided
  const titleSection = currentTitle.trim()
    ? `【目標內容標題】：\n"${currentTitle}"\n\n`
    : '';

  const finalPrompt = `【系統指令】：
${finalInstruction}

${titleSection}【目標內容備註】：
"${content}"

要求：
1. ${isStrictPolish ? '請嚴格遵守指令，僅輸出潤飾、校對後的內文正文（務必檢查並修正內容中的錯別字與標點符號），絕對不要包含任何「以下是潤飾後的內容」、「好的」、「沒問題」等開場白或感想、說明。' : '請提供詳盡、完整且具備實質價值的回答。'}
2. ${isStrictPolish ? '確保輸出的內容必須僅有正文本身，且語氣自然流暢。' : '針對內容中的細節進行具體展開與深度分析。'}
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

export const generateSEOTitle = async (noteContent: string, customInstruction?: string): Promise<string> => {
  // Truncate content if too long (avoid token limits)
  const truncatedContent = noteContent.length > 3000
    ? noteContent.slice(0, 3000) + '...'
    : noteContent;

  let prompt: string;

  if (customInstruction) {
    prompt = `${customInstruction}

以下是需要處理的文章內容：
---
${truncatedContent}
---

請依據上述指令直接輸出結果（只輸出標題本身，不要加引號）：`;
  } else {
    prompt = `你是一位SEO和內容行銷專家。請仔細閱讀以下文章內容，深入理解其主旨和核心觀點，然後生成一個SEO優化的標題。

重要要求：
1. 你必須「總結」整篇文章的核心主題，而不是直接複製文章開頭的文字
2. 標題長度控制在15-30個中文字之間
3. 標題要包含文章的核心關鍵字
4. 標題要吸引眼球、引發讀者好奇心和點擊欲望
5. 可以使用數字、問句、或情感詞彙來增加吸引力
6. 使用繁體中文
7. 只輸出標題本身，不要加引號、編號或任何說明

範例格式（僅供參考風格，請根據實際內容生成）：
- "5個提升工作效率的必備技巧"
- "為什麼90%的人都做錯了這件事？"
- "一次搞懂：專家教你掌握核心要點"

以下是需要總結的文章內容：
---
${truncatedContent}
---

請直接輸出SEO優化標題：`;
  }

  console.log("Generating SEO title for content length:", noteContent.length);

  try {
    const result = await executeSimpleAIRequest(prompt);
    console.log("SEO Title AI result:", result);
    // Clean up the result - remove quotes, numbers, extra whitespace
    const cleanedResult = result
      .trim()
      .replace(/^["「『]/g, '')
      .replace(/["」』]$/g, '')
      .replace(/^\d+[\.\、\s]+/, '')
      .replace(/^標題[:：]\s*/i, '')
      .trim();
    return cleanedResult || result.trim();
  } catch (error) {
    console.error("Generate SEO Title Error:", error);
    throw error; // Let the UI handle the error instead of returning a bad fallback
  }
};
