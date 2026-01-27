import { GoogleGenAI, Type } from "@google/genai";
import { ScenarioNode } from "../types";

const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

export const generateScenarios = async (topic: string, count: number = 3): Promise<ScenarioNode[]> => {
  try {
    const model = "gemini-3-flash-preview";
    const prompt = `
      Bạn là một nhà thiết kế game giáo dục nhưng với phong cách GenZ, trẻ trung, hài hước (dùng slang như: xu cà na, chấn động, trầm cảm, gét gô, u là trời...).
      Hãy tạo ra ${count} tình huống hội thoại giả lập (Simulation) để dạy môn "Kỹ năng thích ứng và giải quyết vấn đề".
      Chủ đề: "${topic}".
      
      Yêu cầu QUAN TRỌNG:
      1. "opponentName": Chỉ ghi TÊN RIÊNG (VD: Minh, Lan, Tuấn). TUYỆT ĐỐI KHÔNG ghi chú thích trong ngoặc (VD: KHÔNG ghi "Minh (Bạn cùng phòng)").
      2. "situationContext": Mô tả bối cảnh và vai trò (VD: "Bạn cùng phòng của bạn đang quạo vì...").
      3. "npcDialogue": Một câu thoại drama, gây cấn hoặc "toxic" từ NPC.
      4. "options": 4 lựa chọn phản hồi.
         - "text": Lời thoại GenZ, đời thường.
         - "isOptimal": true là cách xử lý EQ cao nhất.
         - "npcReaction": NPC phản hồi lại (có thể vẫn quạo hoặc dịu đi).
         - "tensionChange": Độ quạo (-20 đến +20).
         - "trustChange": Độ tin tưởng (-20 đến +20).
         - "explanation": Giải thích ngắn gọn.

      Trả về JSON.
    `;

    const response = await ai.models.generateContent({
      model: model,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              opponentName: { type: Type.STRING },
              situationContext: { type: Type.STRING },
              npcDialogue: { type: Type.STRING },
              options: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    text: { type: Type.STRING },
                    strategy: { type: Type.STRING },
                    isOptimal: { type: Type.BOOLEAN },
                    npcReaction: { type: Type.STRING },
                    tensionChange: { type: Type.INTEGER },
                    trustChange: { type: Type.INTEGER },
                    explanation: { type: Type.STRING }
                  },
                  required: ["text", "strategy", "isOptimal", "npcReaction", "tensionChange", "trustChange", "explanation"]
                }
              }
            },
            required: ["opponentName", "situationContext", "npcDialogue", "options"]
          }
        }
      }
    });

    if (response.text) {
      const rawData = JSON.parse(response.text);
      
      return rawData.map((item: any, index: number) => ({
        id: `sc-${Date.now()}-${index}`,
        opponentName: item.opponentName.replace(/\s*\(.*?\)\s*/g, '').trim(), // Double check clean name
        opponentAvatarId: Math.floor(Math.random() * 1000),
        situationContext: item.situationContext,
        npcDialogue: item.npcDialogue,
        timeLimit: 30, 
        options: item.options.map((opt: any, optIndex: number) => ({
          id: `opt-${index}-${optIndex}`,
          text: opt.text,
          strategy: opt.strategy,
          isOptimal: opt.isOptimal,
          npcReaction: opt.npcReaction,
          tensionChange: opt.tensionChange,
          trustChange: opt.trustChange,
          explanation: opt.explanation
        }))
      }));
    }
    return [];
  } catch (error) {
    console.error("Gemini Error:", error);
    return [];
  }
};
