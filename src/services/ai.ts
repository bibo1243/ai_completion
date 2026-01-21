
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

  const isCustom = !!(customPrompt && customPrompt.trim());

  const requirements = [
    "1. 使用繁體中文（Traditional Chinese）。",
    "2. 直接輸出內容即可，不需要任何 JSON 格式或其他包裝。"
  ];

  if (isStrictPolish) {
    requirements.push("3. 請嚴格遵守指令，僅輸出潤飾、校對後的內文正文（務必檢查並修正內容中的錯別字與標點符號），絕對不要包含任何「以下是潤飾後的內容」、「好的」、「沒問題」等開場白或感想、說明。");
    requirements.push("4. 確保輸出的內容必須僅有正文本身，且語氣自然流暢。");
  } else if (isCustom) {
    requirements.push("3. 請嚴格按照【系統指令】的要求進行回答。回答的長度與深度應完全取決於指令的要求，不要自動過度展開或添加未被要求的內容。");
    requirements.push("4. 請勿包含「好的，這是您的...」或「根據您的要求...」等無關的開場白或結尾。");
    requirements.push("5. 若內容適合，請使用 Markdown 格式（如粗體標題、清單）以利閱讀。");
  } else {
    requirements.push("3. 請提供詳盡、完整且具備實質價值的回答。");
    requirements.push("4. 針對內容中的細節進行具體展開與深度分析。請務必使用 Markdown 格式，針對不同分析主題使用粗體標題（**標題**）並換行分段，確保閱讀清晰。");
    requirements.push("5. 語氣專業、同理且具啟發性。");
  }

  const finalPrompt = `【系統指令】：
${finalInstruction}

${titleSection}【目標內容備註】：
"${content}"

要求：
${requirements.join('\n')}`;

  try {
    if (!content.trim()) throw new Error("內容為空，無法分析");
    // Use simple request to get plain text, avoiding JSON parsing issues
    const result = await executeSimpleAIRequest(finalPrompt);
    return { fullResponse: result };
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
  2. 標題長度控制在15 - 30個中文字之間
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
      .replace(/^\d+[\.、\s]+/, '')
      .replace(/^標題[:：]\s*/i, '')
      .trim();
    return cleanedResult || result.trim();
  } catch (error) {
    console.error("Generate SEO Title Error:", error);
    throw error; // Let the UI handle the error instead of returning a bad fallback
  }
};

export interface SEOKeywordsResult {
  keywords: string[];
}

export const generateSEOKeywords = async (noteContent: string, existingKeywordTags: string[]): Promise<string[]> => {
  // Truncate content if too long (avoid token limits)
  const truncatedContent = noteContent.length > 3000
    ? noteContent.slice(0, 3000) + '...'
    : noteContent;

  const existingKeywordsStr = existingKeywordTags.length > 0
    ? `\n現有的關鍵字標籤（如果與此文章相關，可以優先使用）：${existingKeywordTags.join(', ')}`
    : '';

  const prompt = `你是一位SEO和內容行銷專家。

【任務說明】
請「僅根據以下提供的單一文章內容」提取最適合用於搜尋引擎優化(SEO)的關鍵字。
請勿參考任何其他來源或資料，只分析這一篇文章。
${existingKeywordsStr}

【重要規則】
1. 只分析下方「---」之間的文章內容
2. 提取的關鍵字必須直接來自或高度相關於此文章
3. 關鍵字數量控制在 3-7 個
4. 每個關鍵字不超過 10 個中文字
5. 使用繁體中文
6. 只輸出關鍵字，每個關鍵字用逗號分隔
7. 不要輸出任何解釋或其他文字

【文章內容】
---
${truncatedContent}
---

請直接輸出此文章的關鍵字（用逗號分隔）：`;

  console.log("Generating SEO keywords for content length:", noteContent.length);
  console.log("Content preview:", noteContent.slice(0, 200));

  try {
    const result = await executeSimpleAIRequest(prompt);
    console.log("SEO Keywords AI result:", result);

    // Parse the comma-separated keywords
    const keywords = result
      .split(/[,，、\n]/)
      .map((k: string) => k.trim())
      .filter((k: string) => k.length > 0 && k.length <= 20)
      .slice(0, 7); // Limit to 7 keywords

    return keywords;
  } catch (error) {
    console.error("Generate SEO Keywords Error:", error);
    throw error;
  }
};

export interface TaskPlan {
  id?: string;
  title: string;
  description?: string;
  start_date?: string | null;
  due_date?: string | null;
  subtasks?: TaskPlan[];
  dependencies?: string[];
}

