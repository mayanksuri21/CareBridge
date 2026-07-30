#!/bin/bash

# HealthConnect Setup Script
# This script helps team members set up the project quickly

echo "🏥 HealthConnect - Team Setup Script"
echo "======================================"

# Check if .env.local exists
if [ -f ".env.local" ]; then
    echo "✅ .env.local already exists"
else
    echo "📝 Creating .env.local from template..."
    cp .env.example .env.local
    echo "⚠️  Please update .env.local with your Supabase credentials!"
    echo "   Go to: https://supabase.com/dashboard/project/_/settings/api"
fi

# Install dependencies
echo ""
echo "📦 Installing dependencies..."
if command -v pnpm &> /dev/null; then
    pnpm install
elif command -v npm &> /dev/null; then
    npm install
else
    echo "❌ Neither pnpm nor npm found. Please install Node.js first."
    exit 1
fi

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Update .env.local with your Supabase credentials"
echo "2. Run 'pnpm dev' to start the development server"
echo "3. Open http://localhost:3000 in your browser"
echo ""
echo "Need help? Check the README.md file or ask the team!"