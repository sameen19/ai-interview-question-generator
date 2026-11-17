from fastapi import FastAPI, UploadFile, File, HTTPException
import pymupdf
from docx import Document
import spacy
import re
import io

app = FastAPI(title="Resume Analyzer")


# ============================================================
# SPACY
# ============================================================

nlp = spacy.load("en_core_web_sm")


# ============================================================
# TEXT EXTRACTION
# ============================================================

def extract_pdf_text(file_bytes: bytes) -> str:
    """Extract text from a PDF file."""

    text = ""

    try:
        pdf = pymupdf.open(stream=file_bytes, filetype="pdf")

        for page in pdf:
            text += page.get_text() + "\n"

        pdf.close()

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read PDF: {str(e)}"
        )

    return text


def extract_docx_text(file_bytes: bytes) -> str:
    """Extract text from a DOCX file."""

    try:
        document = Document(io.BytesIO(file_bytes))

        text = []

        # Paragraphs
        for paragraph in document.paragraphs:
            if paragraph.text.strip():
                text.append(paragraph.text)

        # Tables
        for table in document.tables:
            for row in table.rows:
                for cell in row.cells:
                    if cell.text.strip():
                        text.append(cell.text)

        return "\n".join(text)

    except Exception as e:
        raise HTTPException(
            status_code=400,
            detail=f"Could not read DOCX: {str(e)}"
        )


def extract_text(filename: str, file_bytes: bytes) -> str:
    """Choose extraction method based on file type."""

    filename = filename.lower()

    if filename.endswith(".pdf"):
        return extract_pdf_text(file_bytes)

    elif filename.endswith(".docx"):
        return extract_docx_text(file_bytes)

    else:
        raise HTTPException(
            status_code=400,
            detail="Only PDF and DOCX files are supported."
        )


# ============================================================
# TEXT CLEANING
# ============================================================

def clean_text(text: str) -> str:
    """Clean and normalize extracted resume text."""

    text = text.replace("\r", "\n")

    # Replace unusual whitespace
    text = text.replace("\u00a0", " ")
    text = text.replace("\u200b", "")

    # Normalize bullets
    text = text.replace("•", " ")
    text = text.replace("▪", " ")
    text = text.replace("●", " ")

    # Remove excessive spaces while preserving new lines
    text = re.sub(r"[ \t]+", " ", text)

    # Remove excessive blank lines
    text = re.sub(r"\n{3,}", "\n\n", text)

    return text.strip()


# ============================================================
# CONTACT INFORMATION
# ============================================================

def extract_email(text: str):
    """Extract email address."""

    match = re.search(
        r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}",
        text
    )

    return match.group(0) if match else None


def extract_phone(text: str):
    """Extract Indian phone number."""

    patterns = [
        r"\+91[\s-]?[6-9]\d{9}",
        r"\b[6-9]\d{9}\b"
    ]

    for pattern in patterns:
        match = re.search(pattern, text)

        if match:
            return match.group(0)

    return None


# ============================================================
# LINKS
# ============================================================

def extract_links(text: str):
    """Extract LinkedIn, GitHub and LeetCode URLs."""

    links = {
        "linkedin": None,
        "github": None,
        "leetcode": None
    }

    urls = re.findall(
        r"(?:https?://|www\.)[^\s<>\"]+",
        text,
        flags=re.IGNORECASE
    )

    for url in urls:

        url = url.rstrip(".,;:)]}")

        lower_url = url.lower()

        if "linkedin.com" in lower_url:
            links["linkedin"] = url

        elif "github.com" in lower_url:
            links["github"] = url

        elif "leetcode.com" in lower_url:
            links["leetcode"] = url

    return links


# ============================================================
# SKILL DATABASE
# ============================================================