export const planTaskBreakdown = async (
  taskTitle: string,
  taskNote: string,
  taskStartDate: string | null,
  taskDueDate: string | null,
  context: {
    today: string;
    existingSchedule?: string[];
    pastExperiences?: string[];
  },
  customInstruction?: string
): Promise<TaskPlan[]> => {
  const scheduleContext = context.existingSchedule && context.existingSchedule.length > 0
    ? `\nExisting Schedule (Potential Conflicts):\n${context.existingSchedule.join('\n')}`
    : '';

  const experienceContext = context.pastExperiences && context.pastExperiences.length > 0
    ? `\nRelevant Past Experience:\n${context.pastExperiences.join('\n')}`
    : '';

  const prompt = `
Role: 行政總管 AI (Chief Administrative Officer)。你是一位經驗豐富、觀察入微的行政總管。你的任務是將一個大型任務拆解成可執行的子任務，並為每個子任務提供詳盡的執行說明與注意事項。

Source Task:
- 標題: "${taskTitle}"
- 備註/描述: "${taskNote || '(無備註)'}"
- 開始日期: ${taskStartDate || '未指定'}
- 到期日期: ${taskDueDate || '未指定'}
- 今日日期: ${context.today}
${customInstruction ? `\n使用者指令: "${customInstruction}"` : ''}
${scheduleContext}
${experienceContext}

Instructions:
1. 仔細研讀標題與備註，識別需要執行的主題、步驟、細節需求。
2. 參考「過往經驗 (Relevant Past Experience)」(若有) 來優化執行步驟或避開常見錯誤。
3. 參考「現有行事曆 (Existing Schedule)」(若有)，若新生成的子任務日期與現有強碰，請在 description 中加入「⚠️日期衝突警示」並建議調整。
4. 將任務拆解成邏輯清晰的階層式子任務。
5. 對於每個子任務：
   - "title": 簡潔、動作導向的標題。
   - "description": 【重要】具體執行說明、注意事項、或衝突警示。
   - "start_date": YYYY-MM-DD 格式。
   - "due_date": YYYY-MM-DD 格式。
6. "subtasks": 若該子任務可進一步細分，則提供巢狀子任務陣列；否則為空陣列。

Output Rules:
- 輸出必須是嚴格有效的 JSON 陣列。
- 不要輸出任何 Markdown、說明文字、或「以下是...」等開場白。只輸出 JSON。
- 所有文字使用繁體中文。
- description 欄位絕對不能與 title 相同或為空。

JSON Format:
[
  {
    "title": "子任務標題",
    "description": "針對此子任務的具體執行說明與注意事項...",
    "start_date": "YYYY-MM-DD",
    "due_date": "YYYY-MM-DD",
    "subtasks": []
  }
]
`;

  try {
    const rawResult = await executeSimpleAIRequest(prompt);
    console.log("Mission 72 Raw Output:", rawResult);

    // Clean JSON
    let jsonStr = rawResult;
    // Find array structure
    const jsonMatch = rawResult.match(/\[[\s\S]*\]/);
    if (jsonMatch) jsonStr = jsonMatch[0];

    // Remove markdown code blocks if any
    jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(jsonStr);
  } catch (error) {
    console.error("Mission 72 Planning Error:", error);
    throw new Error("AI 無法生成任務計畫，請稍後再試。");
  }
};

/**
 * Find the best parent keyword tag for a new keyword based on semantic similarity
 * @param newKeyword The new keyword to be categorized (without # prefix)
 * @param existingKeywords Array of existing keyword tags with their hierarchy info
 * @returns The ID of the best parent tag, or null if it should be a top-level keyword
 */
export interface KeywordHierarchy {
  id: string;
  name: string; // without # prefix
  parentId: string | null;
  depth: number;
}

