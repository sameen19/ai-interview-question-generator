import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import path from "path";
import mongoose from "mongoose";
import { PDFParse } from "pdf-parse";
import mammoth from "mammoth";
import { GoogleGenAI } from "@google/genai";

import Resume from "./models/Resume.js";
import Interview from "./models/Interview.js";

dotenv.config();

const app = express();
const PORT = 5000;

// --------------------------------------------------
// Middleware
// --------------------------------------------------

app.use(cors());
app.use(express.json());

// --------------------------------------------------
// MongoDB Connection
// --------------------------------------------------

const MONGODB_URI =
  process.env.MONGODB_URI ||
  "mongodb://127.0.0.1:27017/ai-interview-generator";

mongoose
  .connect(MONGODB_URI)
  .then(() => {
    console.log("MongoDB connected successfully!");
  })
  .catch((error) => {
    console.error("MongoDB connection error:", error.message);
  });

// --------------------------------------------------
// Gemini AI
// --------------------------------------------------

const ai = new GoogleGenAI({
  apiKey: process.env.GEMINI_API_KEY,
});

// --------------------------------------------------
// Uploads Folder
// --------------------------------------------------

const uploadsDir = path.join(process.cwd(), "uploads");

if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// --------------------------------------------------
// Multer Configuration
// --------------------------------------------------

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },

  filename: (req, file, cb) => {
    const uniqueName =
      Date.now() +
      "-" +
      Math.random().toString(36).substring(2, 10) +
      path.extname(file.originalname);

    cb(null, uniqueName);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10 MB
  },
});

// --------------------------------------------------
// Home Route
// --------------------------------------------------

app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "AI Interview Question Generator Backend is running!",
  });
});

// --------------------------------------------------
// Resume Text Extraction
// --------------------------------------------------

async function extractResumeText(filePath, originalName) {
  const extension = path.extname(originalName).toLowerCase();

  // ---------------- PDF ----------------

  if (extension === ".pdf") {
    const dataBuffer = fs.readFileSync(filePath);

    const parser = new PDFParse({
      data: dataBuffer,
    });

    const result = await parser.getText();

    return result.text;
  }

  // ---------------- DOCX ----------------

  if (extension === ".docx") {
    const result = await mammoth.extractRawText({
      path: filePath,
    });

    return result.value;
  }

  throw new Error(
    "Unsupported file type. Please upload a PDF or DOCX resume."
  );
}

// --------------------------------------------------
// Upload Resume
// --------------------------------------------------

app.post("/api/upload-resume", upload.single("resume"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: "Please upload a resume.",
      });
    }

    console.log("Resume uploaded:", req.file.originalname);

    // Extract text
    const resumeText = await extractResumeText(
      req.file.path,
      req.file.originalname
    );

    console.log("Resume text extracted successfully.");
    console.log(resumeText);

    if (!resumeText || !resumeText.trim()) {
      return res.status(400).json({
        success: false,
        message: "Could not extract text from the resume.",
      });
    }

    // Save resume to MongoDB
    const savedResume = await Resume.create({
      originalName: req.file.originalname,
      filename: req.file.filename,
      filePath: req.file.path,
      fileSize: req.file.size,
      resumeText: resumeText,
    });

    console.log("Resume saved to MongoDB!");
    console.log("Resume ID:", savedResume._id);

    res.json({
      success: true,
      message: "Resume uploaded and analyzed successfully!",
      resumeId: savedResume._id,
      resumeText: resumeText,
      file: {
        originalName: req.file.originalname,
        filename: req.file.filename,
        path: req.file.path,
        size: req.file.size,
      },
    });
  } catch (error) {
    console.error("Resume upload error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to upload resume.",
    });
  }
});

// --------------------------------------------------
// Generate Interview Questions
// --------------------------------------------------