SKILL_CATEGORIES = {

    "programming_languages": [
        "C",
        "C++",
        "C#",
        "Java",
        "JavaScript",
        "TypeScript",
        "Python",
        "Go",
        "Rust",
        "PHP"
    ],

    "frontend": [
        "HTML",
        "CSS",
        "React.js",
        "React",
        "Angular",
        "Vue.js",
        "Vue",
        "Next.js",
        "Bootstrap",
        "Tailwind CSS"
    ],

    "backend": [
        "Node.js",
        "Express.js",
        "Django",
        "Flask",
        "FastAPI",
        "Spring Boot"
    ],

    "databases": [
        "MongoDB",
        "MySQL",
        "PostgreSQL",
        "SQL",
        "Oracle",
        "Redis"
    ],

    "apis_and_architecture": [
        "REST API",
        "REST APIs",
        "GraphQL",
        "Microservices"
    ],

    "tools": [
        "Git",
        "GitHub",
        "Postman",
        "Docker",
        "Kubernetes",
        "VS Code"
    ],

    "cloud": [
        "AWS",
        "Azure",
        "Google Cloud",
        "GCP"
    ],

    "ai_and_machine_learning": [
        "Machine Learning",
        "Deep Learning",
        "NLP",
        "Natural Language Processing",
        "TensorFlow",
        "PyTorch",
        "scikit-learn",
        "spaCy",
        "OpenCV"
    ],

    "computer_science": [
        "Data Structures",
        "Data Structures and Algorithms",
        "DSA",
        "Algorithms",
        "OOP",
        "OOPs",
        "DBMS",
        "Operating Systems",
        "OS",
        "Computer Networks",
        "DCCN"
    ],

    "other": [
        "Joi",
        "JWT",
        "Agile",
        "OpenCV"
    ]
}


# ============================================================
# SKILL NORMALIZATION
# ============================================================

SKILL_NORMALIZATION = {
    "react": "React.js",
    "react.js": "React.js",

    "node.js": "Node.js",

    "express.js": "Express.js",

    "rest api": "REST API",
    "rest apis": "REST API",

    "javascript": "JavaScript",

    "typescript": "TypeScript",

    "python": "Python",

    "mongodb": "MongoDB",
    "mysql": "MySQL",
    "postgresql": "PostgreSQL",

    "html": "HTML",
    "css": "CSS",

    "c": "C",
    "c++": "C++",
    "c#": "C#",

    "github": "GitHub",
    "git": "Git",

    "postman": "Postman",

    "nlp": "NLP",
    "natural language processing": "NLP",

    "machine learning": "Machine Learning",
    "deep learning": "Deep Learning",

    "opencv": "OpenCV",

    "oop": "OOP",
    "oops": "OOP",

    "os": "Operating Systems",
    "operating systems": "Operating Systems",

    "dsa": "DSA",
    "data structures": "Data Structures",
    "data structures and algorithms": "DSA",

    "dbms": "DBMS",

    "dccn": "DCCN"
}


def extract_skills(text: str):
    """Extract and normalize skills from resume."""

    found_skills = []
    text_lower = text.lower()

    for category, skills in SKILL_CATEGORIES.items():

        for skill in skills:

            skill_lower = skill.lower()

            pattern = r"(?<!\w)" + re.escape(skill_lower) + r"(?!\w)"

            if re.search(pattern, text_lower):

                normalized = SKILL_NORMALIZATION.get(
                    skill_lower,
                    skill
                )

                if normalized not in found_skills:
                    found_skills.append(normalized)

    return found_skills


def categorize_skills(skills):
    """Organize detected skills by category."""

    categorized = {
        "programming_languages": [],
        "frontend": [],
        "backend": [],
        "databases": [],
        "apis_and_architecture": [],
        "tools": [],
        "cloud": [],
        "ai_and_machine_learning": [],
        "computer_science": [],
        "other": []
    }

    for skill in skills:

        skill_lower = skill.lower()

        for category, category_skills in SKILL_CATEGORIES.items():

            normalized_category_skills = [
                SKILL_NORMALIZATION.get(
                    s.lower(),
                    s
                )
                for s in category_skills
            ]

            if skill in normalized_category_skills:
                if skill not in categorized[category]:
                    categorized[category].append(skill)

                break

    return categorized


# ============================================================
# SECTION DETECTION
# ============================================================

