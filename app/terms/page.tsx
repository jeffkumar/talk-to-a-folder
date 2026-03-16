import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service | Flowchat",
  description:
    "Terms of Service for Flowchat - Read our terms and conditions for using our service.",
};

export default function TermsPage() {
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
              <title>Back arrow</title>
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
            Terms of Service
          </h1>
          <p className="text-muted-foreground">
            Last updated: February 3, 2026
          </p>
        </header>

        <article className="terms-content space-y-8">
          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              1. Acceptance of Terms
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              By accessing or using Flowchat, you agree to be bound by these
              Terms of Service and all applicable laws and regulations. If you
              do not agree with any of these terms, you are prohibited from
              using or accessing this service. These terms apply to all users,
              including visitors, registered users, and contributors.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              2. Description of Service
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Flowchat provides an AI-powered document management and
              collaboration platform that enables users to create, edit,
              organize, and interact with documents using artificial
              intelligence. Our service includes features such as document
              creation, AI-assisted editing, file storage, and integrations with
              third-party services.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              3. User Accounts
            </h2>
            <p className="mb-4 text-muted-foreground leading-relaxed">
              To access certain features of Flowchat, you must create an
              account. You agree to:
            </p>
            <ul className="ml-4 list-inside list-disc space-y-2 text-muted-foreground">
              <li>
                Provide accurate, current, and complete information during
                registration
              </li>
              <li>Maintain and promptly update your account information</li>
              <li>Keep your password secure and confidential</li>
              <li>
                Accept responsibility for all activities that occur under your
                account
              </li>
              <li>
                Notify us immediately of any unauthorized use of your account
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              4. Acceptable Use
            </h2>
            <p className="mb-4 text-muted-foreground leading-relaxed">
              You agree not to use Flowchat to:
            </p>
            <ul className="ml-4 list-inside list-disc space-y-2 text-muted-foreground">
              <li>Violate any applicable laws or regulations</li>
              <li>Infringe upon intellectual property rights of others</li>
              <li>Upload malicious code, viruses, or harmful content</li>
              <li>
                Attempt to gain unauthorized access to our systems or other
                users&apos; accounts
              </li>
              <li>Harass, abuse, or harm other users</li>
              <li>
                Generate or distribute illegal, harmful, or offensive content
              </li>
              <li>Interfere with or disrupt the service or servers</li>
              <li>
                Use automated means to access the service without our permission
              </li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              5. User Content
            </h2>
            <p className="mb-4 text-muted-foreground leading-relaxed">
              You retain ownership of any content you create, upload, or share
              through Flowchat. By using our service, you grant us a limited
              license to store, process, and display your content solely for the
              purpose of providing the service to you. You are solely
              responsible for:
            </p>
            <ul className="ml-4 list-inside list-disc space-y-2 text-muted-foreground">
              <li>The accuracy and legality of your content</li>
              <li>Ensuring you have the right to use and share your content</li>
              <li>Backing up your content</li>
            </ul>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              6. AI-Generated Content
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Flowchat uses artificial intelligence to assist with content
              creation and editing. AI-generated content is provided for
              informational purposes and should not be relied upon as
              professional, legal, medical, or financial advice. You are
              responsible for reviewing and verifying any AI-generated content
              before use. We do not guarantee the accuracy, completeness, or
              suitability of AI-generated content for any particular purpose.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              7. Intellectual Property
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              The Flowchat service, including its original content, features,
              and functionality, is owned by Flowchat and is protected by
              international copyright, trademark, patent, trade secret, and
              other intellectual property laws. Our trademarks and trade dress
              may not be used in connection with any product or service without
              our prior written consent.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              8. Third-Party Integrations
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              Flowchat may integrate with third-party services such as Google
              Drive, Microsoft OneDrive, and other platforms. Your use of these
              integrations is subject to the respective third-party terms of
              service. We are not responsible for the content, privacy policies,
              or practices of any third-party services.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              9. Service Availability
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We strive to provide reliable and uninterrupted access to
              Flowchat, but we do not guarantee that the service will be
              available at all times. We reserve the right to modify, suspend,
              or discontinue the service, temporarily or permanently, with or
              without notice. We shall not be liable to you or any third party
              for any modification, suspension, or discontinuance of the
              service.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              10. Limitation of Liability
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              To the maximum extent permitted by law, Flowchat and its
              affiliates, officers, directors, employees, and agents shall not
              be liable for any indirect, incidental, special, consequential, or
              punitive damages, including without limitation, loss of profits,
              data, use, goodwill, or other intangible losses, resulting from
              your access to or use of or inability to access or use the
              service.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              11. Disclaimer of Warranties
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              The service is provided on an &quot;as is&quot; and &quot;as
              available&quot; basis without any warranties of any kind, either
              express or implied, including but not limited to implied
              warranties of merchantability, fitness for a particular purpose,
              non-infringement, or course of performance.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              12. Indemnification
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              You agree to defend, indemnify, and hold harmless Flowchat and its
              affiliates, licensors, and service providers from and against any
              claims, liabilities, damages, judgments, awards, losses, costs,
              expenses, or fees arising out of or relating to your violation of
              these Terms of Service or your use of the service.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              13. Termination
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We may terminate or suspend your account and access to the service
              immediately, without prior notice or liability, for any reason
              whatsoever, including without limitation if you breach these Terms
              of Service. Upon termination, your right to use the service will
              immediately cease. All provisions of these terms which by their
              nature should survive termination shall survive.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              14. Governing Law
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              These Terms of Service shall be governed by and construed in
              accordance with the laws of the jurisdiction in which Flowchat
              operates, without regard to its conflict of law provisions. Any
              disputes arising under these terms shall be resolved in the courts
              of that jurisdiction.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              15. Changes to Terms
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              We reserve the right to modify or replace these Terms of Service
              at any time. If a revision is material, we will provide at least
              30 days&apos; notice prior to any new terms taking effect. What
              constitutes a material change will be determined at our sole
              discretion. By continuing to access or use our service after
              revisions become effective, you agree to be bound by the revised
              terms.
            </p>
          </section>

          <section>
            <h2 className="mb-4 font-semibold text-foreground text-xl">
              16. Contact Us
            </h2>
            <p className="text-muted-foreground leading-relaxed">
              If you have any questions about these Terms of Service, please
              contact us at{" "}
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
                href="/privacy"
              >
                Privacy Policy
              </Link>
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
