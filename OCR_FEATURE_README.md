# OCR Feature for Regear Threads

## Overview
This feature automatically detects and extracts the "Est. Market Value" from images posted in CTA Regear and FF Regear threads.

## How It Works

### 1. Thread Tracking
- When you create a regear thread using `/ctaregear` or `/ffregear`, the thread ID is automatically added to the `regearThreads` Set
- The bot monitors all messages in these tracked threads

### 2. Image Detection
- When a user posts an image in a regear thread, the bot automatically detects it
- Supported image formats: PNG, JPG, JPEG, GIF, WEBP

### 3. OCR Processing
- The bot downloads the image and processes it using Tesseract.js OCR
- It looks for patterns matching "Est. Market Value" followed by a number
- Supported formats:
  - `Est. Market Value: 504,360`
  - `Est. Market Value ⚪ 504,360` (like in your sample image)
  - `Market Value: 1.5M`
  - `Est. Market 250K`
  - And other variations

### 4. Auto-Reply
- If a market value is found, the bot replies to the message with:
  - `💰 **Est. Market Value:** [extracted_value]`

## Installation

The following packages have been installed:
```bash
npm install tesseract.js axios
```

## Code Changes

### 1. New Imports (app.js)
```javascript
import { createWorker } from 'tesseract.js';
import axios from 'axios';
```

### 2. Thread Tracking State
```javascript
const regearThreads = new Set(); // Stores thread IDs for regear threads
```

### 3. OCR Function
- `extractMarketValueFromImage(imageUrl)` - Downloads and processes images to extract market values

### 4. Message Handler
- Added image detection logic in `messageCreate` event
- Processes images only in tracked regear threads

### 5. Command Updates
- `/ctaregear` - Now adds thread ID to tracking
- `/ffregear` - Now adds thread ID to tracking

## Usage Example

1. Create a regear thread:
   ```
   /ctaregear title: "Regear for Raid 1"
   ```

2. Post an image with market value in the thread
   - The image should contain text like "Est. Market Value" with a number

3. The bot will automatically reply with:
   ```
   💰 **Est. Market Value:** 504,360
   ```

## Pattern Matching

The OCR function uses multiple patterns to find the market value:
1. Exact match: "Est. Market Value" + number
2. Partial match: "Market Value" + number
3. Alternative: "Est. Market" + number
4. Fallback: Largest number found (3+ digits)

## Error Handling

- If OCR fails, errors are logged but won't crash the bot
- If no value is found, the bot simply doesn't reply
- The bot ignores its own messages to prevent loops

## Testing

To test the feature:
1. Start the bot: `npm start`
2. Create a regear thread using `/ctaregear` or `/ffregear`
3. Post an image containing "Est. Market Value" text
4. The bot should reply with the extracted value

## Notes

- OCR accuracy depends on image quality and text clarity
- The bot uses English language OCR (Tesseract 'eng' model)
- Processing time varies based on image size (typically 2-5 seconds)
- Thread IDs remain tracked until the bot restarts (in-memory storage)

## Future Improvements

Consider implementing:
- Persistent storage for thread IDs (database)
- Support for multiple languages
- Image preprocessing for better OCR accuracy
- Configuration for which channels can use OCR
- Ability to manually add/remove threads from tracking

