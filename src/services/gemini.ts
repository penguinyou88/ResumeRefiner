import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });

export interface ResumeData {
  personalInfo: {
    name: string;
    email: string;
    phone: string;
    location: string;
    website?: string;
    linkedin?: string;
  };
  summary: string;
  experience: Array<{
    company: string;
    position: string;
    startDate: string;
    endDate: string;
    description: string[];
  }>;
  education: Array<{
    school: string;
    degree: string;
    graduationDate: string;
    gpa?: string;
  }>;
  skills: string[];
  projects?: Array<{
    name: string;
    description: string;
    link?: string;
  }>;
}

export async function analyzeResume(fileData: string, mimeType: string): Promise<ResumeData> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        parts: [
          {
            inlineData: {
              data: fileData.split(',')[1],
              mimeType: mimeType,
            },
          },
          {
            text: "Extract the structured resume data from this file. Return it in JSON format matching the ResumeData interface.",
          },
        ],
      },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          personalInfo: {
            type: Type.OBJECT,
            properties: {
              name: { type: Type.STRING },
              email: { type: Type.STRING },
              phone: { type: Type.STRING },
              location: { type: Type.STRING },
              website: { type: Type.STRING },
              linkedin: { type: Type.STRING },
            },
            required: ["name", "email"],
          },
          summary: { type: Type.STRING },
          experience: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                company: { type: Type.STRING },
                position: { type: Type.STRING },
                startDate: { type: Type.STRING },
                endDate: { type: Type.STRING },
                description: { type: Type.ARRAY, items: { type: Type.STRING } },
              },
            },
          },
          education: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                school: { type: Type.STRING },
                degree: { type: Type.STRING },
                graduationDate: { type: Type.STRING },
                gpa: { type: Type.STRING },
              },
            },
          },
          skills: { type: Type.ARRAY, items: { type: Type.STRING } },
          projects: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                name: { type: Type.STRING },
                description: { type: Type.STRING },
                link: { type: Type.STRING },
              },
            },
          },
        },
      },
    },
  });

  return JSON.parse(response.text);
}

export async function rewriteContent(content: string, context: string): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [
      {
        text: `Rewrite the following resume content to be more professional, impactful, and clear. 
        Context: ${context}
        Content: ${content}
        Return ONLY the rewritten text.`,
      },
    ],
  });
  return response.text || content;
}
export async function generateStyledResume(
  userData: ResumeData,
  styleReferenceData?: { data: string; mimeType: string }
): Promise<string> {
  const parts: any[] = [
    {
      text: `You are a professional resume designer. 
      Using the following user data: ${JSON.stringify(userData)}
      
      Generate a beautiful, professional resume in HTML format using Tailwind CSS classes for styling.
      The output should be a single <div> that contains the entire resume.
      Use standard professional fonts (sans, serif, mono).
      Focus on readability, hierarchy, and modern design.
      
      If a style reference is provided, mimic its layout, typography, and color scheme as closely as possible using Tailwind.
      `,
    },
  ];

  if (styleReferenceData) {
    parts.push({
      inlineData: {
        data: styleReferenceData.data.split(',')[1],
        mimeType: styleReferenceData.mimeType,
      },
    });
    parts.push({
      text: "Mimic the style of this reference resume exactly.",
    });
  }

  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: [{ parts }],
  });

  return response.text || "<div>Error generating resume</div>";
}