SECTION_ALIASES = {

    "objective": [
        "objective",
        "career objective",
        "profile",
        "professional profile",
        "summary",
        "professional summary"
    ],

    "education": [
        "education",
        "educational qualification",
        "academic qualification",
        "academic background"
    ],

    "technical_skills": [
        "technical skills",
        "technical skill",
        "skills",
        "key skills",
        "core skills",
        "skills summary"
    ],

    "experience": [
        "experience",
        "work experience",
        "professional experience",
        "employment",
        "internship",
        "internships"
    ],

    "projects": [
        "projects",
        "academic projects",
        "personal projects",
        "key projects"
    ],

    "certifications": [
        "certifications",
        "certificates",
        "certification"
    ],

    "achievements": [
        "achievements",
        "awards",
        "honors",
        "accomplishments"
    ],

    "activities": [
        "activities",
        "extra curricular activities",
        "extracurricular activities",
        "co-curricular activities",
        "positions of responsibility"
    ]
}


def normalize_section_heading(line: str):
    """Return normalized section name if line is a section heading."""

    normalized = line.strip().lower()

    normalized = normalized.strip(
        " :-–—|"
    )

    # Remove ampersands / punctuation for matching
    normalized_clean = re.sub(
        r"[^a-z\s]",
        "",
        normalized
    )

    for section, aliases in SECTION_ALIASES.items():

        for alias in aliases:

            alias_clean = re.sub(
                r"[^a-z\s]",
                "",
                alias.lower()
            )

            if normalized_clean == alias_clean:
                return section

    # Special combined heading
    if (
        "certifications" in normalized_clean
        and "activities" in normalized_clean
    ):
        return "certifications_and_activities"

    return None


def detect_sections(text: str):
    """Split resume into logical sections."""

    sections = {
        "other": []
    }

    current_section = "other"

    lines = text.split("\n")

    for line in lines:

        clean_line = line.strip()

        if not clean_line:
            continue

        section = normalize_section_heading(clean_line)

        if section:

            if section == "certifications_and_activities":

                current_section = "certifications_and_activities"

                if current_section not in sections:
                    sections[current_section] = []

            else:

                current_section = section

                if current_section not in sections:
                    sections[current_section] = []

        else:

            sections[current_section].append(clean_line)

    # Convert lists to strings
    for section in sections:
        sections[section] = "\n".join(
            sections[section]
        ).strip()

    return sections


# ============================================================
# NAME EXTRACTION
# ============================================================

def clean_possible_name(name: str):
    """Clean a possible candidate name."""

    name = name.strip()

    # Remove phone prefix accidentally attached to name
    name = re.sub(
        r"\+91.*$",
        "",
        name
    ).strip()

    # Remove phone numbers
    name = re.sub(
        r"\b[6-9]\d{9}\b",
        "",
        name
    ).strip()

    return name


def extract_name(text: str):
    """Extract candidate name from the beginning of the resume."""

    lines = [
        line.strip()
        for line in text.split("\n")
        if line.strip()
    ]

    if not lines:
        return None

    # First line is usually the name in a standard resume.
    first_line = clean_possible_name(lines[0])

    # Reject obvious non-name lines
    rejected_patterns = [
        r"@",
        r"\+?\d[\d\s-]{8,}",
        r"linkedin",
        r"github",
        r"leetcode",
        r"resume",
        r"curriculum vitae"
    ]

    for pattern in rejected_patterns:

        if re.search(
            pattern,
            first_line,
            flags=re.IGNORECASE
        ):
            first_line = ""

    if first_line:

        # Name normally contains 2-5 words
        words = first_line.split()

        if 1 <= len(words) <= 6:

            # Avoid returning headings
            if first_line.lower() not in SECTION_ALIASES:
                return first_line

    # Fallback: spaCy PERSON entity
    first_part = "\n".join(lines[:10])

    doc = nlp(first_part)

    for entity in doc.ents:

        if entity.label_ == "PERSON":

            possible_name = clean_possible_name(
                entity.text
            )

            if possible_name:
                return possible_name

    return lines[0]


# ============================================================
# EDUCATION EXTRACTION
# ============================================================