app.post("/api/generate", async (req, res) => {
  try {
    const {
      role,
      jobDescription,
      questionType,
      difficulty,
      numberOfQuestions,
      resumeText,
      resumeId,
    } = req.body;

    // ---------------- Validation ----------------

    if (!role || !role.trim()) {
      return res.status(400).json({
        success: false,
        message: "Role is required.",
      });
    }

    // Job Description is OPTIONAL

    if (!questionType) {
      return res.status(400).json({
        success: false,
        message: "Question type is required.",
      });
    }

    const allowedQuestionTypes = ["Technical", "Experience", "HR"];

    if (!allowedQuestionTypes.includes(questionType)) {
      return res.status(400).json({
        success: false,
        message:
          "Invalid question type. Choose Technical, Experience, or HR.",
      });
    }

    if (!difficulty) {
      return res.status(400).json({
        success: false,
        message: "Difficulty is required.",
      });
    }

    if (!numberOfQuestions) {
      return res.status(400).json({
        success: false,
        message: "Number of questions is required.",
      });
    }

    // --------------------------------------------------
    // Get Resume Text
    // --------------------------------------------------

    let finalResumeText = resumeText;

    if ((!finalResumeText || !finalResumeText.trim()) && resumeId) {
      const resume = await Resume.findById(resumeId);

      if (resume) {
        finalResumeText = resume.resumeText;
      }
    }

    if (!finalResumeText || !finalResumeText.trim()) {
      return res.status(400).json({
        success: false,
        message: "Resume is required. Please upload your resume first.",
      });
    }

    // --------------------------------------------------
    // Optional Job Description
    // --------------------------------------------------

    const finalJobDescription =
      jobDescription && jobDescription.trim()
        ? jobDescription.trim()
        : "No job description was provided. Base the questions on the selected role and the candidate's resume.";

    // --------------------------------------------------
    // Question Type Instructions
    // --------------------------------------------------

    let questionTypeInstructions = "";

    if (questionType === "Technical") {
      questionTypeInstructions = `
TECHNICAL QUESTIONS:

Generate direct, knowledge-based technical interview questions.

Questions should be based on:
- Technologies and skills mentioned in the resume
- The selected job role
- The provided job description, if available

IMPORTANT:
- These must be technical knowledge questions.
- Do NOT ask about the candidate's personal project experience.
- Do NOT ask "Tell me about your project".
- Do NOT ask internship/project implementation questions.
- Do NOT ask HR or behavioral questions.
- Focus on concepts, technologies, frameworks, databases, APIs, programming, architecture, tools, etc.
`;
    }

    if (questionType === "Experience") {
      questionTypeInstructions = `
EXPERIENCE-BASED TECHNICAL QUESTIONS:

Generate technical questions specifically based on the candidate's actual projects and internships mentioned in the resume.

Questions can ask about:
- How a project was implemented
- Technologies used
- Architecture
- Database design
- APIs
- Authentication
- Frontend/backend implementation
- Debugging
- Performance optimization
- Technical decisions
- Challenges faced during implementation
- Why a particular technology was chosen
- How specific features were built

IMPORTANT:
- Questions MUST be technical.
- Questions MUST be connected to projects or internships actually present in the resume.
- Do NOT invent projects, technologies, or experiences.
- Do NOT ask generic technical questions unrelated to the candidate's experience.
- Do NOT ask HR or behavioral questions.
`;
    }

    if (questionType === "HR") {
      questionTypeInstructions = `
HR QUESTIONS:

Generate professional HR and behavioral interview questions.

Questions can be based on:
- The candidate's resume
- Education
- Projects
- Internships
- Achievements
- Career goals
- Teamwork
- Leadership
- Communication
- Conflict handling
- Strengths and weaknesses
- Motivation
- Career decisions
- The selected job role
- The job description, if available
- Company/role fit

Examples of appropriate areas:
- Why do you want this role?
- Why should we hire you?
- Questions about career goals
- Questions about teamwork
- Questions about handling challenges
- Questions about strengths and weaknesses
- Questions about projects from an HR perspective

IMPORTANT:
- Do NOT ask technical implementation questions.
- Do NOT ask coding questions.
- Do NOT ask database/framework/API questions.
- Keep questions professional and interview appropriate.
`;
    }

    // --------------------------------------------------
    // Gemini Prompt
    // --------------------------------------------------

    const prompt = `
You are an expert technical interviewer and HR interviewer.

Your task is to generate personalized interview questions.

CANDIDATE RESUME:
${finalResumeText}

TARGET JOB ROLE:
${role.trim()}

JOB DESCRIPTION:
${finalJobDescription}

QUESTION TYPE:
${questionType}

DIFFICULTY:
${difficulty}

NUMBER OF QUESTIONS:
${numberOfQuestions}

${questionTypeInstructions}

GENERAL RULES:

1. Generate exactly ${numberOfQuestions} questions.
2. Questions must be relevant to the selected role.
3. Use information from the resume.
4. Do not invent information that is not present in the resume.
5. Respect the selected question type.
6. Respect the selected difficulty.
7. Do not provide answers.
8. Do not provide explanations.
9. Do not include question categories unless necessary.
10. Return ONLY valid JSON.

Return the result in exactly this format:

{
  "questions": [
    {
      "id": 1,
      "question": "Question text here"
    }
  ]
}
`;

    console.log(
      `Generating ${numberOfQuestions} ${questionType} questions for ${role}`
    );

    // --------------------------------------------------
    // Gemini API Call
    // --------------------------------------------------

    const response = await ai.models.generateContent({
      model: "gemini-3.6-flash",

      contents: prompt,

      config: {
        responseMimeType: "application/json",
      },
    });

    // --------------------------------------------------
    // Parse Gemini Response
    // --------------------------------------------------

    let parsedResponse;

    try {
      parsedResponse = JSON.parse(response.text);
    } catch (parseError) {
      console.error("Gemini JSON parsing error:", parseError);
      console.error("Gemini response:", response.text);

      return res.status(500).json({
        success: false,
        message: "AI returned an invalid response.",
      });
    }

    const questions = parsedResponse.questions;

    if (!Array.isArray(questions)) {
      return res.status(500).json({
        success: false,
        message: "AI did not return questions in the expected format.",
      });
    }

    // Make sure the requested number was generated
    if (questions.length !== Number(numberOfQuestions)) {
      return res.status(500).json({
        success: false,
        message: `AI generated ${questions.length} questions instead of ${numberOfQuestions}.`,
      });
    }

    // --------------------------------------------------
    // Save Interview to MongoDB
    // --------------------------------------------------

    const savedInterview = await Interview.create({
      role: role.trim(),
      jobDescription: finalJobDescription,
      questionType,
      difficulty,
      numberOfQuestions: Number(numberOfQuestions),
      resumeId: resumeId || null,
      questions,
    });

    console.log("Interview saved to MongoDB!");
    console.log("Interview ID:", savedInterview._id);

    // --------------------------------------------------
    // Response
    // --------------------------------------------------

    res.json({
      success: true,
      message: "Interview questions generated successfully!",
      interviewId: savedInterview._id,
      role: role.trim(),
      questionType,
      difficulty,
      questions,
    });
  } catch (error) {
    console.error("Question generation error:", error);

    res.status(500).json({
      success: false,
      message: error.message || "Failed to generate questions.",
    });
  }
});

