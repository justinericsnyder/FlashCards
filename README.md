# Microsoft Learn Flash Cards App

A web-based flash card application designed to help you study Microsoft Learn documentation by generating interactive flash cards with customizable difficulty levels and card counts.

## Features

- **URL Input**: Paste any Microsoft Learn documentation URL
- **Customizable Settings**:
  - Choose number of cards (5, 10, 15, or 20)
  - Select difficulty level (Beginner, Intermediate, Advanced)
- **Interactive Flash Cards**:
  - Question and answer format
  - Detailed explanations for each answer
  - Progress tracking
- **Score Tracking**: Track correct/incorrect answers with final score
- **Responsive Design**: Works on desktop and mobile devices

## How to Use

1. Open `index.html` in your web browser
2. Enter a Microsoft Learn documentation URL
3. Select your preferred number of cards and difficulty level
4. Click "Generate Flash Cards"
5. Study the flash cards:
   - Read the question
   - Click "Show Answer" to reveal the answer and explanation
   - Mark your response as correct or incorrect
   - Navigate between cards using Previous/Next buttons
6. Review your final score at the end

## Current Implementation

The app currently includes sample flash cards covering common Microsoft Azure topics across three difficulty levels:

- **Beginner**: Basic concepts like "What is Azure?", Resource Groups, IaaS
- **Intermediate**: Services comparison, Azure AD B2C, Key Vault
- **Advanced**: CAP theorem, Traffic Manager vs Load Balancer, Service Bus vs Event Grid

## Future Enhancements

To make this app fully functional with real Microsoft Learn documentation, you could:

1. **Add Web Scraping**: Integrate with a web scraping service to extract content from Microsoft Learn URLs
2. **AI Integration**: Use OpenAI or Azure OpenAI to generate questions from documentation content
3. **Content Parsing**: Implement logic to identify key concepts, code examples, and important information
4. **Persistence**: Add local storage to save progress and favorite card sets
5. **Export/Import**: Allow users to save and share card sets

## Files Structure

- `index.html` - Main HTML structure
- `styles.css` - Styling and responsive design
- `app.js` - JavaScript functionality and flash card logic
- `README.md` - This documentation file

## Browser Compatibility

Works in all modern browsers including Chrome, Firefox, Safari, and Edge.