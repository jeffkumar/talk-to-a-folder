"use client";

import { Check, Copy, Mail, Send } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";

type EmailCardProps = {
  content: string;
  className?: string;
};

export type ParsedEmail = {
  subject: string;
  body: string;
  to?: string;
};

export function parseEmail(text: string): ParsedEmail | null {
  const lines = text.split("\n");
  let subject = "";
  let to = "";
  let bodyStartIndex = 0;

  for (let i = 0; i < Math.min(lines.length, 10); i++) {
    const line = lines[i].trim();

    const subjectMatch = line.match(/^\*{0,2}Subject:?\*{0,2}\s*(.+)/i);
    if (subjectMatch) {
      subject = subjectMatch[1].trim();
      bodyStartIndex = Math.max(bodyStartIndex, i + 1);
      continue;
    }

    const toMatch = line.match(/^\*{0,2}To:?\*{0,2}\s*(.+)/i);
    if (toMatch) {
      to = toMatch[1].trim();
      bodyStartIndex = Math.max(bodyStartIndex, i + 1);
    }
  }

  if (subject) {
    // Valid email with Subject: line
  } else {
    const firstLines = lines.slice(0, 5).join(" ");
    const lowerText = text.toLowerCase();

    const hasGreeting =
      /^(hey|hi|hello|dear|good morning|good afternoon|good evening|greetings)/i.test(
        firstLines.trim()
      );

    const hasSignoff =
      /(cheers|best|regards|sincerely|thanks|thank you|best regards|kind regards|warm regards|yours|warmly|take care|looking forward|speak soon|talk soon),?\s*$/im.test(
        lowerText
      );

    const hasClosingWithName =
      /\n\s*(cheers|best|regards|sincerely|thanks|thank you|best regards|kind regards|warm regards|yours|warmly),?\s*\n+\s*[A-Z][a-z]+/i.test(
        text
      );

    if (!hasGreeting && !hasSignoff && !hasClosingWithName) {
      return null;
    }
  }

  while (bodyStartIndex < lines.length && lines[bodyStartIndex].trim() === "") {
    bodyStartIndex++;
  }

  while (
    bodyStartIndex < lines.length &&
    /^[-_=]{3,}$/.test(lines[bodyStartIndex].trim())
  ) {
    bodyStartIndex++;
  }
  while (bodyStartIndex < lines.length && lines[bodyStartIndex].trim() === "") {
    bodyStartIndex++;
  }

  const body = lines.slice(bodyStartIndex).join("\n").trim();

  return {
    subject: subject || "Email Draft",
    body,
    to: to || undefined,
  };
}

export function createGmailUrl(email: ParsedEmail): string {
  const params = new URLSearchParams();
  params.set("view", "cm");
  params.set("fs", "1");
  if (email.to) params.set("to", email.to);
  params.set("su", email.subject);
  params.set("body", email.body);
  return `https://mail.google.com/mail/?${params.toString()}`;
}

export function createOutlookUrl(email: ParsedEmail): string {
  const params = new URLSearchParams();
  params.set("subject", email.subject);
  params.set("body", email.body);
  if (email.to) params.set("to", email.to);
  return `https://outlook.live.com/mail/0/deeplink/compose?${params.toString()}`;
}

export function createMailtoUrl(email: ParsedEmail): string {
  const params = new URLSearchParams();
  params.set("subject", email.subject);
  params.set("body", email.body);
  const to = email.to || "";
  return `mailto:${to}?${params.toString()}`;
}

export const GmailIcon = () => (
  <svg className="size-5" viewBox="0 0 24 24">
    <path
      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      fill="#4285F4"
    />
    <path
      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      fill="#34A853"
    />
    <path
      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      fill="#FBBC05"
    />
    <path
      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      fill="#EA4335"
    />
  </svg>
);

