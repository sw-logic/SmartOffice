import nodemailer from 'nodemailer';
import type { Transporter } from 'nodemailer';

// Create transporter based on environment variables
function createTransporter(): Transporter {
	return nodemailer.createTransport({
		host: process.env.SMTP_HOST || 'smtp.example.com',
		port: parseInt(process.env.SMTP_PORT || '587'),
		secure: process.env.SMTP_SECURE === 'true',
		auth: {
			user: process.env.SMTP_USER,
			pass: process.env.SMTP_PASSWORD
		}
	});
}

let transporter: Transporter | null = null;

function getTransporter(): Transporter {
	if (!transporter) {
		transporter = createTransporter();
	}
	return transporter;
}

export interface EmailOptions {
	to: string | string[];
	subject: string;
	html: string;
	text?: string;
	attachments?: Array<{
		filename: string;
		path?: string;
		content?: Buffer | string;
		contentType?: string;
	}>;
	replyTo?: string;
	cc?: string | string[];
	bcc?: string | string[];
}

export interface EmailResult {
	success: boolean;
	messageId?: string;
	error?: string;
}

/**
 * Send an email
 * @param options - Email options
 * @returns Result with success status and message ID
 */
export async function sendEmail(options: EmailOptions): Promise<EmailResult> {
	try {
		const info = await getTransporter().sendMail({
			from: process.env.SMTP_FROM || 'noreply@yourcompany.com',
			to: Array.isArray(options.to) ? options.to.join(', ') : options.to,
			subject: options.subject,
			html: options.html,
			text: options.text,
			attachments: options.attachments,
			replyTo: options.replyTo,
			cc: options.cc ? (Array.isArray(options.cc) ? options.cc.join(', ') : options.cc) : undefined,
			bcc: options.bcc
				? Array.isArray(options.bcc)
					? options.bcc.join(', ')
					: options.bcc
				: undefined
		});

		return { success: true, messageId: info.messageId };
	} catch (error) {
		console.error('Email sending failed:', error);
		return {
			success: false,
			error: error instanceof Error ? error.message : 'Unknown error'
		};
	}
}

/**
 * Send an offer email with PDF attachment
 */
export async function sendOfferEmail(
	clientEmail: string,
	clientName: string,
	offerNumber: string,
	validUntil: Date,
	pdfPath: string
): Promise<EmailResult> {
	const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .header { background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 20px; }
    .content { padding: 20px 0; }
    .footer { color: #666; font-size: 12px; margin-top: 30px; padding-top: 20px; border-top: 1px solid #eee; }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1 style="margin: 0; color: #333;">Offer ${offerNumber}</h1>
    </div>
    <div class="content">
      <p>Dear ${clientName},</p>
      <p>Please find attached our offer <strong>${offerNumber}</strong>.</p>
      <p>This offer is valid until <strong>${validUntil.toLocaleDateString()}</strong>.</p>
      <p>If you have any questions or would like to discuss this offer, please don't hesitate to contact us.</p>
      <p>Thank you for your interest in our services.</p>
      <p>Best regards,<br>Your Company Team</p>
    </div>
    <div class="footer">
      <p>This email was sent automatically. Please do not reply directly to this email.</p>
    </div>
  </div>
</body>
</html>
  `;

	return sendEmail({
		to: clientEmail,
		subject: `Offer ${offerNumber}`,
		html,
		attachments: [
			{
				filename: `offer-${offerNumber}.pdf`,
				path: pdfPath
			}
		]
	});
}

/**
 * Send a password reset email
 */
export async function sendPasswordResetEmail(
	email: string,
	resetUrl: string,
	expiresIn: string
): Promise<EmailResult> {
	const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #007bff; color: white; text-decoration: none; border-radius: 4px; }
    .footer { color: #666; font-size: 12px; margin-top: 30px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Password Reset Request</h1>
    <p>You have requested to reset your password. Click the button below to proceed:</p>
    <p><a href="${resetUrl}" class="button">Reset Password</a></p>
    <p>This link will expire in ${expiresIn}.</p>
    <p>If you didn't request this password reset, please ignore this email.</p>
    <div class="footer">
      <p>For security reasons, this link can only be used once.</p>
    </div>
  </div>
</body>
</html>
  `;

	return sendEmail({
		to: email,
		subject: 'Password Reset Request',
		html
	});
}

/**
 * Send a welcome email to new users
 */
export async function sendWelcomeEmail(
	email: string,
	name: string,
	loginUrl: string
): Promise<EmailResult> {
	const html = `
<!DOCTYPE html>
<html>
<head>
  <style>
    body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
    .container { max-width: 600px; margin: 0 auto; padding: 20px; }
    .button { display: inline-block; padding: 12px 24px; background: #28a745; color: white; text-decoration: none; border-radius: 4px; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Welcome to Company Management System!</h1>
    <p>Dear ${name},</p>
    <p>Your account has been created successfully. You can now log in to access the system:</p>
    <p><a href="${loginUrl}" class="button">Log In</a></p>
    <p>If you have any questions, please contact your administrator.</p>
    <p>Best regards,<br>The Company Management Team</p>
  </div>
</body>
</html>
  `;

	return sendEmail({
		to: email,
		subject: 'Welcome to Company Management System',
		html
	});
}

/**
 * Verify SMTP connection
 */
export async function verifyConnection(): Promise<boolean> {
	try {
		await getTransporter().verify();
		return true;
	} catch (error) {
		console.error('SMTP connection verification failed:', error);
		return false;
	}
}
