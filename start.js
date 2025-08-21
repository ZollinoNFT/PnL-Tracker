#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// Check if .env file exists
const envPath = path.join(__dirname, '.env');
if (!fs.existsSync(envPath)) {
  console.log('⚠️  No .env file found. Running setup...');
  console.log('');
  
  try {
    require('./scripts/setup');
  } catch (error) {
    console.error('Setup failed:', error.message);
    console.log('');
    console.log('Please run: npm run setup');
    process.exit(1);
  }
} else {
  // Load environment and start the tracker
  require('dotenv').config();
  
  // Validate environment
  try {
    const Helpers = require('./src/utils/helpers');
    Helpers.validateEnvironment();
  } catch (error) {
    console.error('Configuration error:', error.message);
    console.log('Please run: npm run setup');
    process.exit(1);
  }
  
  // Start the main application
  require('./src/index');
}