def extract_education(sections):
    """Extract structured education information."""

    education_text = sections.get(
        "education",
        ""
    )

    if not education_text:
        return []

    lines = [
        line.strip()
        for line in education_text.split("\n")
        if line.strip()
    ]

    education = []
    current = None

    for line in lines:

        # CGPA
        cgpa_match = re.search(
            r"CGPA\s*[:\-]?\s*([0-9.]+)\s*(?:/\s*10)?",
            line,
            flags=re.IGNORECASE
        )

        # Percentage
        percentage_match = re.search(
            r"([0-9]+(?:\.[0-9]+)?)\s*%",
            line
        )

        if cgpa_match:

            if current:
                current["cgpa"] = cgpa_match.group(1)

            continue

        if percentage_match:

            if current:
                current["percentage"] = percentage_match.group(1)

            continue

        # New education entry
        if (
            "B.Tech" in line
            or "B.E" in line
            or "BCA" in line
            or "M.Tech" in line
            or "MCA" in line
            or "Bachelor" in line
            or "Master" in line
            or "Secondary" in line
            or "School" in line
            or "12th" in line
            or "10th" in line
        ):

            current = {
                "qualification": line,
                "institution": None,
                "cgpa": None,
                "percentage": None
            }

            education.append(current)

        else:

            if current and current["institution"] is None:
                current["institution"] = line

    return education


# ============================================================
# EXPERIENCE EXTRACTION
# ============================================================

def extract_experience(sections):
    """Extract basic structured work/internship experience."""

    experience_text = sections.get(
        "experience",
        ""
    )

    if not experience_text:
        return []

    lines = [
        line.strip()
        for line in experience_text.split("\n")
        if line.strip()
    ]

    experiences = []

    current = None

    date_pattern = re.compile(
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)"
        r"[a-z]*\.?\s*[-–]\s*"
        r"(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Sept|Oct|Nov|Dec)"
        r"[a-z]*\.?\s*\d{4}",
        flags=re.IGNORECASE
    )

    for line in lines:

        date_match = date_pattern.search(line)

        if date_match:

            if current:
                current["duration"] = line

            continue

        # A new experience usually contains Intern / Developer / Engineer / etc.
        if (
            re.search(
                r"\b(intern|developer|engineer|designer|analyst|manager|"
                r"consultant|trainee|associate)\b",
                line,
                flags=re.IGNORECASE
            )
        ):

            current = {
                "role": line,
                "company": None,
                "duration": None,
                "description": []
            }

            experiences.append(current)

        else:

            if current:

                # Company can sometimes be part of the role line.
                if current["company"] is None:

                    if "," in current["role"]:
                        parts = current["role"].split(",", 1)

                        current["role"] = parts[0].strip()
                        current["company"] = parts[1].strip()

                current["description"].append(line)

    for item in experiences:

        item["description"] = " ".join(
            item["description"]
        ).strip()

    return experiences


# ============================================================
# PROJECT EXTRACTION
# ============================================================

def extract_projects(sections):
    """Extract project names and descriptions."""

    project_text = sections.get(
        "projects",
        ""
    )

    if not project_text:
        return []

    lines = [
        line.strip()
        for line in project_text.split("\n")
        if line.strip()
    ]

    projects = []

    current = None

    for line in lines:

        # Project titles often contain [GitHub]
        is_project_title = (
            "[github]" in line.lower()
            or line.lower().startswith("other projects:")
            or (
                current is None
                and len(line.split()) <= 10
            )
        )

        if is_project_title:

            if line.lower().startswith(
                "other projects:"
            ):

                other_projects = line.split(
                    ":",
                    1
                )[1]

                names = [
                    x.strip()
                    for x in other_projects.split(",")
                    if x.strip()
                ]

                for name in names:

                    projects.append({
                        "name": name,
                        "description": None
                    })

                current = None
                continue

            project_name = re.sub(
                r"\s*\[GitHub\]\s*",
                "",
                line,
                flags=re.IGNORECASE
            ).strip()

            current = {
                "name": project_name,
                "description": []
            }

            projects.append(current)

        else:

            if current:

                current["description"].append(
                    line
                )

    for project in projects:

        if isinstance(
            project["description"],
            list
        ):

            project["description"] = " ".join(
                project["description"]
            ).strip()

            if not project["description"]:
                project["description"] = None

    return projects


# ============================================================
# CERTIFICATIONS
# ============================================================

