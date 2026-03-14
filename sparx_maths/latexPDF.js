const fs = require("fs");
const path = require("path");
const { execSync } = require("child_process");
const curlRequesticator = require('../utils/curlRequesticator');

class Image_Requesticator extends curlRequesticator {
  constructor() {
    super();
    this.additionalHeaders =[];
    
    // Removed specific GRPC headers as image CDNs will often reject GET requests containing them
    this.headers =[
        'accept: image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8',
        'accept-language: en-GB,en;q=0.9,en-US;q=0.8',
        'origin: https://maths.sparx-learning.com/',
        'priority: u=1, i',
        'referer: https://maths.sparx-learning.com/',
        'sec-ch-ua: "Not(A:Brand";v="8", "Chromium";v="144", "Microsoft Edge";v="144"',
        'sec-ch-ua-mobile: ?0',
        'sec-ch-ua-platform: "Windows"',
        'sec-fetch-dest: empty',
        'sec-fetch-mode: cors',
        'sec-fetch-site: same-site',
        'user-agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36 Edg/144.0.0.0'
    ];
  }

    async sendRequest(url, data) {
        const headers =[
            ...this.headers,
            ...this.additionalHeaders
        ];

        // Fix: Prevent Node crash when 'data' is undefined during a GET request
        let body = undefined;
        if (data !== undefined && data !== null) {
            body = Buffer.isBuffer(data) ? data : Buffer.from(data);
        }

        return this._executeCurl(
            url,
            headers,
            body,
            { responseType: 'arraybuffer', returnHeaders: true }
        );
    }
}

const ImageReq = new Image_Requesticator();

