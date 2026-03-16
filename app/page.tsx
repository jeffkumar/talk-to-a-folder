import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import HeroGridBlocks from "@/components/landing/hero-grid-blocks";
import { auth } from "./(auth)/auth";

export const metadata: Metadata = {
  title: "Adventure Flow | Your AI Transformation Partner",
  description:
    "We set and execute your enterprise AI strategy at startup speed. Strategy, transformation, and engineering—so you win the AI native future.",
};

export default function LandingPage() {
  return (
    <Suspense fallback={<LandingPageContent />}>
      <AuthCheck />
    </Suspense>
  );
}

async function AuthCheck() {
  const session = await auth();

  if (session?.user) {
    redirect("/chat");
  }

  return <LandingPageContent />;
}

function LandingPageContent() {
  return (
    <div className="landing-page-bg min-h-dvh">
      {/* Header */}
      <header className="border-border border-b">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
          <a href="https://adventureflow.ai" className="flex items-center gap-3">
            <Image
              alt="Flowchat Logo"
              className="h-12 w-12 logo-invert"
              height={48}
              src="/af-logo.svg"
              unoptimized
              width={48}
            />
            <span className="font-semibold text-brand text-xl">
              Flowchat
            </span>
          </a>
          <nav className="flex items-center gap-4">
            <Link
              className="text-muted-foreground text-sm transition-colors hover:text-foreground"
              href="/login"
            >
              Sign In
            </Link>
            <Link
              className="rounded-lg bg-brand px-4 py-2 font-medium text-sm text-white transition-opacity hover:opacity-90"
              href="/contact"
            >
              Get Started
            </Link>
          </nav>
        </div>
      </header>

      {/* Hero Section */}
      <main className="mx-auto max-w-6xl px-6">
        <section className="relative py-20 text-center md:py-32">
          <div className="hero-radial" aria-hidden="true" />
          <div className="hero-grid" aria-hidden="true" />
          <HeroGridBlocks />
          <div className="pointer-events-none relative z-10">
            <div className="landing-badge mb-6 inline-flex items-center gap-2 rounded-full px-4 py-2 font-medium text-brand text-sm">
              Agents for Product Managers
            </div>
            <h1 className="mb-6 font-bold text-4xl text-foreground leading-tight md:text-6xl">
              Know What to Build.
              <br />
              <span className="text-brand">Build It Faster.</span>
            </h1>
            <p className="mx-auto mb-8 max-w-2xl text-lg text-muted-foreground md:text-xl">
              Organize your projects, surface insights from your docs, and
              prioritize what matters. Flowchat keeps your context so you can
              focus on strategy.
            </p>
            <div className="pointer-events-auto flex flex-col items-center justify-center gap-4 sm:flex-row">
              <Link className="landing-cta-primary" href="/register">
                Get Early Access →
              </Link>
              <Link
                className="rounded-lg border border-border px-8 py-3 font-medium text-base text-foreground transition-colors hover:bg-muted"
                href="/login"
              >
                Sign In
              </Link>
            </div>
            <p className="mt-8 text-muted-foreground text-sm">
              Built by PMs who&apos;ve lived the pain. Currently in private beta
              with product &amp; project teams.
            </p>
          </div>
        </section>

        {/* Slide Deck Preview Section */}
        <section className="py-12">
          <div className="mb-8 text-center">
            <h2 className="mb-3 font-semibold text-2xl text-foreground md:text-3xl">
              From Context to Action
            </h2>
            <p className="mx-auto max-w-xl text-muted-foreground">
              Generate slide decks, updates, and reports, all grounded in your
              project&apos;s shared context
            </p>
          </div>
          <div className="app-preview-container">
            <div className="app-preview-window">
              <div className="app-preview-titlebar">
                <div className="app-preview-dots">
                  <span className="app-preview-dot app-preview-dot-red" />
                  <span className="app-preview-dot app-preview-dot-yellow" />
                  <span className="app-preview-dot app-preview-dot-green" />
                </div>
                <span className="app-preview-title">
                  Flowchat - Mesa Wind Farm
                </span>
              </div>

              <div className="app-preview-content">
                <div className="app-preview-sidebar">
                  <div className="app-preview-sidebar-header">
                    <div className="app-preview-logo">
                      <Image
                        alt=""
                        height={20}
                        src="/af-logo.svg"
                        unoptimized
                        width={20}
                      />
                    </div>
                    <span>Flowchat</span>
                  </div>
                  <div className="app-preview-nav">
                    <div className="app-preview-nav-item">
                      <svg
                        aria-hidden="true"
                        className="app-preview-nav-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <title>Chat</title>
                        <path
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        />
                      </svg>
                      Project Chat
                    </div>
                    <div className="app-preview-nav-item">
                      <svg
                        aria-hidden="true"
                        className="app-preview-nav-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <title>Files</title>
                        <path
                          d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        />
                      </svg>
                      Files
                    </div>
                    <div className="app-preview-nav-section">
                      Workflow Agents
                    </div>
                    <div className="app-preview-nav-item app-preview-nav-active">
                      <span className="app-preview-agent-icon">📊</span>
                      Slide Deck Builder
                    </div>
                    <div className="app-preview-nav-item">
                      <span className="app-preview-agent-icon">⭐</span>
                      Rockstar Emails
                    </div>
                    <div className="app-preview-nav-item">
                      <span className="app-preview-agent-icon">📝</span>
                      RFP Responder
                    </div>
                  </div>
                </div>

                <div className="app-preview-chat">
                  <div className="app-preview-agent-header">
                    <span className="app-preview-agent-badge app-preview-agent-badge-blue">
                      📊
                    </span>
                    <div>
                      <div className="app-preview-agent-name">
                        Slide Deck Builder
                      </div>
                      <div className="app-preview-agent-desc">
                        Generate presentations from project docs
                      </div>
                    </div>
                  </div>
                  <div className="app-preview-messages">
                    <div className="app-preview-message app-preview-message-user">
                      <div className="app-preview-bubble app-preview-bubble-user">
                        Create a 6-slide investor update for Mesa Wind Farm.
                        Include timeline, budget status, and key milestones from
                        Q4
                      </div>
                    </div>
                    <div className="app-preview-message app-preview-message-ai">
                      <div className="app-preview-avatar app-preview-avatar-ocr">
                        📊
                      </div>
                      <div className="app-preview-bubble app-preview-bubble-ai">
                        <p className="app-preview-ai-title">
                          Investor Update: Mesa Wind Farm
                        </p>
                        <div className="app-preview-ocr-badge">
                          <span>📄 6 sources</span>
                          <span>6 slides generated</span>
                        </div>
                        <div className="app-preview-slides-preview">
                          <div className="app-preview-slide">
                            <span className="app-preview-slide-num">1</span>
                            <span>Title &amp; Project Overview</span>
                          </div>
                          <div className="app-preview-slide">
                            <span className="app-preview-slide-num">2</span>
                            <span>Construction Timeline</span>
                          </div>
                          <div className="app-preview-slide">
                            <span className="app-preview-slide-num">3</span>
                            <span>Budget vs. Actuals</span>
                          </div>
                          <div className="app-preview-slide">
                            <span className="app-preview-slide-num">4</span>
                            <span>Q4 Milestones Achieved</span>
                          </div>
                          <div className="app-preview-slide">
                            <span className="app-preview-slide-num">5</span>
                            <span>Risk &amp; Mitigation</span>
                          </div>
                          <div className="app-preview-slide">
                            <span className="app-preview-slide-num">6</span>
                            <span>Next Steps &amp; Q1 Outlook</span>
                          </div>
                        </div>
                        <div className="app-preview-citations">
                          <span className="app-preview-citation">
                            📄 Q4_Budget_Report.xlsx
                          </span>
                          <span className="app-preview-citation">
                            📄 Construction_Schedule.pdf
                          </span>
                        </div>
                        <div className="app-preview-actions">
                          <span className="app-preview-action">
                            Open Slides
                          </span>
                          <span className="app-preview-action">
                            Export to PowerPoint
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="app-preview-input">
                    <span>Describe the deck you need...</span>
                    <div className="app-preview-input-buttons">
                      <span className="app-preview-input-icon">📎</span>
                      <span className="app-preview-input-send">↑</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Email Agent Preview Section */}
        <section className="py-12">
          <div className="mb-8 text-center">
            <h2 className="mb-3 font-semibold text-2xl text-foreground md:text-3xl">
              Emails That Write Themselves
            </h2>
            <p className="mx-auto max-w-xl text-muted-foreground">
              Draft professional emails using your documents as context. No more
              copy-pasting or context-switching
            </p>
          </div>
          <div className="app-preview-container">
            <div className="app-preview-window">
              <div className="app-preview-titlebar">
                <div className="app-preview-dots">
                  <span className="app-preview-dot app-preview-dot-red" />
                  <span className="app-preview-dot app-preview-dot-yellow" />
                  <span className="app-preview-dot app-preview-dot-green" />
                </div>
                <span className="app-preview-title">
                  Flowchat - Sunrise Solar Farm
                </span>
              </div>

              <div className="app-preview-content">
                <div className="app-preview-sidebar">
                  <div className="app-preview-sidebar-header">
                    <div className="app-preview-logo">
                      <Image
                        alt=""
                        height={20}
                        src="/af-logo.svg"
                        unoptimized
                        width={20}
                      />
                    </div>
                    <span>Flowchat</span>
                  </div>
                  <div className="app-preview-nav">
                    <div className="app-preview-nav-item">
                      <svg
                        aria-hidden="true"
                        className="app-preview-nav-icon"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <title>Chat</title>
                        <path
                          d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                        />
                      </svg>
                      Project Chat
                    </div>
                    <div className="app-preview-nav-section">
                      Workflow Agents
                    </div>
                    <div className="app-preview-nav-item app-preview-nav-active">
                      <span className="app-preview-agent-icon">📧</span>
                      Email Composer
                    </div>
                    <div className="app-preview-nav-item">
                      <span className="app-preview-agent-icon">📊</span>
                      Slide Deck Builder
                    </div>
                    <div className="app-preview-nav-item">
                      <span className="app-preview-agent-icon">📝</span>
                      Meeting Summary
                    </div>
                  </div>
                </div>

                <div className="app-preview-chat">
                  <div className="app-preview-agent-header">
                    <span className="app-preview-agent-badge app-preview-agent-badge-purple">
                      📧
                    </span>
                    <div>
                      <div className="app-preview-agent-name">
                        Email Composer
                      </div>
                      <div className="app-preview-agent-desc">
                        Draft emails using your project docs
                      </div>
                    </div>
                  </div>
                  <div className="app-preview-messages">
                    <div className="app-preview-message app-preview-message-user">
                      <div className="app-preview-bubble app-preview-bubble-user">
                        Draft a follow-up email to the county planning
                        department about our permit timeline.                         Reference the docs
                        from last week&apos;s call
                      </div>
                    </div>
                    <div className="app-preview-message app-preview-message-ai">
                      <div className="app-preview-avatar app-preview-avatar-email">
                        📧
                      </div>
                      <div className="app-preview-bubble app-preview-bubble-ai">
                        <div className="app-preview-ocr-badge app-preview-ocr-badge-purple">
                          <span>📝 2 docs referenced</span>
                          <span>Draft generated</span>
                        </div>
                        <div className="app-preview-email-preview">
                          <div className="app-preview-email-field">
                            <span className="app-preview-email-label">To:</span>
                            <span>planning@sunrisecounty.gov</span>
                          </div>
                          <div className="app-preview-email-field">
                            <span className="app-preview-email-label">
                              Subject:
                            </span>
                            <span>
                              Follow-up: Sunrise Solar Farm CUP Application
                              Timeline
                            </span>
                          </div>
                          <div className="app-preview-email-body">
                            <p>Dear Planning Team,</p>
                            <p>
                              Following up on our call last Thursday regarding
                              the Conditional Use Permit for the Sunrise Solar
                              Farm project (Application #2026-0142).
                            </p>
                            <p>
                              As discussed, we&apos;ve submitted the updated
                              environmental impact assessment addressing the
                              stormwater concerns you raised. Could you confirm
                              the next hearing date is still scheduled for
                              February 28th?
                            </p>
                            <p>
                              Best regards,
                              <br />
                              Sarah Chen
                            </p>
                          </div>
                        </div>
                        <div className="app-preview-citations app-preview-citations-purple">
                          <span className="app-preview-citation">
                            📄 Planning Call Notes (Jan 30)
                          </span>
                          <span className="app-preview-citation">
                            📄 CUP Requirements Summary
                          </span>
                        </div>
                        <div className="app-preview-actions">
                          <span className="app-preview-action">
                            Copy to Clipboard
                          </span>
                          <span className="app-preview-action">Edit Draft</span>
                        </div>
                      </div>
                    </div>
                  </div>
                  <div className="app-preview-input">
                    <span>Describe the email you need...</span>
                    <div className="app-preview-input-buttons">
                      <span className="app-preview-input-icon">📎</span>
                      <span className="app-preview-input-send">↑</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Features Section */}
        <section className="border-border border-t py-16">
          <h2 className="mb-4 text-center font-semibold text-2xl text-foreground md:text-3xl">
            AI That Knows Your Project
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
            ChatGPT forgets everything between sessions. Flowchat keeps your
            context so every conversation builds on the last.
          </p>
          <div className="grid gap-8 md:grid-cols-3">
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="landing-icon-bg mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                <svg
                  aria-hidden="true"
                  className="h-6 w-6 text-brand"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>Organize Icon</title>
                  <path
                    d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </div>
              <h3 className="mb-2 font-semibold text-foreground text-lg">
                Organize Everything
              </h3>
              <p className="text-muted-foreground text-sm">
                Docs, contracts, specs—all in one place. Flowchat indexes
                everything with OCR and semantic search so nothing gets lost.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <div className="landing-icon-bg mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                <svg
                  aria-hidden="true"
                  className="h-6 w-6 text-brand"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>Strategy Icon</title>
                  <path
                    d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </div>
              <h3 className="mb-2 font-semibold text-foreground text-lg">
                Surface What Matters
              </h3>
              <p className="text-muted-foreground text-sm">
                AI that reads your docs and helps you see patterns, gaps, and
                priorities. Stop digging—start deciding.
              </p>
            </div>

            <div className="rounded-xl border border-border bg-card p-6">
              <div className="landing-icon-bg mb-4 flex h-12 w-12 items-center justify-center rounded-lg">
                <svg
                  aria-hidden="true"
                  className="h-6 w-6 text-brand"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <title>Execute Icon</title>
                  <path
                    d="M13 10V3L4 14h7v7l9-11h-7z"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                  />
                </svg>
              </div>
              <h3 className="mb-2 font-semibold text-foreground text-lg">
                Execute Faster
              </h3>
              <p className="text-muted-foreground text-sm">
                Turn decisions into action. Generate emails, decks, and updates
                grounded in your project context—not generic templates.
              </p>
            </div>
          </div>
        </section>

        {/* Privacy Section */}
        <section className="border-border border-t py-16">
          <div className="mx-auto max-w-4xl">
            <div className="flex flex-col items-center gap-8 md:flex-row md:gap-12">
              <div className="flex-shrink-0">
                <div className="landing-icon-bg flex h-20 w-20 items-center justify-center rounded-2xl">
                  <svg
                    aria-hidden="true"
                    className="h-10 w-10 text-brand"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <title>Privacy Icon</title>
                    <path
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                    />
                  </svg>
                </div>
              </div>
              <div className="text-center md:text-left">
                <h2 className="mb-3 font-semibold text-2xl text-foreground md:text-3xl">
                  Your Choice, Your Control
                </h2>
                <p className="mb-4 text-muted-foreground">
                  Use the latest models from Anthropic and OpenAI for
                  best-in-class performance—or keep your data fully private with
                  self-hosted inference. Your documents never train anyone
                  else&apos;s models.
                </p>
                <p className="text-muted-foreground text-sm">
                  Private embeddings powered by{" "}
                  <a
                    className="font-medium text-foreground transition-colors hover:text-brand"
                    href="https://turbopuffer.com/"
                    rel="noopener"
                    target="_blank"
                  >
                    Turbopuffer
                  </a>
                  . Optional private inference via{" "}
                  <a
                    className="font-medium text-foreground transition-colors hover:text-brand"
                    href="https://www.baseten.co/"
                    rel="noopener"
                    target="_blank"
                  >
                    Baseten
                  </a>
                  .
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Problem Statement Section */}
        <section className="border-border border-t py-16">
          <h2 className="mb-4 text-center font-semibold text-2xl text-foreground md:text-3xl">
            The Problem We&apos;re Solving
          </h2>
          <p className="mx-auto mb-12 max-w-2xl text-center text-muted-foreground">
            Product and project managers spend more time organizing information
            than making decisions. We think AI should change that.
          </p>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
            <div className="landing-problem-card rounded-xl p-6">
              <div className="mb-3 text-3xl">🎯</div>
              <h3 className="mb-2 font-semibold text-foreground text-lg">
                Unclear Priorities
              </h3>
              <p className="text-muted-foreground text-sm">
                Everything feels urgent. Stakeholder requests pile up. Without
                clear context, it&apos;s hard to know what actually moves the
                needle.
              </p>
            </div>
            <div className="landing-problem-card rounded-xl p-6">
              <div className="mb-3 text-3xl">🧠</div>
              <h3 className="mb-2 font-semibold text-foreground text-lg">
                Lost Context
              </h3>
              <p className="text-muted-foreground text-sm">
                Every project has its own history, decisions, and nuances.
                Switching between them means losing your place—every single
                time.
              </p>
            </div>
            <div className="landing-problem-card rounded-xl p-6">
              <div className="mb-3 text-3xl">🔄</div>
              <h3 className="mb-2 font-semibold text-foreground text-lg">
                Scattered Information
              </h3>
              <p className="text-muted-foreground text-sm">
                Requirements in Notion, feedback in Slack, specs in Google Docs.
                You spend hours hunting for the source of truth.
              </p>
            </div>
            <div className="landing-problem-card rounded-xl p-6">
              <div className="mb-3 text-3xl">⏳</div>
              <h3 className="mb-2 font-semibold text-foreground text-lg">
                Busywork Over Strategy
              </h3>
              <p className="text-muted-foreground text-sm">
                Status updates, decks, emails—the admin work never ends. You
                became a PM to make decisions, not format slides.
              </p>
            </div>
          </div>
        </section>

      </main>

      {/* CTA Section */}
      <section className="landing-cta-section border-border border-t py-20">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="mb-4 font-bold text-3xl text-foreground md:text-4xl">
            Stop Managing. Start Deciding.
          </h2>
          <p className="mb-8 text-lg text-muted-foreground">
            Flowchat gives you clarity on what to build and helps you execute.
            AI that keeps your project context—with the models you choose.
          </p>
          <Link className="landing-cta-primary" href="/register">
            Get Early Access →
          </Link>
          <p className="mt-6 text-muted-foreground text-sm">
            Currently in private beta with product &amp; project teams. Bring
            your own data—we&apos;ll show you what Flowchat can do.
          </p>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-border border-t">
        <div className="mx-auto max-w-6xl px-6 py-12">
          <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
            <div className="flex items-center gap-3">
              <Image
                alt="Flowchat Logo"
                className="h-8 w-8 logo-invert"
                height={32}
                src="/af-logo.svg"
                unoptimized
                width={32}
              />
              <span className="font-semibold text-brand text-lg">Flowchat</span>
            </div>
            <div className="flex items-center gap-6 text-muted-foreground text-sm">
              <Link
                className="transition-colors hover:text-foreground"
                href="/privacy"
              >
                Privacy Policy
              </Link>
              <Link
                className="transition-colors hover:text-foreground"
                href="/terms"
              >
                Terms of Service
              </Link>
              <a
                className="transition-colors hover:text-foreground"
                href="mailto:jeff@adventureflow.ai"
              >
                Contact
              </a>
            </div>
          </div>
          <p className="mt-8 text-center text-muted-foreground text-xs">
            © 2026 Adventure Flow. All rights reserved.
          </p>
        </div>
      </footer>
    </div>
  );
}