def extract_certifications(sections):
    """Extract certification information."""

    text = sections.get(
        "certifications",
        ""
    )

    if not text:

        text = sections.get(
            "certifications_and_activities",
            ""
        )

    if not text:
        return []

    # Split common separators
    parts = re.split(
        r"\s+[—–-]\s+|\n",
        text
    )

    certifications = []

    for part in parts:

        part = part.strip()

        if not part:
            continue

        lower = part.lower()

        if (
            "isro" in lower
            or "nptel" in lower
            or "codexintern" in lower
            or "certificate" in lower
        ):

            certifications.append(part)

    return certifications


# ============================================================
# ACHIEVEMENTS
# ============================================================

def extract_achievements(sections):
    """Extract achievements and awards."""

    text = sections.get(
        "achievements",
        ""
    )

    achievements = []

    if text:

        for line in text.split("\n"):

            line = line.strip()

            if line:
                achievements.append(line)

    # Also detect obvious awards from combined section
    combined = sections.get(
        "certifications_and_activities",
        ""
    )

    if combined:

        for part in re.split(
            r"\s+[—–-]\s+|\n",
            combined
        ):

            part = part.strip()

            if not part:
                continue

            lower = part.lower()

            if (
                "best sportsperson" in lower
                or "award" in lower
                or "hackathon" in lower
            ):

                achievements.append(part)

    return achievements


# ============================================================
# ACTIVITIES
# ============================================================

def extract_activities(sections):
    """Extract extracurricular activities."""

    text = sections.get(
        "activities",
        ""
    )

    activities = []

    if text:

        for line in text.split("\n"):

            line = line.strip()

            if line:
                activities.append(line)

    combined = sections.get(
        "certifications_and_activities",
        ""
    )

    if combined:

        for part in re.split(
            r"\s+[—–-]\s+|\n",
            combined
        ):

            part = part.strip()

            if not part:
                continue

            lower = part.lower()

            if (
                "football" in lower
                or "organizer" in lower
                or "organiser" in lower
                or "activity" in lower
            ):

                if part not in activities:
                    activities.append(part)

    return activities


# ============================================================
# MAIN ANALYSIS
# ============================================================

def analyze_resume(text: str):

    cleaned_text = clean_text(text)

    sections = detect_sections(
        cleaned_text
    )

    skills = extract_skills(
        cleaned_text
    )

    categorized_skills = categorize_skills(
        skills
    )

    education = extract_education(
        sections
    )

    experience = extract_experience(
        sections
    )

    projects = extract_projects(
        sections
    )

    certifications = extract_certifications(
        sections
    )

    achievements = extract_achievements(
        sections
    )

    activities = extract_activities(
        sections
    )

    analysis = {

        "name": extract_name(
            cleaned_text
        ),

        "email": extract_email(
            cleaned_text
        ),

        "phone": extract_phone(
            cleaned_text
        ),

        "links": extract_links(
            cleaned_text
        ),

        "skills": skills,

        "categorized_skills": categorized_skills,

        "education": education,

        "experience": experience,

        "projects": projects,

        "certifications": certifications,

        "achievements": achievements,

        "activities": activities,

        "sections": sections,

        "raw_text": cleaned_text
    }

    return analysis


# ============================================================
# API ENDPOINT
# ============================================================

@app.post("/analyze-resume")
async def analyze_resume_endpoint(
    file: UploadFile = File(...)
):

    if not file.filename:

        raise HTTPException(
            status_code=400,
            detail="No filename provided."
        )

    file_bytes = await file.read()

    if not file_bytes:

        raise HTTPException(
            status_code=400,
            detail="Uploaded file is empty."
        )

    text = extract_text(
        file.filename,
        file_bytes
    )

    if not text.strip():

        raise HTTPException(
            status_code=400,
            detail="Could not extract any text from the resume."
        )

    analysis = analyze_resume(
        text
    )

    return {

        "success": True,

        "message": "Resume analyzed successfully.",

        "analysis": analysis
    }


# ============================================================
# HEALTH CHECK
# ============================================================

@app.get("/")
def root():

    return {
        "message": "Resume Analyzer API is running!"
    }