// --------------------------------------------------
// Get All Interviews
// --------------------------------------------------

app.get("/api/interviews", async (req, res) => {
  try {
    const interviews = await Interview.find()
      .sort({ createdAt: -1 })
      .populate("resumeId");

    res.json({
      success: true,
      interviews,
    });
  } catch (error) {
    console.error("Fetch interviews error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch interviews.",
    });
  }
});

// --------------------------------------------------
// Get Single Interview
// --------------------------------------------------

app.get("/api/interviews/:id", async (req, res) => {
  try {
    const interview = await Interview.findById(req.params.id).populate(
      "resumeId"
    );

    if (!interview) {
      return res.status(404).json({
        success: false,
        message: "Interview not found.",
      });
    }

    res.json({
      success: true,
      interview,
    });
  } catch (error) {
    console.error("Fetch interview error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch interview.",
    });
  }
});

// --------------------------------------------------
// Get Interviews By Resume
// --------------------------------------------------

app.get("/api/interviews/resume/:resumeId", async (req, res) => {
  try {
    const interviews = await Interview.find({
      resumeId: req.params.resumeId,
    }).sort({ createdAt: -1 });

    res.json({
      success: true,
      interviews,
    });
  } catch (error) {
    console.error("Fetch resume interviews error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch interviews for this resume.",
    });
  }
});

// --------------------------------------------------
// Get Resume
// --------------------------------------------------

app.get("/api/resumes/:id", async (req, res) => {
  try {
    const resume = await Resume.findById(req.params.id);

    if (!resume) {
      return res.status(404).json({
        success: false,
        message: "Resume not found.",
      });
    }

    res.json({
      success: true,
      resume,
    });
  } catch (error) {
    console.error("Fetch resume error:", error);

    res.status(500).json({
      success: false,
      message: "Failed to fetch resume.",
    });
  }
});

// --------------------------------------------------
// Error Handler
// --------------------------------------------------

app.use((error, req, res, next) => {
  console.error("Server error:", error);

  res.status(500).json({
    success: false,
    message: error.message || "Internal server error.",
  });
});

// --------------------------------------------------
// Start Server
// --------------------------------------------------

app.listen(PORT, () => {
  console.log(`Backend server running on http://localhost:${PORT}`);
});