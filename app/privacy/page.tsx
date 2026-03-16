import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Privacy Policy | Flowchat",
  description:
    "Privacy Policy for Flowchat - Learn how we collect, use, and protect your data.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-background">
      <div className="mx-auto max-w-3xl px-6 py-16 md:py-24">
        <header className="mb-12">
          <Link
            className="mb-8 inline-flex items-center gap-2 text-muted-foreground transition-colors hover:text-foreground"
            href="/"
          >
            <svg
              aria-hidden="true"
              fill="none"
              height="16"
              viewBox="0 0 16 16"
              width="16"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M10 12L6 8L10 4"
                stroke="currentColor"
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="1.5"
              />
            </svg>
            Back to Flowchat
          </Link>
          <h1 className="mb-4 font-semibold text-4xl text-brand">
            Privacy Policy
          </h1>
          <p className="text-muted-foreground">
            Last updated: February 3, 2026
          </p>
        </header>

        <article className="privacy-content space-y-8">
          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              1. Introduction
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Welcome to Flowchat. We respect your privacy and are committed to
              protecting your personal data. This privacy policy explains how we
              collect, use, disclose, and safeguard your information when you
              use our service.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              2. Information We Collect
            </h2>
            <p className="mb-4 text-muted-foreground leading-relaxed">
              We collect information that you provide directly to us, including:
            </p>
            <ul className="ml-4 list-inside list-disc space-y-2 text-muted-foreground">
              <li>Account information (name, email address, password)</li>
              <li>Project and document data you upload or create</li>
              <li>Communications and interactions with our AI assistants</li>
              <li>Usage data and analytics</li>
              <li>
                Integration credentials for connected services (Google Drive,
                OneDrive, etc.)
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              3. How We Use Your Information
            </h2>
            <p className="mb-4 text-muted-foreground leading-relaxed">
              We use the information we collect to:
            </p>
            <ul className="ml-4 list-inside list-disc space-y-2 text-muted-foreground">
              <li>Provide, maintain, and improve our services</li>
              <li>Process and complete transactions</li>
              <li>Send you technical notices and support messages</li>
              <li>Respond to your comments and questions</li>
              <li>Develop new features and services</li>
              <li>Monitor and analyze trends, usage, and activities</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              4. Data Storage and Security
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We implement appropriate technical and organizational security
              measures to protect your personal data against accidental or
              unlawful destruction, loss, alteration, unauthorized disclosure,
              or access. Your data is stored on secure servers and encrypted
              both in transit and at rest.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              5. Third-Party Services
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Our service may integrate with third-party services such as Google
              Drive, Microsoft OneDrive, and AI providers. When you connect
              these services, we access only the data necessary to provide our
              features. Each third-party service has its own privacy policy
              governing their data practices.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              6. Data Retention
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We retain your personal data only for as long as necessary to
              fulfill the purposes for which it was collected, including to
              satisfy legal, accounting, or reporting requirements. When you
              delete your account, we will delete or anonymize your personal
              data within 30 days.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              7. Your Rights
            </h2>
            <p className="mb-4 text-muted-foreground leading-relaxed">
              Depending on your location, you may have the following rights
              regarding your personal data:
            </p>
            <ul className="ml-4 list-inside list-disc space-y-2 text-muted-foreground">
              <li>Access and receive a copy of your data</li>
              <li>Rectify or update inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict processing of your data</li>
              <li>Data portability</li>
              <li>Withdraw consent at any time</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              8. Cookies and Tracking
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We use cookies and similar tracking technologies to track activity
              on our service and hold certain information. You can instruct your
              browser to refuse all cookies or to indicate when a cookie is
              being sent. However, if you do not accept cookies, you may not be
              able to use some portions of our service.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              9. Children&apos;s Privacy
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Our service is not intended for children under 13 years of age. We
              do not knowingly collect personal information from children under
              13. If we become aware that we have collected personal data from a
              child under 13, we will take steps to delete that information.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              10. Changes to This Policy
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We may update this privacy policy from time to time. We will
              notify you of any changes by posting the new privacy policy on
              this page and updating the &quot;Last updated&quot; date. You are
              advised to review this privacy policy periodically for any
              changes.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              11. Contact Us
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about this privacy policy or our data
              practices, please contact us at{" "}
              <a
                className="text-brand hover:underline"
                href="mailto:jeff@adventureflow.ai"
              >
                jeff@adventureflow.ai
              </a>
              .
            </p>
          </section>
        </article>

        <footer className="mt-16 border-border border-t pt-8">
          <div className="flex flex-col items-center justify-between gap-4 text-muted-foreground text-sm sm:flex-row">
            <p>© 2026 Flowchat. All rights reserved.</p>
            <div className="flex gap-6">
              <Link
                className="transition-colors hover:text-foreground"
                href="/login"
              >
                Sign In
              </Link>
              <Link
                className="transition-colors hover:text-foreground"
                href="/register"
              >
                Sign Up
              </Link>
            </div>
          </div>
        </footer>
      </div>
    </div>
  );
}
