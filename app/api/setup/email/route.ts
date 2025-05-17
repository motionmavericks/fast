import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';
import email from '@/utils/email';

export async function POST(request: Request) {
  try {
    const { apiKey, senderEmail, adminEmails } = await request.json();

    // Basic validation
    if (!senderEmail) {
      return NextResponse.json(
        { message: 'Sender Email is required' },
        { status: 400 }
      );
    }
    
    if (!adminEmails || !Array.isArray(adminEmails) || adminEmails.length === 0) {
      return NextResponse.json(
        { message: 'At least one admin email is required' },
        { status: 400 }
      );
    }
    
    // Validate email format
    const emailRegex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
    if (!emailRegex.test(senderEmail)) {
      return NextResponse.json(
        { message: 'Invalid sender email format' },
        { status: 400 }
      );
    }
    
    for (const adminEmail of adminEmails) {
      if (!emailRegex.test(adminEmail)) {
        return NextResponse.json(
          { message: `Invalid admin email format: ${adminEmail}` },
          { status: 400 }
        );
      }
    }

    // Save to .env.local
    try {
      const envLocalPath = path.resolve(process.cwd(), '.env.local');
      
      // Read existing file or create empty string if file doesn't exist
      let existingEnv = '';
      try {
        existingEnv = await fs.readFile(envLocalPath, 'utf8');
      } catch (err) {
        // File doesn't exist, start with empty string
      }
      
      // Replace or add variables
      const envVars = [
        { key: 'SENDGRID_API_KEY', value: apiKey },
        { key: 'SENDER_EMAIL', value: senderEmail },
        { key: 'ADMIN_EMAILS', value: adminEmails.join(',') }
      ];
      
      for (const { key, value } of envVars) {
        const regex = new RegExp(`^${key}=.*$`, 'm');
        const newLine = `${key}=${value}`;
        
        if (regex.test(existingEnv)) {
          // Replace existing line
          existingEnv = existingEnv.replace(regex, newLine);
        } else {
          // Add new line
          existingEnv += `\n${newLine}`;
        }
      }
      
      // Write back to .env.local
      await fs.writeFile(envLocalPath, existingEnv.trim() + '\n');
      console.log('Email config saved to .env.local');
    } catch (err) {
      console.error('Error writing to .env.local:', err);
      // Continue even if .env.local fails - we still want to initialize in memory
    }

    // Initialize the email service
    email.initializeEmail({
      apiKey,
      fromEmail: senderEmail,
      adminEmails
    });

    console.log(`Email Config saved - Sender: ${senderEmail}, Admin emails: ${adminEmails.join(', ')}`);
    console.log('IMPORTANT: For production, ensure email credentials are set as secure environment variables.');

    return NextResponse.json(
      { message: 'Email configuration saved and initialized.' },
      { status: 200 }
    );

  } catch (error: any) {
    console.error('Email configuration error:', error);
    return NextResponse.json(
      { message: 'Error saving email configuration', error: error.message },
      { status: 500 }
    );
  }
}
