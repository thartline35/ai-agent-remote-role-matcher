// api/parse-pdf.js
import multer from "multer";
import PDFParser from 'pdf2json';

// Configure multer for file uploads
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024, // 5MB limit
        files: 1 // Only allow 1 file
    },
    fileFilter: (req, file, cb) => {
        const allowedMimeTypes = [
            'application/pdf',
            'text/plain',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        if (allowedMimeTypes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Please upload PDF, TXT, DOC, or DOCX files only.'));
        }
    }
});

// Vercel serverless function handler
export default async function handler(req, res) {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Handle preflight requests
    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    // Only allow POST requests
    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        // Use multer to handle file upload
        const uploadMiddleware = upload.single('resume');
        
        await new Promise((resolve, reject) => {
            uploadMiddleware(req, res, (err) => {
                if (err) {
                    reject(err);
                } else {
                    resolve();
                }
            });
        });

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        if (req.file.mimetype !== 'application/pdf') {
            return res.status(400).json({ error: 'File must be a PDF' });
        }

        console.log(`Parsing PDF file: ${req.file.originalname} (${req.file.size} bytes)`);
        
        // Enhanced PDF parsing with better error handling
        const pdfParser = new PDFParser();
        
        const parsePDF = () => {
            return new Promise((resolve, reject) => {
                let hasResolved = false;
                
                // Set timeout for PDF parsing
                const parseTimeout = setTimeout(() => {
                    if (!hasResolved) {
                        hasResolved = true;
                        reject(new Error('PDF parsing timeout'));
                    }
                }, 45000); // 45 second timeout for PDF parsing
                
                pdfParser.on('pdfParser_dataReady', (pdfData) => {
                    if (hasResolved) return;
                    hasResolved = true;
                    clearTimeout(parseTimeout);
                    
                    try {
                        let fullText = '';
                        let totalTextLength = 0;
                        
                        if (!pdfData.Pages || pdfData.Pages.length === 0) {
                            throw new Error('PDF appears to be empty or corrupted');
                        }
                        
                        // Extract text from all pages with better handling
                        pdfData.Pages.forEach((page, pageIndex) => {
                            if (!page.Texts) return;
                            
                            page.Texts.forEach(text => {
                                try {
                                    if (text.R && text.R[0] && text.R[0].T) {
                                        const decodedText = decodeURIComponent(text.R[0].T);
                                        fullText += decodedText + ' ';
                                        totalTextLength += decodedText.length;
                                    }
                                } catch (decodeError) {
                                    // Skip problematic text but continue processing
                                    console.warn(`Warning: Could not decode text on page ${pageIndex + 1}`);
                                }
                            });
                            fullText += '\n';
                        });
                        
                        if (totalTextLength < 50) {
                            throw new Error('PDF contains very little extractable text. Please ensure your PDF contains readable text (not just images).');
                        }
                        
                        console.log(`PDF parsed successfully: ${pdfData.Pages.length} pages, ${totalTextLength} characters extracted`);
                        resolve(fullText);
                        
                    } catch (extractError) {
                        reject(new Error(`PDF text extraction failed: ${extractError.message}`));
                    }
                });
                
                pdfParser.on('pdfParser_dataError', (error) => {
                    if (hasResolved) return;
                    hasResolved = true;
                    clearTimeout(parseTimeout);
                    reject(new Error(`PDF parsing error: ${error.parserError || error.message || 'Unknown PDF error'}`));
                });
                
                // Parse the PDF buffer
                try {
                    pdfParser.parseBuffer(req.file.buffer);
                } catch (parseError) {
                    if (!hasResolved) {
                        hasResolved = true;
                        clearTimeout(parseTimeout);
                        reject(new Error(`Failed to start PDF parsing: ${parseError.message}`));
                    }
                }
            });
        };
        
        const fullText = await parsePDF();
        res.json({ text: fullText });
        
    } catch (error) {
        console.error('PDF parsing error:', error);
        
        let userMessage = 'Failed to parse PDF. ';
        if (error.message.includes('timeout')) {
            userMessage += 'The PDF is taking too long to process. Please try a smaller or simpler PDF.';
        } else if (error.message.includes('empty') || error.message.includes('little extractable text')) {
            userMessage += 'The PDF appears to contain mostly images or no readable text. Please use a PDF with text content.';
        } else if (error.message.includes('corrupted')) {
            userMessage += 'The PDF file appears to be corrupted. Please try re-saving or re-creating the PDF.';
        } else {
            userMessage += 'Please ensure the file is a valid PDF with readable text content.';
        }
        
        res.status(500).json({ error: userMessage });
    }
} 