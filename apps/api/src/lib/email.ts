import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';
import { logger } from './logger.js';

interface EmailConfig {
  host: string;
  port: number;
  secure: boolean;
  auth: {
    user: string;
    pass: string;
  };
  from: string;
  to: string;
}

interface EmailNotification {
  subject: string;
  text: string;
  html?: string;
  priority?: 'high' | 'normal' | 'low';
}

class EmailService {
  private transporter: Transporter | null = null;
  private config: EmailConfig | null = null;
  private enabled = false;

  constructor() {
    this.initialize();
  }

  private initialize() {
    // Check if SMTP configuration is provided
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = process.env.SMTP_PORT;
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASSWORD;
    const smtpFrom = process.env.SMTP_FROM;
    const alertEmail = process.env.ALERT_EMAIL;

    // Only enable email service if all required config is present
    if (!smtpHost || !smtpPort || !smtpUser || !smtpPass || !smtpFrom || !alertEmail) {
      logger.info('Email notifications disabled - SMTP configuration not complete');
      return;
    }

    this.config = {
      host: smtpHost,
      port: parseInt(smtpPort, 10),
      secure: process.env.SMTP_SECURE === 'true', // true for 465, false for other ports
      auth: {
        user: smtpUser,
        pass: smtpPass,
      },
      from: smtpFrom,
      to: alertEmail,
    };

    // Create reusable transporter
    this.transporter = nodemailer.createTransport({
      host: this.config.host,
      port: this.config.port,
      secure: this.config.secure,
      auth: this.config.auth,
    });

    this.enabled = true;
    logger.info({ smtp: { host: smtpHost, port: smtpPort, secure: this.config.secure } }, 'Email notifications enabled');
  }

  /**
   * Send an email notification
   */
  async sendEmail(notification: EmailNotification): Promise<boolean> {
    if (!this.enabled || !this.transporter || !this.config) {
      logger.debug('Email not sent - service disabled or not configured');
      return false;
    }

    try {
      const mailOptions = {
        from: this.config.from,
        to: this.config.to,
        subject: notification.subject,
        text: notification.text,
        html: notification.html || notification.text,
        priority: notification.priority || 'normal',
      };

      const info = await this.transporter.sendMail(mailOptions);
      logger.info({ messageId: info.messageId }, 'Email notification sent');
      return true;
    } catch (error) {
      logger.error({ error }, 'Failed to send email notification');
      return false;
    }
  }

  /**
   * Send a critical error notification
   */
  async notifyCriticalError(error: Error, context?: Record<string, unknown>): Promise<void> {
    const contextStr = context ? `\n\nContext:\n${JSON.stringify(context, null, 2)}` : '';

    const subject = `🚨 Critical Error - LSS Verband Tool`;
    const text = `A critical error occurred in the LSS Verband Tool:

Error: ${error.message}

Stack Trace:
${error.stack || 'No stack trace available'}${contextStr}

Timestamp: ${new Date().toISOString()}
Environment: ${process.env.NODE_ENV || 'unknown'}`;

    const html = `
<h2 style="color: #d32f2f;">🚨 Critical Error - LSS Verband Tool</h2>
<p>A critical error occurred in the LSS Verband Tool:</p>

<h3>Error Details:</h3>
<pre style="background-color: #f5f5f5; padding: 10px; border-radius: 4px;">${error.message}</pre>

<h3>Stack Trace:</h3>
<pre style="background-color: #f5f5f5; padding: 10px; border-radius: 4px; font-size: 11px;">${error.stack || 'No stack trace available'}</pre>
${context ? `
<h3>Context:</h3>
<pre style="background-color: #f5f5f5; padding: 10px; border-radius: 4px;">${JSON.stringify(context, null, 2)}</pre>` : ''}

<hr>
<p style="color: #666; font-size: 12px;">
  <strong>Timestamp:</strong> ${new Date().toISOString()}<br>
  <strong>Environment:</strong> ${process.env.NODE_ENV || 'unknown'}
</p>
`;

    await this.sendEmail({
      subject,
      text,
      html,
      priority: 'high',
    });
  }

  /**
   * Send a warning notification
   */
  async notifyWarning(message: string, details?: Record<string, unknown>): Promise<void> {
    const detailsStr = details ? `\n\nDetails:\n${JSON.stringify(details, null, 2)}` : '';

    const subject = `⚠️ Warning - LSS Verband Tool`;
    const text = `Warning from LSS Verband Tool:

${message}${detailsStr}

Timestamp: ${new Date().toISOString()}`;

    const html = `
<h2 style="color: #f57c00;">⚠️ Warning - LSS Verband Tool</h2>
<p>${message}</p>
${details ? `
<h3>Details:</h3>
<pre style="background-color: #f5f5f5; padding: 10px; border-radius: 4px;">${JSON.stringify(details, null, 2)}</pre>` : ''}

<hr>
<p style="color: #666; font-size: 12px;">
  <strong>Timestamp:</strong> ${new Date().toISOString()}
</p>
`;

    await this.sendEmail({
      subject,
      text,
      html,
      priority: 'normal',
    });
  }

  /**
   * Send a general information notification
   */
  async notifyInfo(message: string, details?: Record<string, unknown>): Promise<void> {
    const detailsStr = details ? `\n\nDetails:\n${JSON.stringify(details, null, 2)}` : '';

    const subject = `ℹ️ Info - LSS Verband Tool`;
    const text = `Information from LSS Verband Tool:

${message}${detailsStr}

Timestamp: ${new Date().toISOString()}`;

    const html = `
<h2 style="color: #1976d2;">ℹ️ Info - LSS Verband Tool</h2>
<p>${message}</p>
${details ? `
<h3>Details:</h3>
<pre style="background-color: #f5f5f5; padding: 10px; border-radius: 4px;">${JSON.stringify(details, null, 2)}</pre>` : ''}

<hr>
<p style="color: #666; font-size: 12px;">
  <strong>Timestamp:</strong> ${new Date().toISOString()}
</p>
`;

    await this.sendEmail({
      subject,
      text,
      html,
      priority: 'low',
    });
  }

  /**
   * Verify the SMTP connection
   */
  async verifyConnection(): Promise<boolean> {
    if (!this.enabled || !this.transporter) {
      logger.warn('Cannot verify SMTP connection - service disabled');
      return false;
    }

    try {
      await this.transporter.verify();
      logger.info('SMTP connection verified successfully');
      return true;
    } catch (error) {
      logger.error({ error }, 'SMTP connection verification failed');
      return false;
    }
  }

  /**
   * Check if email service is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }
}

// Export singleton instance
export const emailService = new EmailService();

// Export helper function for critical errors
export const notifyError = (error: Error, context?: Record<string, unknown>) => {
  // Log the error first
  logger.error({ error, context }, 'Critical error occurred');

  // Send email notification (async, don't wait)
  emailService.notifyCriticalError(error, context).catch((emailError) => {
    logger.error({ error: emailError }, 'Failed to send error notification email');
  });
};
