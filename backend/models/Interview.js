import mongoose from "mongoose";

const interviewSchema = new mongoose.Schema(
  {
    role: {
      type: String,
      required: true,
    },

    jobDescription: {
      type: String,
      required: false,
      default: "",
    },

    questionType: {
      type: String,
      enum: ["Technical", "Experience", "HR"],
      required: true,
    },

    difficulty: {
      type: String,
      required: true,
    },

    numberOfQuestions: {
      type: Number,
      required: true,
    },

    resumeId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Resume",
      default: null,
    },

    questions: [
      {
        id: Number,
        question: String,
      },
    ],

    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
  }
);

const Interview = mongoose.model("Interview", interviewSchema);

export default Interview;