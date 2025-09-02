// Enhanced parse-pdf.js with comprehensive debugging
import multer from "multer";
import PDFParser from 'pdf2json';

const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
        files: 1
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

export default async function handler(req, res) {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    if (req.method !== 'POST') {
        return res.status(405).json({ error: 'Method not allowed' });
    }

    try {
        const uploadMiddleware = upload.single('resume');
        
        await new Promise((resolve, reject) => {
            uploadMiddleware(req, res, (err) => {
                if (err) reject(err);
                else resolve();
            });
        });

        if (!req.file) {
            return res.status(400).json({ error: 'No file uploaded' });
        }

        if (req.file.mimetype !== 'application/pdf') {
            return res.status(400).json({ error: 'File must be a PDF' });
        }

        console.log(`🔍 PRODUCTION DEBUG: Parsing PDF file: ${req.file.originalname} (${req.file.size} bytes)`);
        console.log(`🔍 PRODUCTION DEBUG: Buffer length: ${req.file.buffer.length}`);
        console.log(`🔍 PRODUCTION DEBUG: First 100 bytes: ${req.file.buffer.slice(0, 100).toString('hex')}`);
        
        const pdfParser = new PDFParser();
        
        const parsePDF = () => {
            return new Promise((resolve, reject) => {
                let hasResolved = false;
                
                const parseTimeout = setTimeout(() => {
                    if (!hasResolved) {
                        hasResolved = true;
                        console.log('❌ PRODUCTION DEBUG: PDF parsing timeout');
                        reject(new Error('PDF parsing timeout'));
                    }
                }, 45000);
                
                pdfParser.on('pdfParser_dataReady', (pdfData) => {
                    if (hasResolved) return;
                    hasResolved = true;
                    clearTimeout(parseTimeout);
                    
                    try {
                        console.log(`🔍 PRODUCTION DEBUG: PDF parsed successfully`);
                        console.log(`🔍 PRODUCTION DEBUG: Pages found: ${pdfData.Pages ? pdfData.Pages.length : 0}`);
                        
                        if (!pdfData.Pages || pdfData.Pages.length === 0) {
                            console.log('❌ PRODUCTION DEBUG: No pages found in PDF');
                            throw new Error('PDF appears to be empty or corrupted');
                        }
                        
                        let fullText = '';
                        let totalTextLength = 0;
                        let extractedChunks = [];
                        
                        pdfData.Pages.forEach((page, pageIndex) => {
                            console.log(`🔍 PRODUCTION DEBUG: Processing page ${pageIndex + 1}`);
                            console.log(`🔍 PRODUCTION DEBUG: Page texts count: ${page.Texts ? page.Texts.length : 0}`);
                            
                            if (!page.Texts) {
                                console.log(`⚠️ PRODUCTION DEBUG: No texts found on page ${pageIndex + 1}`);
                                return;
                            }
                            
                            page.Texts.forEach((text, textIndex) => {
                                try {
                                    if (text.R && text.R[0] && text.R[0].T) {
                                        let decodedText = text.R[0].T;
                                        console.log(`🔍 PRODUCTION DEBUG: Raw text ${textIndex}: "${decodedText.substring(0, 50)}..."`);
                                        
                                        try {
                                            decodedText = decodeURIComponent(decodedText);
                                        } catch (decodeError) {
                                            console.warn(`⚠️ PRODUCTION DEBUG: Decode failed for text: "${decodedText}", using raw`);
                                        }
                                        
                                        decodedText = decodedText
                                            .replace(/\s+/g, ' ')
                                            .replace(/\n+/g, ' ')
                                            .trim();
                                        
                                        if (decodedText.length > 0) {
                                            fullText += decodedText + ' ';
                                            totalTextLength += decodedText.length;
                                            extractedChunks.push(decodedText);
                                        }
                                    }
                                } catch (textError) {
                                    console.warn(`⚠️ PRODUCTION DEBUG: Error processing text on page ${pageIndex + 1}:`, textError.message);
                                }
                            });
                            fullText += '\n';
                        });
                        
                        console.log(`🔍 PRODUCTION DEBUG: Total text extracted: ${totalTextLength} characters`);
                        console.log(`🔍 PRODUCTION DEBUG: Text chunks extracted: ${extractedChunks.length}`);
                        console.log(`🔍 PRODUCTION DEBUG: First 200 chars: "${fullText.substring(0, 200)}"`);
                        console.log(`🔍 PRODUCTION DEBUG: Last 200 chars: "${fullText.substring(Math.max(0, fullText.length - 200))}"`);
                        
                        if (totalTextLength < 50) {
                            console.log(`❌ PRODUCTION DEBUG: Very little text extracted (${totalTextLength} chars)`);
                            throw new Error('PDF contains very little extractable text. Please ensure your PDF contains readable text (not just images).');
                        }
                        
                        const cleanedText = fullText
                            .replace(/\s+/g, ' ')
                            .replace(/\n\s*\n/g, '\n')
                            .trim();
                        
                        console.log(`✅ PRODUCTION DEBUG: Final cleaned text: ${cleanedText.length} characters`);
                        resolve(cleanedText);
                        
                    } catch (extractError) {
                        console.log(`❌ PRODUCTION DEBUG: Text extraction failed: ${extractError.message}`);
                        reject(new Error(`PDF text extraction failed: ${extractError.message}`));
                    }
                });
                
                pdfParser.on('pdfParser_dataError', (error) => {
                    if (hasResolved) return;
                    hasResolved = true;
                    clearTimeout(parseTimeout);
                    console.log(`❌ PRODUCTION DEBUG: PDF parser error: ${error.parserError || error.message}`);
                    reject(new Error(`PDF parsing error: ${error.parserError || error.message || 'Unknown PDF error'}`));
                });
                
                try {
                    console.log(`🔍 PRODUCTION DEBUG: Starting PDF buffer parsing...`);
                    pdfParser.parseBuffer(req.file.buffer);
                } catch (parseError) {
                    if (!hasResolved) {
                        hasResolved = true;
                        clearTimeout(parseTimeout);
                        console.log(`❌ PRODUCTION DEBUG: Failed to start parsing: ${parseError.message}`);
                        reject(new Error(`Failed to start PDF parsing: ${parseError.message}`));
                    }
                }
            });
        };
        
        const fullText = await parsePDF();
        
        // Return both the text and debug info
        res.json({ 
            text: fullText,
            debugInfo: {
                originalSize: req.file.size,
                extractedLength: fullText.length,
                fileName: req.file.originalname,
                timestamp: new Date().toISOString()
            }
        });
        
    } catch (error) {
        console.error('❌ PRODUCTION DEBUG: PDF parsing error:', error.message);
        console.error('❌ PRODUCTION DEBUG: Full error:', error);
        
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