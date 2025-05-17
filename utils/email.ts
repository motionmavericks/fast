// utils/email.ts - Email notification functionality using SendGrid

import sgMail from '@sendgrid/mail';

// Set API key (would be configured during setup)
const apiKey = process.env.SENDGRID_API_KEY || '';
if (apiKey) {
  sgMail.setApiKey(apiKey);
}

// Email configuration type
interface EmailConfig {
  apiKey: string;
  fromEmail: string;
  adminEmails: string[];
}

// Store email configuration
let emailConfig: EmailConfig = {
  apiKey: '',
  fromEmail: 'uploads@motionmavericks.com',
  adminEmails: []
};

// Upload notification parameters
interface UploadNotification {
  fileName: string;
  fileSize: number;
  clientName: string;
  projectName: string;
  uploadDate: Date;
  fileId?: string; // File ID for secure access
  clientEmail?: string; // Optional client email for notifications
}

/**
 * Format file size for display
 * @param bytes File size in bytes
 * @returns Formatted file size (e.g., "2.5 MB")
 */
function formatFileSize(bytes: number): string {
  if (bytes < 1024) return bytes + ' bytes';
  else if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  else if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  else return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB';
}

/**
 * Generate secure access URL for a file
 * @param fileId The file ID
 * @returns Secure URL for file access
 */
function generateSecureFileUrl(fileId: string): string {
  // Base URL would ideally come from environment variables
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000';
  return `${baseUrl}/api/files/${fileId}/stream`;
}

/**
 * Send upload notification to admin and optionally client
 * @param uploadInfo Information about the uploaded file
 * @returns Promise with success/failure
 */
export async function sendUploadNotification(uploadInfo: UploadNotification): Promise<boolean> {
  try {
    const formattedDate = uploadInfo.uploadDate.toLocaleString();
    const formattedSize = formatFileSize(uploadInfo.fileSize);
    
    // Create secure access URL if fileId is provided
    const downloadLink = uploadInfo.fileId 
      ? `Access file: ${generateSecureFileUrl(uploadInfo.fileId)}`
      : '';
    
    // Prepare admin notification
    const adminSubject = `New Upload: ${uploadInfo.fileName} for ${uploadInfo.projectName}`;
    const adminText = `
      A new file has been uploaded:
      
      File: ${uploadInfo.fileName}
      Size: ${formattedSize}
      Client: ${uploadInfo.clientName}
      Project: ${uploadInfo.projectName}
      Uploaded: ${formattedDate}
      ${downloadLink}
    `;
    
    // Convert plain text to HTML for better rendering
    const adminHtml = adminText.replace(/\n/g, '<br>').replace(/\s{2,}/g, '&nbsp;&nbsp;');
    
    if (apiKey && emailConfig.adminEmails.length > 0) {
      // Send to all admin emails
      const adminPromises = emailConfig.adminEmails.map(adminEmail => 
        sgMail.send({
          to: adminEmail,
          from: emailConfig.fromEmail,
          subject: adminSubject,
          text: adminText,
          html: adminHtml,
        })
      );
      
      await Promise.all(adminPromises);
      
      // If client email is provided, send notification to client as well
      if (uploadInfo.clientEmail) {
        const clientSubject = `Upload Confirmation: ${uploadInfo.fileName}`;
        const clientText = `
          Your file has been successfully uploaded to Motion Mavericks Fast:
          
          File: ${uploadInfo.fileName}
          Size: ${formattedSize}
          Project: ${uploadInfo.projectName}
          Uploaded: ${formattedDate}
          
          Thank you for using our service.
        `;
        
        const clientHtml = clientText.replace(/\n/g, '<br>').replace(/\s{2,}/g, '&nbsp;&nbsp;');
        
        await sgMail.send({
          to: uploadInfo.clientEmail,
          from: emailConfig.fromEmail,
          subject: clientSubject,
          text: clientText,
          html: clientHtml,
        });
      }
      
      return true;
    } else {
      // API key not set or no admin emails configured, log instead
      console.log('[Email] SendGrid API key not configured or no admin emails set. Using logs instead:');
      console.log('[Email] Admin notification:', {
        to: emailConfig.adminEmails,
        from: emailConfig.fromEmail,
        subject: adminSubject,
        text: adminText
      });
      
      if (uploadInfo.clientEmail) {
        const clientSubject = `Upload Confirmation: ${uploadInfo.fileName}`;
        console.log('[Email] Client notification:', {
          to: uploadInfo.clientEmail,
          from: emailConfig.fromEmail,
          subject: clientSubject
        });
      }
      
      return true;
    }
  } catch (error) {
    console.error('[Email] Error sending notification:', error);
    return false;
  }
}

/**
 * Initialize email configuration
 * @param config Email service configuration
 */
export function initializeEmail(config: EmailConfig): void {
  emailConfig = {
    ...config
  };
  
  // Set the SendGrid API key
  if (config.apiKey) {
    sgMail.setApiKey(config.apiKey);
  }
  
  console.log('[Email] Email service initialized with config:', {
    apiKey: config.apiKey ? '(set)' : '(not set)',
    fromEmail: config.fromEmail,
    adminEmails: config.adminEmails
  });
}

// Export for using in API routes
export default {
  sendUploadNotification,
  initializeEmail
};