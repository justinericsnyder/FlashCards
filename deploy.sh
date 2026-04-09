#!/bin/bash

# Microsoft Learn Flash Cards - Deployment Script
# This script helps deploy the application to various platforms

set -e

echo "🚀 Microsoft Learn Flash Cards - Deployment Script"
echo "================================================="

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 14+ first."
    exit 1
fi

# Check Node.js version
NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
if [ "$NODE_VERSION" -lt 14 ]; then
    echo "❌ Node.js version 14+ is required. Current version: $(node -v)"
    exit 1
fi

echo "✅ Node.js version: $(node -v)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Run tests if they exist
if [ -f "package.json" ] && grep -q '"test"' package.json; then
    echo "🧪 Running tests..."
    npm test
fi

# Build if build script exists
if npm run | grep -q "build"; then
    echo "🔨 Building application..."
    npm run build
fi

echo "✅ Application ready for deployment!"
echo ""
echo "🌐 Deployment Options:"
echo "1. Heroku: git push heroku main"
echo "2. DigitalOcean: Connect GitHub repo to App Platform"
echo "3. AWS: Use Elastic Beanstalk or EC2"
echo "4. Docker: docker build -t flashcards . && docker run -p 3000:3000 flashcards"
echo "5. Local: npm start"
echo ""
echo "📚 For detailed instructions, see README.md"