// Configuration
const uuidRegex = /\b[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\b/i;
const imgDir = path.join(__dirname, "images");

// Ensure image directory exists
if (!fs.existsSync(imgDir)) {
    fs.mkdirSync(imgDir, { recursive: true });
}

// Helper: Fix Windows paths for LaTeX
function toPosixPath(p) {
    return p.split(path.sep).join('/');
}

// Helper: Download Image
async function downloadImage(url, filename) {
    try {
        const res = await ImageReq.sendRequest(url);
        
        // Catch HTTP error status codes if nested in a curl wrapper object
        if (res && (res.statusCode >= 400 || res.status >= 400)) {
            throw new Error(`HTTP Error: ${res.statusCode || res.status}`);
        }

        // Grab the payload explicitly from `.data`
        const rawData = res.data !== undefined ? res.data : res;

        if (!rawData) {
            throw new Error("No data returned from request");
        }

        // Ensure it is safely converted to a Buffer
        const buffer = Buffer.isBuffer(rawData) ? rawData : Buffer.from(rawData);

        if (buffer.length === 0) throw new Error("Empty image buffer returned");

        fs.writeFileSync(filename, buffer);
        return true;
    } catch (e) {
        // Fallback: If the wrapper refuses to handle the CDN properly, try a native Node.js fetch
        try {
            const fetchRes = await fetch(url, {
                headers: {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/144.0.0.0 Safari/537.36",
                    "Referer": "https://maths.sparx-learning.com/"
                }
            });
            
            if (!fetchRes.ok) throw new Error(`Fetch Status ${fetchRes.status}`);
            
            const arrayBuf = await fetchRes.arrayBuffer();
            fs.writeFileSync(filename, Buffer.from(arrayBuf));
            
            return true;
        } catch (fetchErr) {
            console.warn(`Failed to download ${url}: ${fetchErr.message}`);
            return false;
        }
    }
}

// Helper: Core logic to take a UUID, ensure it exists locally, and return LaTeX string
async function getLatexForUUID(uuid) {
    if (!uuid) return "";

    const url = `https://cdn.sparx-learning.com/${uuid}`;
    const ext = ".png";
    const localFilename = `${uuid}${ext}`;
    const localPath = path.join(imgDir, localFilename);

    // Check if we already have it to avoid re-downloading
    if (!fs.existsSync(localPath)) {
        await downloadImage(url, localPath);
    }

    if (fs.existsSync(localPath)) {
        const latexPath = toPosixPath(path.join("images", localFilename));
        // Force a new line and center the image
        return String.raw`\newline \begin{center}\includegraphics[width=0.4\textwidth]{${latexPath}}\end{center}`;
    } else {
        return ` [Image Missing] `;
    }
}

// Helper: Process text to find UUIDs and replace with LaTeX image tags
async function processStringWithImages(text) {
    if (!text) return "";
    let processedText = String(text);

    const matches = processedText.match(new RegExp(uuidRegex, 'g')) || [];
    const uniqueMatches = [...new Set(matches)]; // Deduplicate requests

    for (const uuid of uniqueMatches) {
        const latexImage = await getLatexForUUID(uuid);
        // Fix: Use split().join() over replace() so that if a question repeats an image multiple times, ALL occurrences are replaced
        processedText = processedText.split(uuid).join(latexImage);
    }
    return processedText;
}

// Helper: Sanitize text for LaTeX
function latexSafe(str) {
    if (!str) return "";

    let clean = String(str)
        .replace(/'/g, "'")
        .replace(/>/g, ">")
        .replace(/</g, "<")
        .replace(/\\gt/g, ">") 
        .replace(/\\lt/g, "<") 
        .replace(/≤/g, "\\le ")
        .replace(/≥/g, "\\ge ")
        .replace(/£/g, "\\pounds ");

    // Standardize Degrees
    clean = clean.replace(/\\degrees/g, "\\degree");

    // Escape LaTeX reserved chars that trigger errors in text mode
    clean = clean.replace(/%/g, "\\%");
    clean = clean.replace(/#/g, "\\#");

    return clean.trim();
}

// Helper: Format Working Out block
function formatWorkingOut(text) {
    if (!text) return "";
    let clean = latexSafe(text);

    let lines = clean.split(';').map(l => l.trim()).filter(l => l !== "");
    let output = "";

    for (let line of lines) {
        const hasMathSignal = /[=+\\]/.test(line); 
        const isImage = line.includes('includegraphics');
        const isWrapped = line.includes('$') || line.startsWith('\\[');
        const isProse = /[a-zA-Z]{4,}\s[a-zA-Z]{4,}/.test(line.replace(/\\[a-z]+/g, ''));

        if (isImage) {
            output += `${line} \\\\ \n`;
        } else if (isWrapped) {
            output += `${line} \\\\ \n`;
        } else if (hasMathSignal && !isProse) {
            // Wrap in math display mode
            output += `\\[ ${line} \\] \n`;
        } else {
            output += `${line} \\\\ \n`;
        }
    }

    return output;
}

// Helper: Format Answer block
function formatAnswer(text) {
    if (!text) return "";
    let safe = latexSafe(text);
    // Replace semicolons with commas for cleaner reading
    safe = safe.replace(/;/g, ", \\quad ");
    // Bold specific item labels like "a)"
    safe = safe.replace(/(\s|^)([a-z]|\d)\)/gi, '$1\\textbf{$2)}');
    return safe;
}

// Helper: Format Question Block (Text Lines + Image Objects)
async function formatQuestionData(questionData) {
    let output = "";

    // 1. Process Text Lines
    if (questionData.questionText && Array.isArray(questionData.questionText)) {
        const processedLines =[];
        for (const line of questionData.questionText) {
            const withImages = await processStringWithImages(String(line));
            processedLines.push(latexSafe(withImages));
        }
        output += processedLines.join(" \\newline \n");
    }

    // 2. Process Explicit Image Array
    if (questionData.images && Array.isArray(questionData.images)) {
        for (const imgObj of questionData.images) {
            if (imgObj && imgObj.url) {
                const imgLatex = await getLatexForUUID(imgObj.url);
                output += `\n${imgLatex}`;
            }
        }
    }

    return output;
}

// Main: Generate LaTeX string
function generateLatex(packageID, items) {
    const content = items.map(item => {
        const safeAns = formatAnswer(item.answer);
        const safeWork = formatWorkingOut(item.working);
        const safeQuest = item.question;

        // Using String.raw prevents JS from destroying LaTeX commands like \noindent
        return String.raw`\noindent \textbf{${item.id}}
\begin{itemize}[leftmargin=*, noitemsep, topsep=0pt]
${safeQuest ? String.raw`\item \textbf{Question:} ${safeQuest}` : ''}
\item \textbf{Answer:} ${safeAns}
${safeWork ? String.raw`\item \textbf{Working Out:} \newline ${safeWork}` : ''}
\end{itemize} \vspace{0.5em} \hrule \vspace{0.5em}`;
    }).join("\n");

    return String.raw`\documentclass[12pt]{article}
\usepackage{amsmath, amssymb}
\usepackage{geometry}
\usepackage{graphicx}
\usepackage{textcomp}
\usepackage{enumitem}
\usepackage{float}
\geometry{margin=0.5in}
\usepackage{lmodern}
\usepackage[T1]{fontenc}

% --- Custom Commands for Robustness ---
\newcommand{\degree}{\ensuremath{^\circ}}
\newcommand{\lt}{<}
\newcommand{\gt}{>}
% --------------------------------------

\setlength{\parindent}{0pt}
\setlength{\parskip}{0em}

\begin{document}
\section*{Sparx Maths Answers}

${content}

\end{document}
`;
}

// Main: Entry Point
async function convertToPDF(obj, packageID, showWorkingOut = false, showQuestion = false) {
    const items =[];

    // Parse Object
    for (const [key, valueOriginal] of Object.entries(obj)) {
        try {
            let rawAnswer = "";
            let rawWorking = "";
            let rawQuestionData = {}; 

            if (typeof valueOriginal === "object" && valueOriginal !== null) {
                rawAnswer = valueOriginal.answer ? String(valueOriginal.answer) : "";
                
                if (showWorkingOut) {
                    rawWorking = valueOriginal.working_out ? String(valueOriginal.working_out) : "";
                }

                if (showQuestion && valueOriginal.question) {
                    rawQuestionData = valueOriginal.question;
                }

            } else {
                rawAnswer = String(valueOriginal);
            }

            const processedAnswer = await processStringWithImages(rawAnswer);
            const processedWorking = showWorkingOut ? await processStringWithImages(rawWorking) : "";
            const processedQuestion = showQuestion ? await formatQuestionData(rawQuestionData) : "";

            items.push({
                id: key,
                answer: processedAnswer,
                working: processedWorking,
                question: processedQuestion 
            });
        } catch (e) {
            console.error(`Skipping item ${key} due to error:`, e.message);
        }
    }

    // Write .tex file
    const latexContent = generateLatex(packageID, items);
    const texFile = path.join(__dirname, `${packageID}.tex`);
    fs.writeFileSync(texFile, latexContent);

    console.log(`Compiling PDF for ${packageID} (Working: ${showWorkingOut}, Question: ${showQuestion})...`);

    // Compile
    try {
        execSync(
            `xelatex -interaction=nonstopmode "${texFile}"`,
            { cwd: __dirname, stdio: 'ignore', maxBuffer: 1024 * 1024 * 20 }
        );
    } catch {
        // Ignore LaTeX warnings/errors, check file existence instead
    }

    const pdfPath = path.join(__dirname, `${packageID}.pdf`);

    // Cleanup
    cleanup(packageID);

    if (fs.existsSync(pdfPath)) {
        console.log(`Success! PDF generated at: ${pdfPath}`);
        return pdfPath;
    } else {
        console.error("Critical Error: PDF was not created. Review input data.");
        return null;
    }
}

// Cleanup Function
function cleanup(packageID) {
    // 1. Delete aux files
    const auxFiles =[
        path.join(__dirname, `${packageID}.tex`),
        path.join(__dirname, `${packageID}.aux`),
        path.join(__dirname, `${packageID}.log`),
        path.join(__dirname, `${packageID}.out`)
    ];

    for (const f of auxFiles) {
        if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch {}
    }

    if (fs.existsSync(imgDir)) {
        const files = fs.readdirSync(imgDir);
        for (const file of files) {
            if (file !== '.gitkeep') {
                try { fs.unlinkSync(path.join(imgDir, file)); } catch {}
            }
        }
    }
}

module.exports = { convertToPDF };