import "server-only";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

const FROM_EMAIL =
  process.env.FROM_EMAIL ?? "Flowchat <noreply@adventureflow.ai>";

const LOGO_HEADER = `
  <div style="text-align: center; margin-bottom: 32px;">
    <div style="display: inline-block; background-color: #000000; border-radius: 12px; padding: 10px 14px;">
      <span style="font-size: 20px; font-weight: 700; color: #ffffff; letter-spacing: 0.05em;">AF</span>
    </div>
    <h1 style="font-size: 24px; font-weight: 600; margin: 8px 0 0;">Flowchat</h1>
  </div>
`;

const FOOTER = `
  <hr style="border: none; border-top: 1px solid #eee; margin: 32px 0;" />
  <p style="font-size: 12px; color: #999; text-align: center;">
    &copy; 2026 Adventure Flow AI. All rights reserved.
  </p>
`;

export async function sendPasswordResetEmail(to: string, resetUrl: string) {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "Reset your Flowchat password",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        ${LOGO_HEADER}
        <p style="font-size: 16px; color: #333; line-height: 1.5;">
          We received a request to reset your password. Click the button below to choose a new one.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${resetUrl}" style="display: inline-block; padding: 12px 32px; background-color: #171717; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
            Reset Password
          </a>
        </div>
        <p style="font-size: 14px; color: #666; line-height: 1.5;">
          This link expires in 1 hour. If you didn't request a password reset, you can safely ignore this email.
        </p>
        ${FOOTER}
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send password reset email:", error);
    throw new Error("Failed to send password reset email");
  }
}

export async function sendWelcomeEmail(to: string, name: string) {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: "Welcome to Flowchat!",
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        ${LOGO_HEADER}
        <p style="font-size: 16px; color: #333; line-height: 1.5;">
          Hi ${name},
        </p>
        <p style="font-size: 16px; color: #333; line-height: 1.5;">
          Thank you for signing up for Flowchat! Your account is ready to go.
        </p>
        <p style="font-size: 16px; color: #333; line-height: 1.5;">
          Flowchat helps you build and deploy agentic workflows, built especially for construction and renewable energy projects.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="https://app.adventureflow.ai" style="display: inline-block; padding: 12px 32px; background-color: #171717; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
            Get Started
          </a>
        </div>
        <p style="font-size: 14px; color: #666; line-height: 1.5;">
          If you have any questions, just reply to this email or reach out to us at jeff@adventureflow.ai.
        </p>
        ${FOOTER}
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send welcome email:", error);
    throw new Error("Failed to send welcome email");
  }
}

export async function sendProjectInviteEmail(
  to: string,
  inviterName: string,
  projectName: string,
  appUrl: string
) {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to,
    subject: `You've been invited to "${projectName}" on Flowchat`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 480px; margin: 0 auto; padding: 40px 20px;">
        ${LOGO_HEADER}
        <p style="font-size: 16px; color: #333; line-height: 1.5;">
          ${inviterName} has invited you to collaborate on <strong>${projectName}</strong> in Flowchat.
        </p>
        <p style="font-size: 16px; color: #333; line-height: 1.5;">
          You can view and edit the project right away.
        </p>
        <div style="text-align: center; margin: 32px 0;">
          <a href="${appUrl}" style="display: inline-block; padding: 12px 32px; background-color: #171717; color: #ffffff; text-decoration: none; border-radius: 8px; font-size: 14px; font-weight: 500;">
            Go to Flowchat
          </a>
        </div>
        <p style="font-size: 14px; color: #666; line-height: 1.5;">
          If you don't have a Flowchat account yet, you'll be able to create one when you sign in.
        </p>
        ${FOOTER}
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send project invite email:", error);
    throw new Error("Failed to send project invite email");
  }
}

const CONTACT_TO_EMAIL = process.env.CONTACT_EMAIL ?? "jeff@adventureflow.ai";

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export async function sendContactRequestEmail({
  name,
  email,
  message,
}: {
  name: string;
  email: string;
  message: string;
}) {
  const { error } = await resend.emails.send({
    from: FROM_EMAIL,
    to: CONTACT_TO_EMAIL,
    replyTo: email,
    subject: `Adventure Flow: Contact from ${name}`,
    html: `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 560px; margin: 0 auto; padding: 24px;">
        <p style="font-size: 14px; color: #666;">Someone requested guidance or contact from the Adventure Flow site.</p>
        <p style="font-size: 14px; color: #333;"><strong>Name:</strong> ${escapeHtml(name)}</p>
        <p style="font-size: 14px; color: #333;"><strong>Email:</strong> ${escapeHtml(email)}</p>
        <p style="font-size: 14px; color: #333;"><strong>Message:</strong></p>
        <div style="font-size: 14px; color: #333; white-space: pre-wrap; background: #f5f5f5; padding: 16px; border-radius: 8px;">${escapeHtml(message)}</div>
        <p style="font-size: 12px; color: #999; margin-top: 24px;">Reply directly to this email to respond to ${escapeHtml(email)}.</p>
      </div>
    `,
  });

  if (error) {
    console.error("Failed to send contact request email:", error);
    throw new Error("Failed to send contact request email");
  }
}
