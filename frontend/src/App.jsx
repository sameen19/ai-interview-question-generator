import { useState } from "react";
import "./App.css";

function App() {
  const [role, setRole] = useState("");
  const [jobDescription, setJobDescription] = useState("");
  const [questionType, setQuestionType] = useState("Technical");
  const [difficulty, setDifficulty] = useState("Medium");
  const [numberOfQuestions, setNumberOfQuestions] = useState(10);

  const [resume, setResume] = useState(null);
  const [resumeId, setResumeId] = useState(null);
  const [resumeText, setResumeText] = useState("");

  const [uploading, setUploading] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [questions, setQuestions] = useState([]);

  const questionTypeInfo = {
    Technical:
      "Knowledge-based questions about technologies, frameworks, databases and core concepts.",

    Experience:
      "Technical questions based specifically on projects and internships in your resume.",

    HR:
      "Professional questions about your background, motivation, teamwork and career goals.",
  };

  // ---------------------------------------------
  // Upload Resume
  // ---------------------------------------------

  const handleResumeUpload = async (event) => {
    const file = event.target.files[0];

    if (!file) return;

    const extension = file.name.split(".").pop().toLowerCase();

    if (!["pdf", "docx"].includes(extension)) {
      alert("Please upload a PDF or DOCX file.");
      return;
    }

    setResume(file);
    setUploading(true);
    setQuestions([]);

    const formData = new FormData();
    formData.append("resume", file);

    try {
      const response = await fetch(
        "http://localhost:5000/api/upload-resume",
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(data.message || "Resume upload failed.");
      }

      setResumeId(data.resumeId);
      setResumeText(data.resumeText);

      alert("Resume uploaded successfully!");
    } catch (error) {
      console.error(error);

      alert(error.message || "Failed to upload resume.");

      setResume(null);
      setResumeId(null);
      setResumeText("");
    } finally {
      setUploading(false);
    }
  };

  // ---------------------------------------------
  // Generate Questions
  // ---------------------------------------------

  const generateQuestions = async () => {
    if (!role.trim()) {
      alert("Please enter a job role.");
      return;
    }

    if (!resumeId && !resumeText) {
      alert("Please upload your resume first.");
      return;
    }

    setGenerating(true);
    setQuestions([]);

    try {
      const response = await fetch(
        "http://localhost:5000/api/generate",
        {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            role,
            jobDescription,
            questionType,
            difficulty,
            numberOfQuestions,
            resumeText,
            resumeId,
          }),
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        throw new Error(
          data.message || "Failed to generate questions."
        );
      }

      setQuestions(data.questions);
    } catch (error) {
      console.error(error);

      alert(
        error.message ||
          "Something went wrong while generating questions."
      );
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="app">
      {/* =========================================
          NAVBAR
      ========================================= */}

      <header className="navbar">
        <div className="navbar-container">
          <div className="brand">
            <div className="brand-icon">AI</div>

            <div>
              <div className="brand-title">
                InterviewAI
              </div>

              <div className="brand-subtitle">
                Smart interview preparation
              </div>
            </div>
          </div>

          <div className="ai-status">
            <span></span>
            AI Powered
          </div>
        </div>
      </header>

      {/* =========================================
          HERO
      ========================================= */}

      <section className="hero">
        <div className="hero-container">
          <div className="hero-badge">
            ✦ Personalized interview preparation
          </div>

          <h1>
            Prepare smarter.
            <br />
            <span>Interview with confidence.</span>
          </h1>

          <p>
            Upload your resume and generate personalized
            interview questions based on your skills,
            experience and target role.
          </p>
        </div>
      </section>

      {/* =========================================
          MAIN CONTENT
      ========================================= */}

      <main className="main-container">
        <div className="layout">
          {/* =====================================
              FORM
          ===================================== */}

          <section className="form-card">
            <div className="form-header">
              <div className="header-icon">✦</div>

              <div>
                <div className="small-heading">
                  INTERVIEW SETUP
                </div>

                <h2>Create Your Interview</h2>

                <p>
                  Configure your interview and let AI
                  generate personalized questions.
                </p>
              </div>
            </div>

            <div className="form-body">
              {/* JOB ROLE */}

              <div className="form-group">
                <label>
                  Job Role <span className="required">*</span>
                </label>

                <input
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder="e.g. MERN Stack Developer"
                />
              </div>

              {/* JOB DESCRIPTION */}

              <div className="form-group">
                <div className="label-line">
                  <label>Job Description</label>

                  <span className="optional">
                    OPTIONAL
                  </span>
                </div>

                <textarea
                  value={jobDescription}
                  onChange={(e) =>
                    setJobDescription(e.target.value)
                  }
                  placeholder="Paste the job description here to make questions more specific..."
                  rows={5}
                />

                <div className="hint">
                  Adding a job description helps the AI
                  understand the requirements of the position.
                </div>
              </div>

              {/* QUESTION TYPE */}

              <div className="form-group">
                <label>Question Type</label>

                <select
                  value={questionType}
                  onChange={(e) => {
                    setQuestionType(e.target.value);
                    setQuestions([]);
                  }}
                >
                  <option value="Technical">
                    Technical Questions
                  </option>

                  <option value="Experience">
                    Experience-Based Questions
                  </option>

                  <option value="HR">
                    HR Questions
                  </option>
                </select>

                <div className="question-type-info">
                  <div className="info-icon">
                    {questionType === "Technical"
                      ? "⌘"
                      : questionType === "Experience"
                      ? "◆"
                      : "◎"}
                  </div>

                  <div>
                    <strong>
                      {questionType === "Technical"
                        ? "Technical Knowledge"
                        : questionType === "Experience"
                        ? "Project & Internship"
                        : "HR & Behavioral"}
                    </strong>

                    <p>
                      {questionTypeInfo[questionType]}
                    </p>
                  </div>
                </div>
              </div>

              {/* SETTINGS */}

              <div className="two-column">
                <div className="form-group">
                  <label>Difficulty</label>

                  <select
                    value={difficulty}
                    onChange={(e) => {
                      setDifficulty(e.target.value);
                      setQuestions([]);
                    }}
                  >
                    <option value="Easy">Easy</option>
                    <option value="Medium">Medium</option>
                    <option value="Hard">Hard</option>
                  </select>
                </div>

                <div className="form-group">
                  <label>Number of Questions</label>

                  <select
                    value={numberOfQuestions}
                    onChange={(e) => {
                      setNumberOfQuestions(
                        Number(e.target.value)
                      );
                      setQuestions([]);
                    }}
                  >
                    <option value={5}>5 Questions</option>
                    <option value={10}>10 Questions</option>
                    <option value={15}>15 Questions</option>
                    <option value={20}>20 Questions</option>
                  </select>
                </div>
              </div>

              {/* RESUME */}

              <div className="form-group">
                <label>
                  Resume <span className="required">*</span>
                </label>

                <input
                  id="resume-upload"
                  type="file"
                  accept=".pdf,.docx"
                  onChange={handleResumeUpload}
                  className="file-input"
                />

                <label
                  htmlFor="resume-upload"
                  className={`upload-box ${
                    resume ? "uploaded" : ""
                  }`}
                >
                  <div className="upload-icon">
                    {resume ? "✓" : "↑"}
                  </div>

                  <div className="upload-text">
                    {resume ? (
                      <>
                        <strong>{resume.name}</strong>

                        <span>
                          {uploading
                            ? "Uploading and analyzing resume..."
                            : "Resume uploaded successfully"}
                        </span>
                      </>
                    ) : (
                      <>
                        <strong>
                          Upload your resume
                        </strong>

                        <span>
                          PDF or DOCX · Maximum 10 MB
                        </span>
                      </>
                    )}
                  </div>

                  {!resume && (
                    <div className="browse-button">
                      Browse
                    </div>
                  )}
                </label>
              </div>

              {/* GENERATE */}

              <button
                className="generate-button"
                onClick={generateQuestions}
                disabled={generating || uploading}
              >
                {generating ? (
                  <>
                    <span className="spinner"></span>
                    Generating Questions...
                  </>
                ) : (
                  <>
                    Generate Interview Questions
                    <span>→</span>
                  </>
                )}
              </button>
            </div>
          </section>

          {/* =====================================
              SIDE PANEL
          ===================================== */}

          <aside className="sidebar">
            {/* SUMMARY */}

            <div className="side-card">
              <div className="small-heading">
                YOUR INTERVIEW
              </div>

              <h3>
                {role || "Your target role"}
              </h3>

              <div className="divider"></div>

              <div className="summary-row">
                <span>Question Type</span>
                <strong>{questionType}</strong>
              </div>

              <div className="summary-row">
                <span>Difficulty</span>
                <strong>{difficulty}</strong>
              </div>

              <div className="summary-row">
                <span>Questions</span>
                <strong>{numberOfQuestions}</strong>
              </div>

              <div className="summary-row">
                <span>Job Description</span>

                <strong>
                  {jobDescription.trim()
                    ? "Added"
                    : "Not provided"}
                </strong>
              </div>
            </div>

            {/* HOW IT WORKS */}

            <div className="side-card">
              <div className="small-heading">
                HOW IT WORKS
              </div>

              <div className="step">
                <div className="step-number">01</div>

                <div>
                  <strong>Upload your resume</strong>

                  <p>
                    AI extracts relevant information from
                    your resume.
                  </p>
                </div>
              </div>

              <div className="step">
                <div className="step-number">02</div>

                <div>
                  <strong>Choose your interview</strong>

                  <p>
                    Select technical, experience or HR
                    questions.
                  </p>
                </div>
              </div>

              <div className="step">
                <div className="step-number">03</div>

                <div>
                  <strong>Generate questions</strong>

                  <p>
                    Get questions personalized to your
                    profile.
                  </p>
                </div>
              </div>
            </div>
          </aside>
        </div>

        {/* =========================================
            QUESTIONS
        ========================================= */}

        {questions.length > 0 && (
          <section className="questions-card">
            <div className="questions-header">
              <div>
                <div className="small-heading">
                  GENERATED INTERVIEW
                </div>

                <h2>Your Interview Questions</h2>

                <p>
                  Personalized {questionType.toLowerCase()}{" "}
                  questions for <strong>{role}</strong>
                </p>
              </div>

              <div className="questions-badge">
                {questions.length} Questions
              </div>
            </div>

            <div className="questions-list">
              {questions.map((item, index) => (
                <div
                  className="question"
                  key={item.id || index}
                >
                  <div className="question-number">
                    {String(index + 1).padStart(2, "0")}
                  </div>

                  <div>
                    <span>
                      QUESTION {index + 1}
                    </span>

                    <p>{item.question}</p>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <footer className="footer">
        <span>InterviewAI</span>
        <span>AI-powered interview preparation</span>
      </footer>
    </div>
  );
}

export default App;