export const OutlookIcon = () => (
  <svg className="size-5" viewBox="0 0 24 24">
    <path
      d="M24 7.387v10.478c0 .23-.08.424-.238.576-.158.154-.352.23-.58.23h-8.547v-6.959l1.6 1.229c.101.072.209.108.322.108.121 0 .227-.036.318-.108l6.9-5.14v-.414h-.166L15.346 13.6l-1.711-1.285v-5.47h8.547c.229 0 .424.076.58.228.159.153.238.347.238.576z"
      fill="#0078D4"
    />
    <path
      d="M14.545 6.098v11.856H0V6.098c0-.628.22-1.164.66-1.61A2.15 2.15 0 0 1 2.182 3.82h10.182c.627 0 1.163.223 1.61.669.446.445.571.981.571 1.609z"
      fill="#0078D4"
    />
    <ellipse cx="7.273" cy="12.026" fill="#fff" rx="3.818" ry="4.091" />
  </svg>
);

export const DefaultMailIcon = () => (
  <svg
    className="size-5"
    fill="none"
    stroke="currentColor"
    strokeLinecap="round"
    strokeLinejoin="round"
    strokeWidth="2"
    viewBox="0 0 24 24"
  >
    <rect height="16" rx="2" width="20" x="2" y="4" />
    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
  </svg>
);

export function EmailCard({ content, className }: EmailCardProps) {
  const [copied, setCopied] = useState(false);
  const [showDropdown, setShowDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const isMobile = useIsMobile();

  const parsedEmail = useMemo(() => parseEmail(content), [content]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showDropdown]);

  if (!parsedEmail) {
    return null;
  }

  const handleCopy = async () => {
    try {
      const textToCopy = `Subject: ${parsedEmail.subject}\n\n${parsedEmail.body}`;
      await navigator.clipboard.writeText(textToCopy);
      setCopied(true);
      toast.success("Email copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleOpenGmail = () => {
    window.open(createGmailUrl(parsedEmail), "_blank");
    setShowDropdown(false);
  };

  const handleOpenOutlook = () => {
    window.open(createOutlookUrl(parsedEmail), "_blank");
    setShowDropdown(false);
  };

  const handleOpenDefault = () => {
    window.location.href = createMailtoUrl(parsedEmail);
    setShowDropdown(false);
  };

  return (
    <div className={cn("email-card", className)}>
      <div className="email-card-header">
        <div className="email-card-label">
          <Mail className="size-4" />
          <span>Email</span>
        </div>
        <div className="email-card-actions">
          <button
            className="email-card-action-btn"
            onClick={handleCopy}
            title="Copy to clipboard"
            type="button"
          >
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
            {isMobile && (
              <span className="text-xs ml-1">{copied ? "Copied" : "Copy"}</span>
            )}
          </button>
          {!isMobile && (
            <div className="email-dropdown-container" ref={dropdownRef}>
              <button
                className="email-card-action-btn"
                onClick={() => setShowDropdown(!showDropdown)}
                title="Send email"
                type="button"
              >
                <Send className="size-4" />
              </button>
              {showDropdown && (
                <div className="email-dropdown">
                  <button
                    className="email-dropdown-item"
                    onClick={handleOpenGmail}
                    type="button"
                  >
                    <GmailIcon />
                    <span>Gmail</span>
                  </button>
                  <button
                    className="email-dropdown-item"
                    onClick={handleOpenOutlook}
                    type="button"
                  >
                    <OutlookIcon />
                    <span>Outlook</span>
                  </button>
                  <button
                    className="email-dropdown-item"
                    onClick={handleOpenDefault}
                    type="button"
                  >
                    <DefaultMailIcon />
                    <span>Default email app</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="email-card-divider" />

      <div className="email-card-subject">
        <span className="email-card-subject-label">Subject</span>
        <span className="email-card-subject-text">{parsedEmail.subject}</span>
      </div>

      <div className="email-card-divider" />

      <div className="email-card-body">
        {parsedEmail.body.split("\n").map((line, i) => (
          <p
            className={line.trim() === "" ? "email-card-body-empty" : ""}
            key={i}
          >
            {line || "\u00A0"}
          </p>
        ))}
      </div>
    </div>
  );
}

export function looksLikeEmail(text: string): boolean {
  return parseEmail(text) !== null;
}
