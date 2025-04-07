# YouTube Ad Skip Backend: Technical Documentation

## Table of Contents

1. [Overview](#overview)
2. [Architecture](#architecture)
3. [Core Components](#core-components)
4. [API Endpoints](#api-endpoints)
5. [AI Integration](#ai-integration)
6. [Data Flow](#data-flow)
7. [Error Handling](#error-handling)
8. [Security Considerations](#security-considerations)
9. [Performance Optimizations](#performance-optimizations)
10. [Deployment Guide](#deployment-guide)
11. [Future Enhancements](#future-enhancements)

## 1. Overview <a name="overview"></a>

### Purpose and Functionality

The YouTube Ad Skip Backend serves as the intelligent processing layer for the YouTube Ad Skip browser extension. Its primary purpose is to analyze YouTube video transcripts to identify sponsored segments and advertisements, providing the data necessary for the extension to mark and skip these sections during playback.

Key responsibilities of the backend include:

- Retrieving video transcripts from YouTube
- Processing transcript text using AI to identify sponsored segments
- Formatting and delivering structured data to the extension
- Handling errors gracefully for various edge cases
- Ensuring secure communication with the extension

### Technology Stack

| Component | Technology |
|-----------|------------|
| **Runtime Environment** | Node.js |
| **Web Framework** | Express.js |
| **AI/ML** | Google Gemini 2.0 Flash |
| **API Integration** | YouTube Transcript API |
| **Module System** | ES Modules (`import`/`export`) |
| **Configuration** | Environment Variables (dotenv) |
| **Security** | CORS with Origin Restrictions |
| **Development Tools** | Nodemon for hot-reloading |

### Key Dependencies

```json
{
  "dependencies": {
    "@google/generative-ai": "^0.21.0",
    "cors": "^2.8.5",
    "dotenv": "^16.4.7",
    "express": "^4.21.1",
    "nodemon": "^3.1.7",
    "youtube-transcript": "^1.2.1"
  }
}
```

## 2. Architecture <a name="architecture"></a>

### High-Level System Design

The backend follows a simple, modular architecture designed for a single responsibility: analyzing YouTube transcripts for ad segments. It acts as a bridge between the YouTube Transcript API, Google's Gemini AI, and the browser extension.

```
┌─────────────────────────────────────────────────────────────┐
│                     Backend Server                          │
│                                                             │
│  ┌─────────────┐   ┌────────────────┐   ┌────────────────┐  │
│  │  Express.js │   │ Route Handlers │   │   Middleware   │  │
│  │    Server   │──►│ & Controllers  │◄──│   (CORS, etc)  │  │
│  └─────────────┘   └────────────────┘   └────────────────┘  │
│          │                 │                                 │
│          │                 │                                 │
│          ▼                 ▼                                 │
│  ┌─────────────┐   ┌────────────────┐                       │
│  │  YouTube    │   │   Google       │                       │
│  │  Transcript │   │   Gemini AI    │                       │
│  │  API Client │   │   API Client   │                       │
│  └─────────────┘   └────────────────┘                       │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

### Request Flow

The server processes requests in the following sequence:

1. **Request Validation**:
   - Express middleware parses JSON request
   - Video URL extracted and validated
   - Video ID extracted from URL

2. **Transcript Retrieval**:
   - YouTube Transcript API fetches subtitles/captions
   - Error handling for missing/unavailable transcripts
   - Transcript data formatted for AI processing

3. **AI Analysis**:
   - Transcript text sent to Google Gemini API
   - Prompt engineering tailored for ad detection
   - AI response parsed and validated for proper JSON structure

4. **Response Delivery**:
   - Structured data formatted for the client
   - Response contains transcript and identified ad segments
   - Error details provided when necessary

### Component Interaction Diagram

```
┌────────────────┐    ┌─────────────────┐    ┌───────────────────┐
│                │    │                 │    │                   │
│ Browser        │    │ Backend Server  │    │ External Services │
│ Extension      │    │                 │    │                   │
│                │    │                 │    │                   │
└────────────────┘    └─────────────────┘    └───────────────────┘
        │                     │                       │
        │  1. Request with    │                       │
        │     YouTube URL     │                       │
        │ ───────────────────►│                       │
        │                     │  2. Fetch transcript  │
        │                     │ ──────────────────────►
        │                     │                       │
        │                     │  3. Return transcript │
        │                     │ ◄──────────────────────
        │                     │                       │
        │                     │  4. Send transcript   │
        │                     │     to Gemini AI     │
        │                     │ ──────────────────────►
        │                     │                       │
        │                     │  5. Return analysis   │
        │                     │ ◄──────────────────────
        │                     │                       │
        │  6. Response with   │                       │
        │     transcript and  │                       │
        │     ad segments     │                       │
        │ ◄───────────────────│                       │
        │                     │                       │
``` 

## 5. AI Integration <a name="ai-integration"></a>

### Google Gemini 2.0 Flash

The backend leverages Google's Gemini 2.0 Flash model for analyzing transcripts and identifying ad segments. Gemini is a state-of-the-art large language model (LLM) with strong capabilities in text analysis and understanding natural language patterns.

#### Model Selection Rationale

Gemini 2.0 Flash was chosen for this application for several key reasons:

1. **Speed and Efficiency**: The "Flash" variant is optimized for quick responses, essential for a real-time extension
2. **Cost-Effectiveness**: Offers a good balance between performance and API costs
3. **Pattern Recognition**: Excellent at identifying linguistic patterns that indicate sponsorships
4. **JSON Formatting**: Capable of structured output in the exact format needed
5. **Context Window**: Can process lengthy transcripts in a single request

#### Initialization

The model is initialized with the API key from environment variables:

```javascript
import { GoogleGenerativeAI } from '@google/generative-ai';
// ...
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
```

#### Model Configuration

When generating content, specific model parameters are set:

```javascript
const model = genAI.getGenerativeModel({ model: "gemini-2.0-flash" });
```

### Prompt Engineering

The core of the AI integration is the carefully crafted prompt that instructs the model exactly how to analyze the transcript and format its response. This prompt engineering is critical to the accuracy and reliability of the ad detection.

```javascript
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
```

#### Prompt Components

1. **Role Definition**: "You are an AI trained to analyze YouTube video transcripts..."
   - Sets the context and purpose for the model
   - Focuses the model on a specific task domain

2. **Clear Task Description**: "Analyze the following transcript and identify any sponsored segments..."
   - Explicitly states what the model should accomplish
   - Establishes the primary goal of the analysis

3. **Detection Heuristics**: "Look for phrases like..."
   - Provides specific indicators the model should watch for
   - Includes common phrases used in YouTube sponsorships
   - Acts as a knowledge primer for the model

4. **Structured Output Format**: "Format your response as ONLY a JSON object..."
   - Defines the exact expected output format
   - Includes example with comments for clarity
   - Specifies data types for each field

5. **Output Constraints**: "Do not include any other text in your response..."
   - Sets boundaries to prevent extraneous content
   - Avoids common formatting issues (like adding time units)

6. **Transcript Input**: "Transcript: ${transcriptText}"
   - Passes the formatted transcript as the data to analyze
   - Each line prefixed with timestamp for context

### Response Handling

After receiving the model's response, several processing steps occur:

1. **Text Extraction**: `const analysisText = response.text();`
   - Gets the raw text content from the response object

2. **JSON Parsing**: `const analysis = extractJSON(analysisText);`
   - Processes the text to extract valid JSON
   - Handles potential formatting issues
   - Validates the structure and data types

3. **Response Construction**: 
   - Combines the original transcript with the analyzed segments
   - Returns a consistent format regardless of results

## 6. Data Flow <a name="data-flow"></a>

### End-to-End Processing

The data flows through the backend system in a series of transformations from raw input to structured output. The following diagram illustrates this flow:

```
┌────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│                │     │                 │     │                  │
│  Client Input  │────►│ Input Processing│────►│ Transcript Fetch │
│  (Video URL)   │     │ (URL Validation)│     │ (YouTube API)    │
│                │     │                 │     │                  │
└────────────────┘     └─────────────────┘     └──────────────────┘
                                                        │
                                                        ▼
┌────────────────┐     ┌─────────────────┐     ┌──────────────────┐
│                │     │                 │     │                  │
│  HTTP Response │◄────│ Response Format │◄────│ JSON Processing  │
│  (JSON Data)   │     │ (Combine Data)  │     │ (Extract JSON)   │
│                │     │                 │     │                  │
└────────────────┘     └─────────────────┘     └──────────────────┘
        ▲                                                │
        │                                                │
        │                       ┌──────────────────┐     │
        │                       │                  │     │
        └───────────────────────│ AI Analysis      │◄────┘
                                │ (Gemini API)     │
                                │                  │
                                └──────────────────┘
```

### Data Transformation Steps

#### 1. Input Validation

```javascript
const { videoUrl } = req.body;
if (!videoUrl) {
  return res.status(400).json({ 
    error: 'Video URL is required',
    transcript: [],
    adSegments: []
  });
}
```

* **Input**: JSON request with `videoUrl` property
* **Processing**: Property existence check
* **Output**: Error response or continues processing
* **Validation**: Ensures required data is present

#### 2. Video ID Extraction

```javascript
const videoId = getVideoId(videoUrl);
if (!videoId) {
  return res.status(400).json({ 
    error: 'Invalid YouTube URL',
    transcript: [],
    adSegments: []
  });
}
```

* **Input**: YouTube URL string
* **Processing**: URL parsing to extract video ID
* **Output**: Video ID string or error response
* **Validation**: Confirms URL is valid YouTube format

#### 3. Transcript Retrieval

```javascript
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
```

* **Input**: YouTube video ID
* **Processing**: API request to YouTube Transcript service
* **Output**: Array of transcript segments or error response
* **Validation**: Checks for empty or missing transcript

#### 4. Transcript Formatting

```javascript
const transcriptText = transcript.map(t => `[${t.offset}s]: ${t.text}`).join('\n');
```

* **Input**: Array of transcript segment objects
* **Processing**: String formatting with timestamps
* **Output**: Plain text string with timestamped lines
* **Transformation**: Converts object structure to AI-readable format

#### 5. AI Analysis

```javascript
const result = await model.generateContent(prompt);
const response = result.response;
const analysisText = response.text();
```

* **Input**: Formatted transcript text in prompt
* **Processing**: AI model content generation
* **Output**: Text response from model
* **Transformation**: Natural language understanding of ad segments

#### 6. JSON Extraction and Validation

```javascript
const analysis = extractJSON(analysisText);
```

* **Input**: Raw text from AI response
* **Processing**: Text parsing, cleaning, validation
* **Output**: Structured JSON object with validated segments
* **Transformation**: Converts unstructured text to structured data

#### 7. Response Construction

```javascript
const responseToSend = {
  transcript,
  adSegments: analysis.adSegments
};

res.json(responseToSend);
```

* **Input**: Original transcript and processed ad segments
* **Processing**: Object construction
* **Output**: JSON response with complete data
* **Transformation**: Combines raw and processed data for client

## 7. Error Handling <a name="error-handling"></a>

The backend system is designed to handle errors gracefully. The following are some common error scenarios and their handling:

- **Transcript Retrieval**: If the YouTube Transcript API fails to retrieve a transcript, the backend returns a 404 error with a message indicating the issue.
- **AI Analysis**: If the Google Gemini API fails to analyze a transcript, the backend returns a 500 error with a message indicating the issue.
- **Input Validation**: If the input video URL is invalid or missing, the backend returns a 400 error with a message indicating the issue.

## 8. Security Considerations <a name="security-considerations"></a>

The backend system is designed with security in mind. The following are some key security considerations:

- **CORS**: The backend system uses CORS with origin restrictions to ensure that only trusted sources can access the API.
- **API Key**: The backend system uses API keys to authenticate requests from the Google Gemini API.
- **Data Encryption**: The backend system uses HTTPS to encrypt data in transit.

## 9. Performance Optimizations <a name="performance-optimizations"></a>

The backend system is designed to be efficient and scalable. The following are some key performance optimizations:

- **Model Initialization**: The backend system initializes the Google Gemini API model only once, rather than for each request.
- **Prompt Engineering**: The backend system uses prompt engineering to ensure that the Google Gemini API model is used efficiently.
- **Data Transformation**: The backend system uses data transformation to ensure that the data is processed efficiently.

## 10. Deployment Guide <a name="deployment-guide"></a>

The backend system is designed to be deployed on a variety of platforms. The following are some key deployment considerations:

- **Node.js**: The backend system is designed to run on Node.js.
- **Express.js**: The backend system is designed to run on Express.js.
- **Environment Variables**: The backend system uses environment variables to configure the system.
- **Docker**: The backend system is designed to run in a Docker container.

## 11. Future Enhancements <a name="future-enhancements"></a>

The backend system is designed to be extensible and future-proof. The following are some key future enhancements:

- **AI Model**: The backend system is designed to support multiple AI models.
- **API Integration**: The backend system is designed to support multiple API integrations.
- **Data Transformation**: The backend system is designed to support multiple data transformations.
- **Error Handling**: The backend system is designed to support multiple error scenarios.
- **Security**: The backend system is designed to support multiple security scenarios.
- **Performance**: The backend system is designed to support multiple performance scenarios.
- **Deployment**: The backend system is designed to support multiple deployment scenarios.

``` 