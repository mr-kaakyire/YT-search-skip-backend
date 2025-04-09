import express from 'express';
import cors from 'cors';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { YoutubeTranscript } from 'youtube-transcript';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Gemini AI with environment variable
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Configure CORS
app.use(cors({
  origin: process.env.NODE_ENV === 'production' 
    ? ['chrome-extension://macaocobdbbeebfpdgiippbpamfnlhee'] 
    : '*',
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type'],
  credentials: true
}));

app.use(express.json());

// Function to get video ID from URL
const getVideoId = (url) => {
  try {
    const urlObj = new URL(url);
    return urlObj.searchParams.get('v');
  } catch (error) {
    console.error('Error parsing URL:', error);
    return null;
  }
};

// Function to extract JSON from Gemini's response
const extractJSON = (text) => {
  try {
    // Clean up the text to handle potential formatting issues
    let cleanText = text.trim();
    
    // If the text starts with a backtick or code block marker, remove it
    cleanText = cleanText.replace(/^```json\s*/, '');
    cleanText = cleanText.replace(/^```\s*/, '');
    cleanText = cleanText.replace(/\s*```$/, '');
    
    // Try to find JSON-like structure in the text
    const jsonMatch = cleanText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.warn('No JSON structure found in response');
      return { adSegments: [] };
    }

    let jsonStr = jsonMatch[0];
    
    // Clean up timestamp values by removing 'ms' suffix
    jsonStr = jsonStr.replace(/"start":\s*(\d+\.?\d*)ms/g, '"start": $1');
    jsonStr = jsonStr.replace(/"end":\s*(\d+\.?\d*)ms/g, '"end": $1');
    
    // Clean up HTML entities in text
    jsonStr = jsonStr.replace(/&amp;#39;/g, "'");
    jsonStr = jsonStr.replace(/&amp;quot;/g, '"');
    jsonStr = jsonStr.replace(/&amp;/g, '&');
    
    console.log('Cleaned JSON string:', jsonStr);
    
    const parsed = JSON.parse(jsonStr);
    
    // Validate the structure
    if (!Array.isArray(parsed.adSegments)) {
      console.warn('Invalid adSegments structure:', parsed);
      return { adSegments: [] };
    }

    // Validate and clean each segment
    parsed.adSegments = parsed.adSegments.filter(segment => {
      // Convert string numbers to actual numbers if needed
      if (typeof segment.start === 'string') {
        segment.start = parseFloat(segment.start);
      }
      if (typeof segment.end === 'string') {
        segment.end = parseFloat(segment.end);
      }

      const isValid = 
        !isNaN(segment.start) &&
        !isNaN(segment.end) &&
        typeof segment.text === 'string' &&
        segment.start >= 0 &&
        segment.end > segment.start;

      if (!isValid) {
        console.warn('Invalid segment found:', segment);
      }
      return isValid;
    });

    return parsed;
  } catch (error) {
    console.error('Error parsing JSON from AI response:', error);
    console.error('Raw text:', text);
    return { adSegments: [] };
  }
};

// Get transcript and analyze for ads
app.post('/analyze-video', async (req, res) => {
  try {
    const { videoUrl } = req.body;
    if (!videoUrl) {
      return res.status(400).json({ 
        error: 'Video URL is required',
        transcript: [],
        adSegments: []
      });
    }

    console.log('Analyzing video:', videoUrl);
    
    const videoId = getVideoId(videoUrl);
    
    if (!videoId) {
      return res.status(400).json({ 
        error: 'Invalid YouTube URL',
        transcript: [],
        adSegments: []
      });
    }

    // Get transcript with error handling
    let transcript;
    try {
      transcript = await YoutubeTranscript.fetchTranscript(videoId);
    } catch (error) {
      console.error('Error fetching transcript:', error);
      return res.status(404).json({ 
        error: 'Could not fetch video transcript. The video might not have captions available.',
        transcript: [],
        adSegments: []
      });
    }

    if (!transcript || transcript.length === 0) {
      return res.status(404).json({ 
        error: 'No transcript available for this video',
        transcript: [],
        adSegments: []
      });
    }

    // Prepare transcript for analysis
    const transcriptText = transcript.map(t => `[${t.offset}s]: ${t.text}`).join('\n');
    
    // Initialize Gemini model
    const model = genAI.getGenerativeModel({  model: "gemini-2.0-flash"});

    // Analyze for ad segments with more structured prompt
    const prompt = `You are an AI trained to analyze YouTube video transcripts and identify sponsored segments or advertisements.

Task: Analyze the following transcript and identify any sponsored segments or advertisements.

Instructions:
1. Look for phrases like:
   - "this video is sponsored by"
   - "thanks to our sponsor"
   - "special thanks to"
   - "check out"
   - "use code"
   - "discount code"
   - "affiliate link"
2. For each ad segment found, note:
   - The start timestamp (as a number in seconds, without "s" suffix)
   - The end timestamp (as a number in seconds, without "s" suffix)
   - The relevant text mentioning the sponsorship

Format your response as ONLY a JSON object with this exact structure:
{
  "adSegments": [
    {
      "start": 295.32,    // seconds as a number, no "s" suffix
      "end": 359.16,      // seconds as a number, no "s" suffix
      "text": "string"    // the sponsorship text
    }
  ]
}

Do not include any other text in your response, only the JSON object.
Do not add "s" suffix to timestamps - they should be plain numbers.

Transcript:
${transcriptText}`;
    
    const result = await model.generateContent(prompt);
    const response = result.response;
    const analysisText = response.text();
    console.log('AI Response:', analysisText);
    
    // Parse the JSON response
    const analysis = extractJSON(analysisText);
    console.log('Parsed Analysis:', analysis);

    // Send the response
    const responseToSend = {
      transcript,
      adSegments: analysis.adSegments
    };
    
    console.log('Sending response structure:', {
      firstTranscriptItem: responseToSend.transcript[0],
      transcriptLength: responseToSend.transcript.length,
      adSegments: responseToSend.adSegments
    });
    
    res.json(responseToSend);
  } catch (error) {
    console.error('Error in analyze-video:', error);
    res.status(500).json({ 
      error: 'An unexpected error occurred while analyzing the video',
      transcript: [],
      adSegments: []
    });
  }
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({ 
    error: 'Internal Server Error',
    transcript: [],
    adSegments: []
  });
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