export const findBestParentKeyword = async (
  newKeyword: string,
  existingKeywords: KeywordHierarchy[]
): Promise<string | null> => {
  if (existingKeywords.length === 0) {
    return null;
  }

  // Build a representation of the keyword hierarchy for the AI
  const keywordList = existingKeywords
    .map(k => `- ${k.name} (ID: ${k.id}, 層級: ${k.depth})`)
    .join('\n');

  const prompt = `你是一位語義分析專家。請判斷新關鍵字「${newKeyword}」應該歸屬於哪個現有關鍵字之下（成為其子關鍵字）。

現有的關鍵字列表：
${keywordList}

判斷規則：
1. 如果新關鍵字是某個現有關鍵字的具體細分、子類別、或相關延伸，則選擇該關鍵字作為父關鍵字
2. 例如：「咖啡」可以是「飲品」的子關鍵字；「行銷策略」可以是「行銷」的子關鍵字
3. 如果沒有任何現有關鍵字適合作為父關鍵字，請回答 "NONE"
4. 優先選擇語義上最接近、最具體的父關鍵字

請只輸出一個關鍵字的 ID，或輸出 "NONE"。不要輸出任何解釋文字。`;

  try {
    const result = await executeSimpleAIRequest(prompt);
    const cleanResult = result.trim().replace(/["""'']/g, '');

    // Check if the result is a valid ID from the existing keywords
    if (cleanResult === 'NONE' || cleanResult.toLowerCase() === 'none') {
      return null;
    }

    // Verify the ID exists in our keyword list
    const matchedKeyword = existingKeywords.find(k => k.id === cleanResult);
    if (matchedKeyword) {
      return matchedKeyword.id;
    }

    // Try to match by name if ID wasn't returned directly
    const matchByName = existingKeywords.find(
      k => cleanResult.toLowerCase().includes(k.name.toLowerCase()) ||
        k.name.toLowerCase().includes(cleanResult.toLowerCase())
    );
    if (matchByName) {
      return matchByName.id;
    }

    return null;


  } catch (error) {
    console.error("Find Best Parent Keyword Error:", error);
    return null;
  }
};

// Define the response structure
export interface GTDResponse {
  reply: string; // The message to the user
  current_stage: 'capture' | 'clarify' | 'organize' | 'engage'; // Current GTD stage
  actions?: Array<
    | { type: 'update_task'; params: { title?: string; description?: string; due_date?: string; start_date?: string; start_time?: string; reminder_minutes?: number; tags?: string[] } } // tags are names
    | { type: 'add_subtasks'; params: { tasks: Array<{ title: string; start_date?: string; start_time?: string; reminder_minutes?: number; due_date?: string }> } }
  >;
}

export const chatWithGTDCoach = async (
  taskContext: {
    title: string;
    description: string;
    status: string;
    created_at: string;
    due_date?: string | null;
    start_date?: string | null;
    tags: string[];
    project_title?: string;
  },
  scheduleContext: string[], // List of plain text strings describing upcoming schedule
  userMessage: string,
  history: { role: 'user' | 'assistant'; content: string }[] = []
): Promise<GTDResponse> => {
  const gtdPrompt = `
角色設定：你是一位高效率的 GTD (Getting Things Done) 教練。你的目標是**引導**使用者完成 GTD 流程，而非急著把事情做完。
請判斷使用者目前處於哪個階段，並一步步帶領。

目前聚焦的任務：
- 標題：${taskContext.title}
- 備註：${taskContext.description || '(無)'}
- 狀態：${taskContext.status}
- 建立時間：${taskContext.created_at}
- 到期日：${taskContext.due_date || '未設定'}
- 開始日(執行日)：${taskContext.start_date || '未設定'}
- 標籤：${taskContext.tags.join(', ') || '無'}
- 所屬專案：${taskContext.project_title || '無 (可能在收件匣)'}

行程概覽 (作為參考，避免時間衝突)：
${scheduleContext.length > 0 ? scheduleContext.join('\n') : '(目前無其他緊迫行程)'}

對話歷史：
${history.map(m => `${m.role === 'user' ? '使用者' : 'GTD秘書'}: ${m.content}`).join('\n')}

使用者目前輸入：
"${userMessage}"

GTD 階段定義 (current_stage)：
1. capture (收集): 任務剛產生，資訊模糊，還在收件匣。
2. clarify (釐清): 正在詢問這是否可行動？下一步是什麼？
3. organize (組織): 正在設定屬性。**注意：時間設定請優先使用「開始日 (start_date)」，這是使用者「打算開始做」的時間。若有具體時刻請設 start_time (HH:MM)。僅在有硬性死線時設定「到期日 (due_date)」。**
4. engage (執行): 任務屬性已完善，準備開始執行或拆解細項。

回應原則：
1. **不要急著執行**：請先與使用者透過對話擬定計畫。在初期階段，請用文字描述建議的步驟，**不要**生成 \`actions\` JSON。
2. **流程引導**：告訴使用者目前在什麼階段，下一步該做什麼。
3. **時間優先**：規劃時間時，預設設定 \`start_date\`。
4. **生成動作機制**：請等到**所有計畫細節**（步驟、日期、時間、提醒）都在對話中確認完畢，且使用者明確表示「好，執行」、「建立任務」或「這樣可以」時，才**一次性**生成包含所有子任務的 \`actions\` JSON。這能讓使用者一次確認完整清單。若有提醒需求，請設定 reminder_minutes。

回應格式 (JSON Only)：
{
  "reply": "給使用者的回應...",
  "current_stage": "capture" | "clarify" | "organize" | "engage",
  "actions": [
    { "type": "update_task", "params": { "start_date": "YYYY-MM-DD", "start_time": "09:00", "reminder_minutes": 0 } },
    { "type": "add_subtasks", "params": { "tasks": [{ "title": "...", "start_date": "...", "reminder_minutes": 10 }] } }
  ]
}
* \`actions\` 若無則為空陣列。

請直接輸出 JSON：
`;

  try {
    const rawResult = await executeSimpleAIRequest(gtdPrompt);

    // Parse JSON
    let jsonStr = rawResult;
    const jsonMatch = rawResult.match(/\{[\s\S]*\}/);
    if (jsonMatch) jsonStr = jsonMatch[0];
    jsonStr = jsonStr.replace(/```json/g, '').replace(/```/g, '').trim();

    return JSON.parse(jsonStr) as GTDResponse;
  } catch (error) {
    console.error("GTD Coach Error:", error);
    // Fallback to text response if JSON parsing fails
    return {
      reply: "不好意思，我處理資料時發生了一點錯誤，請再試一次。",
      current_stage: 'capture',
      actions: []
    };
  }
};

