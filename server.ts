import 'dotenv/config';
import express, { Request, Response } from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI, Type } from '@google/genai';
import mammoth from 'mammoth';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const BASE_PATH: string = '/my-sec-increase.ai/';

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ limit: '50mb', extended: true }));

// Health Check API
const handleHealth = (_req: Request, res: Response) => {
  res.json({
    status: 'ok',
    hasGeminiKey: Boolean(process.env.GEMINI_API_KEY),
    nodeEnv: process.env.NODE_ENV || 'development',
  });
};
app.get('/api/health', handleHealth);
app.get(`${BASE_PATH}api/health`, handleHealth);

// AI Amended Articles of Incorporation Generator API
interface GenerateAoiPayload {
  file?: {
    name: string;
    mimeType: string;
    base64: string; // clean base64 string or data URI
  };
  pastedText?: string;
  formData: {
    corpName: string;
    formerCorpName?: string;
    principalAddress?: string;
    parValue: number;
    oldShares: number;
    newShares: number;
    shMeetingDate?: string;
    bodMeetingDate?: string;
    meetingFormat?: string;
    amendedArticle?: string;
    directors?: Array<{ name: string; tin?: string }>;
    subscribers?: Array<{
      name: string;
      sharesSubscribed: number;
      amountPaid: number;
      modeOfPayment: string;
    }>;
  };
  additionalInstructions?: string;
}

