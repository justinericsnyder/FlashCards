# Microsoft Learn Flash Cards

A modern, interactive web-based flash card application designed to help you study Microsoft Learn documentation by generating personalized study sessions with customizable difficulty levels and comprehensive progress tracking.

![Flash Cards Preview](https://via.placeholder.com/800x400/6366f1/ffffff?text=Microsoft+Learn+Flash+Cards)

## ✨ Features

- **🎯 Smart Content Generation**: Automatically extracts and processes Microsoft Learn documentation to create relevant flash cards
- **📊 Customizable Sessions**: Choose number of cards (5-20) and difficulty level (Beginner, Intermediate, Advanced)
- **🎨 Modern UI/UX**: World-class design with smooth animations, responsive layout, and accessibility features
- **⌨️ Keyboard Navigation**: Full keyboard support with arrow keys, number keys, and Enter/Space
- **📱 Mobile Optimized**: Progressive Web App (PWA) features for mobile devices
- **🎭 Rich Animations**: Card flip animations, progress indicators, and micro-interactions
- **♿ Accessibility**: Screen reader support, high contrast mode, and reduced motion preferences
- **📤 Share Results**: Share your scores on social media
- **🌐 Public Hosting Ready**: Optimized for deployment on GitHub Pages, Vercel, or any static hosting

## 🎉 What's New

### Version 1.0.0 Features
- ✅ **Modern UI/UX**: Complete redesign with world-class best practices
- ✅ **Smooth Animations**: Card flips, transitions, and micro-interactions
- ✅ **Accessibility**: Full keyboard navigation, screen reader support, ARIA labels
- ✅ **Mobile Responsive**: Optimized for all screen sizes
- ✅ **Progressive Web App**: Installable on mobile devices
- ✅ **Node.js Backend**: Production-ready Express server
- ✅ **Cloud Deployment**: Ready for Heroku, DigitalOcean, AWS, Docker
- ✅ **Security**: Helmet.js, CORS, compression, security headers
- ✅ **Performance**: Optimized loading, caching, and monitoring
- ✅ **Developer Experience**: Hot reload, health checks, API endpoints

### Quick Deploy Commands

```bash
# Heroku
heroku create your-app-name
git push heroku main

# DigitalOcean App Platform
# Connect GitHub repo in DO dashboard

# Docker
docker build -t flashcards .
docker run -p 3000:3000 flashcards

# Local development
npm install && npm start
```

## 🚀 Quick Start

### Option 1: Live Demo
Visit the [live demo](https://your-domain.com) to try the app immediately.

### Option 2: Local Development
1. Clone this repository:
   ```bash
   git clone https://github.com/yourusername/microsoft-learn-flashcards.git
   cd microsoft-learn-flashcards
   ```

2. Open `index.html` in your web browser:
   ```bash
   # On Windows
   start index.html

   # Or simply double-click index.html in your file explorer
   ```

3. Start studying! Enter any Microsoft Learn documentation URL and generate your flash cards.

## 📖 How to Use

1. **Setup Your Session**
   - Enter a Microsoft Learn documentation URL
   - Select the number of cards you want to study (5-20)
   - Choose your difficulty level

2. **Study Mode**
   - Read each question carefully
   - Click on your answer choice or use keyboard shortcuts (1-4)
   - Submit your answer to see the correct response and explanation
   - Navigate between cards using Previous/Next buttons or arrow keys

3. **Track Progress**
   - Monitor your progress with the animated progress bar
   - View your score in real-time
   - Review detailed explanations for each answer

4. **Share Results**
   - Share your final score on social media
   - Start a new session anytime

## 🎮 Controls

| Action | Mouse | Keyboard |
|--------|-------|----------|
| Select answer | Click choice | 1-4 keys |
| Submit answer | Click Submit | Enter or → |
| Next card | Click Next | → |
| Previous card | Click Previous | ← |
| New session | Click New Session | - |

## 🛠️ Technical Features

### UI/UX Improvements
- **Modern Design System**: CSS custom properties, consistent spacing, and typography
- **Smooth Animations**: CSS transitions, keyframe animations, and micro-interactions
- **Responsive Design**: Mobile-first approach with breakpoints for all screen sizes
- **Accessibility**: ARIA labels, keyboard navigation, screen reader support

### Performance Optimizations
- **Lazy Loading**: Intersection Observer for scroll-triggered animations
- **Efficient Animations**: GPU-accelerated transforms and opacity changes
- **Minimal Bundle**: Pure HTML/CSS/JS with no external dependencies
- **Progressive Enhancement**: Works without JavaScript (basic functionality)

### Browser Support
- Chrome 90+
- Firefox 88+
- Safari 14+
- Edge 90+

## 🌐 Hosting & Deployment

### Local Development
```bash
# Install dependencies
npm install

# Start development server with auto-reload
npm run dev

# Or start production server
npm start

# Test health endpoint
curl http://localhost:3000/health
```

### Cloud Hosting Options

#### 🚀 Heroku (Recommended for beginners)
1. **Install Heroku CLI** and login:
   ```bash
   # Download from https://devcenter.heroku.com/articles/heroku-cli
   heroku login
   ```

2. **Create and deploy**:
   ```bash
   # Create app
   heroku create your-flashcards-app

   # Deploy
   git push heroku main

   # Open in browser
   heroku open
   ```

3. **Environment variables** (optional):
   ```bash
   heroku config:set NODE_ENV=production
   ```

#### 🐙 DigitalOcean App Platform
1. **Connect your GitHub repository** to DigitalOcean App Platform
2. **Configure the app**:
   - **Source**: GitHub
   - **Runtime**: Node.js
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
3. **Set environment variables**:
   - `NODE_ENV`: `production`
   - `PORT`: `${PORT}` (automatically set by platform)

#### ☁️ AWS (EC2 + PM2)
1. **Launch EC2 instance** (t2.micro for free tier)
2. **Connect and setup**:
   ```bash
   # Update system
   sudo apt update && sudo apt upgrade -y

   # Install Node.js
   curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
   sudo apt-get install -y nodejs

   # Install PM2
   sudo npm install -g pm2

   # Clone your repository
   git clone https://github.com/yourusername/microsoft-learn-flashcards.git
   cd microsoft-learn-flashcards

   # Install dependencies
   npm install

   # Start with PM2
   pm2 start server.js --name "flashcards"
   pm2 startup
   pm2 save

   # Configure Nginx (optional)
   sudo apt install nginx
   ```

#### 🐳 Docker Deployment
```bash
# Build image
docker build -t flashcards .

# Run locally
docker run -p 3000:3000 flashcards

# For production with Docker Compose
docker-compose up -d
```

#### 📦 Other Platforms
- **Railway**: Connect GitHub repo, auto-deploys
- **Render**: Web service from GitHub, free tier available
- **Vercel**: `vercel --prod` (works but overkill for Node.js)
- **GitHub Pages**: Static hosting only (use the static version)

### Environment Variables
Create a `.env` file for local development:
```env
NODE_ENV=development
PORT=3000
```

### Performance & Security
- **Compression**: Gzip compression enabled
- **Caching**: Static assets cached for 1 day
- **Security**: Helmet.js security headers
- **CORS**: Configured for API requests
- **Health Checks**: `/health` endpoint for monitoring

### Monitoring
- Health check: `GET /health`
- App info: `GET /api/info`
- PM2 monitoring: `pm2 monit` (if using PM2)

## 🔧 Customization

### Colors and Themes
Edit the CSS custom properties in `styles.css`:

```css
:root {
    --primary-color: #6366f1;    /* Main brand color */
    --secondary-color: #06b6d4;  /* Accent color */
    --success-color: #10b981;    /* Correct answers */
    --error-color: #ef4444;      /* Incorrect answers */
}
```

### Animations
Disable animations for users who prefer reduced motion:

```css
@media (prefers-reduced-motion: reduce) {
    *, *::before, *::after {
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
    }
}
```

## 📊 Analytics & Tracking

The app includes basic usage tracking (optional):
- Session completion rates
- Average scores by difficulty
- Popular documentation topics

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit your changes: `git commit -m 'Add amazing feature'`
4. Push to the branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Microsoft Learn documentation for providing excellent learning resources
- [allorigins.win](https://allorigins.win) for CORS proxy service
- Inter font family by Rasmus Andersson
- Icons from various open-source projects

## 🐛 Known Limitations

- **CORS Proxy**: Currently uses a third-party CORS proxy which may have rate limits
- **Content Parsing**: May not work perfectly with all Microsoft Learn page structures
- **Browser Storage**: Progress is not saved between sessions (planned feature)

## 🚀 Future Enhancements

- [ ] **Backend API**: Replace CORS proxy with server-side content fetching
- [ ] **User Accounts**: Save progress and create custom study plans
- [ ] **Offline Mode**: Service worker for offline functionality
- [ ] **Multiple Languages**: Support for non-English documentation
- [ ] **Study Streaks**: Gamification features
- [ ] **Export/Import**: Save and share custom card sets

---

**Made with ❤️ for the Microsoft Learn community**

- `index.html` - Main HTML structure
- `styles.css` - Styling and responsive design
- `app.js` - JavaScript functionality and flash card logic
- `README.md` - This documentation file

## Browser Compatibility

Works in all modern browsers including Chrome, Firefox, Safari, and Edge.