const handleGenerateAmendedAoi = async (req: Request, res: Response) => {
  try {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return res.status(500).json({
        error: 'Missing GEMINI_API_KEY on the server. Please attach an API key in AI Studio Secrets.',
      });
    }

    const { file, pastedText, formData, additionalInstructions } = req.body as GenerateAoiPayload;

    if (!file && !pastedText?.trim()) {
      return res.status(400).json({
        error: 'Please upload an Articles of Incorporation document (PDF, Word DOCX, Image, or Text) or paste its text.',
      });
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const par = Number(formData.parValue) || 100;
    const oldShares = Number(formData.oldShares) || 0;
    const newShares = Number(formData.newShares) || 0;
    const oldAcs = oldShares * par;
    const newAcs = newShares * par;
    const increase = Math.max(0, newAcs - oldAcs);

    let totalSubShares = 0;
    let totalSubAmt = 0;
    let totalPaidAmt = 0;
    if (Array.isArray(formData.subscribers)) {
      formData.subscribers.forEach((s) => {
        const qty = Number(s.sharesSubscribed) || 0;
        totalSubShares += qty;
        totalSubAmt += qty * par;
        totalPaidAmt += Number(s.amountPaid) || 0;
      });
    }

    const fmtNum = (n: number) =>
      n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    const fmtShares = (n: number) => n.toLocaleString('en-US');

    const promptText = `
You are an elite Philippine Corporate Lawyer and SEC Documentation Specialist.
Your task is to review the provided original / current Articles of Incorporation (AOI) of a Philippine corporation, and generate a complete, authentic, and legally sound AMENDED ARTICLES OF INCORPORATION reflecting the approved Increase in Authorized Capital Stock.

CURRENT APPROVED CAPITAL INCREASE DETAILS:
- Present Corporate Name: ${formData.corpName}
${formData.formerCorpName ? `- Former Corporate Name: ${formData.formerCorpName}` : ''}
- Principal Office Address: ${formData.principalAddress || 'As stated in the AOI'}
- Previous Authorized Capital Stock: Php ${fmtNum(oldAcs)} divided into ${fmtShares(oldShares)} shares with a par value of Php ${fmtNum(par)} per share
- NEW Authorized Capital Stock: Php ${fmtNum(newAcs)} divided into ${fmtShares(newShares)} shares with a par value of Php ${fmtNum(par)} per share
- Increase in Capital Stock: Php ${fmtNum(increase)}
- Total Subscribed to Increase: ${fmtShares(totalSubShares)} shares amounting to Php ${fmtNum(totalSubAmt)}
- Total Paid-up on Increase: Php ${fmtNum(totalPaidAmt)}
- Stockholders Meeting Approval Date: ${formData.shMeetingDate || 'Recent Meeting'}
- Board of Directors Meeting Approval Date: ${formData.bodMeetingDate || 'Recent Meeting'}
- Meeting Format: ${formData.meetingFormat || 'at the principal office'}
- Target Amended Article: ${formData.amendedArticle || 'Article SEVENTH - Authorized Capital Stock'}
${additionalInstructions ? `- User Instructions: ${additionalInstructions}` : ''}

CRITICAL LEGAL & PHILIPPINE SEC DRAFTING RULES:
1. TITLE & PREAMBLE:
   Begin with the official title:
   "AMENDED ARTICLES OF INCORPORATION
   OF
   [NAME OF CORPORATION]"
   Followed by the traditional opening preamble ("KNOW ALL MEN BY THESE PRESENTS: ... That we, all of legal age, majority of whom are residents of the Philippines, have this day voluntarily agreed to form a stock corporation under the laws of the Republic of the Philippines...").

2. PRESERVE ORIGINAL STRUCTURE & ARTICLES:
   Carefully preserve all articles from the uploaded document:
   - FIRST: Corporate Name (if name was amended, note "(As amended on...)")
   - SECOND: Primary and Secondary Purposes
   - THIRD: Principal Office Address
   - FOURTH: Term of Existence (perpetual under the Revised Corporation Code of the Philippines, R.A. 11232)
   - FIFTH: Names, nationalities, and residences of incorporators
   - SIXTH: Number of directors, their names, nationalities, and residences
   - SEVENTH (or applicable number): THE AMENDED AUTHORIZED CAPITAL STOCK ARTICLE
   - Subsequent articles (subscribers, treasurer's designation, arbitration/restrictions if any).

3. AMENDING THE CAPITAL STOCK ARTICLE (ARTICLE SEVENTH):
   Rewrite Article SEVENTH (or whichever article specifies the capital stock in the source document) to state the NEW Authorized Capital Stock clearly in both words and figures:
   Example standard SEC wording:
   "SEVENTH: That the authorized capital stock of the Corporation is [NEW CAPITAL IN WORDS] (Php [NEW CAPITAL IN FIGURES]), divided into [NUMBER OF SHARES IN WORDS] ([NUMBER OF SHARES IN FIGURES]) Common Shares with a par value of [PAR VALUE IN WORDS] (Php [PAR VALUE IN FIGURES]) per share."
   
   Directly beneath the amended capital stock provision, you MUST append the mandatory Philippine SEC amendment recital:
   "(As amended by the majority vote of the Board of Directors at the meeting held on ${formData.bodMeetingDate || '[Date]'} and by the affirmative vote of stockholders representing at least two-thirds (2/3) of the outstanding capital stock at a meeting held on ${formData.shMeetingDate || '[Date]'})."

4. SUBSCRIBERS & CAPITALIZATION SECTION:
   If the Seventh or Eighth Article in the source document lists the subscription and paid-up capital of the incorporators, retain the original subscription table and state the subscriptions to the increase of authorized capital stock in accordance with SEC requirements.

5. SIGNATURE & NOTARIAL ACKNOWLEDGMENT:
   Include the formal closing "IN WITNESS WHEREOF" clause, Director signature lines, and the complete Philippine Notarial Jurat / Acknowledgment with Competent Evidence of Identity.

6. FORMATTING:
   Provide clean, professional legal markdown formatting with clear headings, capitalized article titles (e.g. "ARTICLE FIRST", "ARTICLE SECOND", "ARTICLE SEVENTH"), and standard legal indentation.
`;

    // Prepare contents array for Gemini
    const contentsParts: Array<
      | string
      | { inlineData: { mimeType: string; data: string } }
      | { text: string }
    > = [];

    // Add source file or text
    if (file && file.base64) {
      let rawBase64 = file.base64;
      if (rawBase64.includes('base64,')) {
        rawBase64 = rawBase64.split('base64,')[1];
      }

      const mime = (file.mimeType || '').toLowerCase();
      const ext = path.extname(file.name || '').toLowerCase();

      if (
        mime.includes('wordprocessingml') ||
        ext === '.docx' ||
        mime.includes('msword') ||
        ext === '.doc'
      ) {
        // Parse docx using mammoth
        try {
          const buffer = Buffer.from(rawBase64, 'base64');
          const mammothResult = await mammoth.extractRawText({ buffer });
          const extractedText = mammothResult.value;
          contentsParts.push({
            text: `[Source Document File: ${file.name} (Extracted Text)]:\n\n${extractedText}`,
          });
        } catch (docxErr) {
          console.warn('Failed to parse docx via mammoth, falling back to text extraction:', docxErr);
          const buffer = Buffer.from(rawBase64, 'base64');
          contentsParts.push({
            text: `[Source Document File: ${file.name}]:\n\n${buffer.toString('utf-8')}`,
          });
        }
      } else if (mime.includes('text') || ext === '.txt') {
        const buffer = Buffer.from(rawBase64, 'base64');
        contentsParts.push({
          text: `[Source Document Text (${file.name})]:\n\n${buffer.toString('utf-8')}`,
        });
      } else if (
        mime.includes('pdf') ||
        ext === '.pdf' ||
        mime.startsWith('image/')
      ) {
        const supportedMime = mime.includes('pdf')
          ? 'application/pdf'
          : mime || 'image/png';
        contentsParts.push({
          inlineData: {
            mimeType: supportedMime,
            data: rawBase64,
          },
        });
      } else {
        // Fallback: send as text or binary
        const buffer = Buffer.from(rawBase64, 'base64');
        contentsParts.push({
          text: `[Source Document Content (${file.name})]:\n\n${buffer.toString('utf-8')}`,
        });
      }
    }

    if (pastedText?.trim()) {
      contentsParts.push({
        text: `[Pasted Original Articles of Incorporation Text]:\n\n${pastedText.trim()}`,
      });
    }

    contentsParts.push({ text: promptText });

    const response = await ai.models.generateContent({
      model: 'gemini-3.8-flash',
      contents: contentsParts,
      config: {
        systemInstruction:
          'You are an authoritative Philippine corporate lawyer and SEC compliance drafting expert. Generate fully formed, legally complete Amended Articles of Incorporation based strictly on the uploaded document and the authorized capital increase details. Return your response strictly as JSON matching the requested schema.',
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            title: {
              type: Type.STRING,
              description: 'Official document title, e.g. AMENDED ARTICLES OF INCORPORATION OF ...',
            },
            corpName: {
              type: Type.STRING,
              description: 'The corporation name',
            },
            amendedArticleName: {
              type: Type.STRING,
              description: 'The name or number of the amended article, e.g. SEVENTH',
            },
            amendedArticleText: {
              type: Type.STRING,
              description:
                'The exact amended article provision text (e.g. SEVENTH: That the authorized capital stock of the corporation is...)',
            },
            summaryOfChanges: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
              description: 'Key summary bullet points of changes made in the Amended Articles',
            },
            fullText: {
              type: Type.STRING,
              description:
                'The complete, beautifully drafted legal text of the entire Amended Articles of Incorporation from Title to Notarial Acknowledgment',
            },
          },
          required: ['title', 'corpName', 'amendedArticleName', 'summaryOfChanges', 'fullText'],
        },
      },
    });

    let responseText = (response.text || '{}').trim();
    if (responseText.startsWith('```json')) {
      responseText = responseText.replace(/^```json\s*/i, '').replace(/\s*```$/i, '').trim();
    } else if (responseText.startsWith('```')) {
      responseText = responseText.replace(/^```\s*/i, '').replace(/\s*```$/i, '').trim();
    }

    let parsedData: any;
    try {
      parsedData = JSON.parse(responseText);
    } catch {
      parsedData = {
        title: `AMENDED ARTICLES OF INCORPORATION OF ${formData.corpName.toUpperCase()}`,
        corpName: formData.corpName,
        amendedArticleName: formData.amendedArticle || 'SEVENTH',
        amendedArticleText: `SEVENTH: That the authorized capital stock of the Corporation is Php ${fmtNum(
          newAcs,
        )}, divided into ${fmtShares(newShares)} shares of Common Stock with par value of Php ${fmtNum(
          par,
        )} per share.`,
        summaryOfChanges: [
          `Increased Authorized Capital Stock to Php ${fmtNum(newAcs)}`,
          `Updated authorized common shares to ${fmtShares(newShares)} at Php ${fmtNum(par)} par value`,
          `Added required SEC Board of Directors and Stockholders approval annotations`,
        ],
        fullText: responseText,
      };
    }

    if (parsedData && typeof parsedData === 'object') {
      if (typeof parsedData.amendedArticleName !== 'string' || !parsedData.amendedArticleName) {
        parsedData.amendedArticleName = formData.amendedArticle || 'SEVENTH';
      }
      if (typeof parsedData.title !== 'string') {
        parsedData.title = `AMENDED ARTICLES OF INCORPORATION OF ${formData.corpName.toUpperCase()}`;
      }
      if (typeof parsedData.corpName !== 'string') {
        parsedData.corpName = formData.corpName;
      }
      if (!Array.isArray(parsedData.summaryOfChanges)) {
        parsedData.summaryOfChanges = [
          `Increased Authorized Capital Stock to Php ${fmtNum(newAcs)}`,
        ];
      }
      if (typeof parsedData.fullText !== 'string') {
        parsedData.fullText = responseText;
      }
    }

    res.json({
      success: true,
      result: {
        ...parsedData,
        generatedAt: new Date().toISOString(),
      },
    });
  } catch (error: unknown) {
    console.error('Error generating Amended Articles of Incorporation:', error);
    const errMessage = error instanceof Error ? error.message : 'Unknown server error';
    res.status(500).json({
      error: `Failed to generate Amended Articles of Incorporation: ${errMessage}`,
    });
  }
};

app.post('/api/generate-amended-aoi', handleGenerateAmendedAoi);
app.post(`${BASE_PATH}api/generate-amended-aoi`, handleGenerateAmendedAoi);

// Redirect root to base path if base path is configured
app.get('/', (req, res, next) => {
  if (BASE_PATH && BASE_PATH !== '/') {
    return res.redirect(BASE_PATH);
  }
  next();
});

// Setup Vite or Static File Serving
async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    app.use(BASE_PATH, express.static(path.resolve(__dirname, 'dist')));
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  } else {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`SEC Capital Increase Server running at http://0.0.0.0:${PORT}${BASE_PATH}`);
  });
}

startServer();
