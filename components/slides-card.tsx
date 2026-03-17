"use client";

import {
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  FileText,
  Loader2,
  Presentation,
} from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type SlidesLoadingCardProps = {
  title?: string;
  className?: string;
};

export function SlidesLoadingCard({
  title = "Presentation",
  className,
}: SlidesLoadingCardProps) {
  return (
    <div
      className={cn(
        "slides-card overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-border border-b bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
          <Presentation className="size-4" />
          <span>Deck</span>
        </div>
      </div>

      {/* Loading Content */}
      <div className="flex min-h-[200px] flex-col items-center justify-center gap-4 p-6">
        <Loader2 className="size-8 animate-spin text-primary" />
        <div className="text-center">
          <p className="font-medium text-foreground">Creating deck</p>
          <p className="mt-1 text-muted-foreground text-sm">{title}</p>
        </div>
      </div>

      {/* Footer placeholder */}
      <div className="flex items-center justify-center border-border border-t bg-muted/30 px-4 py-2">
        <div className="flex gap-1.5">
          {[0, 1, 2].map((i) => (
            <div
              className="size-2 animate-pulse rounded-full bg-muted-foreground/30"
              key={i}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

type Slide = {
  title: string;
  bullets: string[];
  notes?: string;
  imageUrl?: string;
  imageCaption?: string;
};

type SlidesData = {
  slides: Slide[];
};

type SlidesCardProps = {
  content: string;
  className?: string;
};

/**
 * Extract JSON from text that may contain surrounding content or markdown code blocks.
 * Handles cases like:
 * - Pure JSON: {"slides": [...]}
 * - Code blocks: ```json\n{"slides": [...]}\n```
 * - Text with JSON: "Here are your slides:\n{"slides": [...]}"
 */
function extractSlidesJson(text: string): string | null {
  if (!text) {
    return null;
  }

  // First, try to strip markdown code block wrappers
  let cleaned = text.trim();

  // Remove ```json or ``` at start
  const codeBlockStart = /^```(?:json)?\s*\n?/i;
  if (codeBlockStart.test(cleaned)) {
    cleaned = cleaned.replace(codeBlockStart, "");
  }

  // Remove ``` at end
  const codeBlockEnd = /\n?```\s*$/;
  if (codeBlockEnd.test(cleaned)) {
    cleaned = cleaned.replace(codeBlockEnd, "");
  }

  cleaned = cleaned.trim();

  // If it now starts with {, try direct parse
  if (cleaned.startsWith("{")) {
    return cleaned;
  }

  // Otherwise, look for {"slides": pattern and extract using brace matching
  const slidesStart = cleaned.indexOf('{"slides"');
  if (slidesStart === -1) {
    // Also try with single quotes or no quotes (less common but possible)
    const altStart = cleaned.indexOf('{"slides"');
    if (altStart === -1) {
      return null;
    }
  }

  const startIndex = cleaned.indexOf('{"slides"');
  if (startIndex === -1) {
    return null;
  }

  // Extract JSON object using brace matching
  let braceCount = 0;
  let inString = false;
  let escapeNext = false;
  let endIndex = -1;

  for (let i = startIndex; i < cleaned.length; i++) {
    const char = cleaned[i];

    if (escapeNext) {
      escapeNext = false;
      continue;
    }

    if (char === "\\") {
      escapeNext = true;
      continue;
    }

    if (char === '"' && !escapeNext) {
      inString = !inString;
      continue;
    }

    if (!inString) {
      if (char === "{") {
        braceCount++;
      } else if (char === "}") {
        braceCount--;
        if (braceCount === 0) {
          endIndex = i + 1;
          break;
        }
      }
    }
  }

  if (endIndex === -1) {
    return null;
  }

  return cleaned.slice(startIndex, endIndex);
}

function parseSlides(text: string): SlidesData | null {
  if (!text) {
    return null;
  }

  // First try direct parse (fastest path for well-formed input)
  try {
    const parsed = JSON.parse(text.trim());
    if (parsed && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
      return parsed as SlidesData;
    }
  } catch {
    // Direct parse failed, try extraction
  }

  // Try to extract JSON from surrounding text
  const extracted = extractSlidesJson(text);
  if (!extracted) {
    return null;
  }

  try {
    const parsed = JSON.parse(extracted);
    if (parsed && Array.isArray(parsed.slides) && parsed.slides.length > 0) {
      return parsed as SlidesData;
    }
    return null;
  } catch {
    return null;
  }
}

function slidesToMarkdown(slidesData: SlidesData): string {
  if (!slidesData || slidesData.slides.length === 0) {
    return "";
  }

  const lines: string[] = [];
  for (const slide of slidesData.slides) {
    lines.push(`## ${slide.title}`);
    lines.push("");
    for (const bullet of slide.bullets) {
      lines.push(`- ${bullet}`);
    }
    if (slide.notes) {
      lines.push("");
      lines.push(`> ${slide.notes}`);
    }
    lines.push("");
  }
  return lines.join("\n");
}

export function SlidesCard({ content, className }: SlidesCardProps) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [copied, setCopied] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const slidesData = useMemo(() => parseSlides(content), [content]);

  // Reset to first slide when content changes
  useEffect(() => {
    setCurrentIndex(0);
  }, []);

  if (!slidesData || slidesData.slides.length === 0) {
    return null;
  }

  const slides = slidesData.slides;
  const totalSlides = slides.length;
  const currentSlide = slides[currentIndex];

  const goToPrevious = () => {
    setCurrentIndex((prev) => Math.max(0, prev - 1));
  };

  const goToNext = () => {
    setCurrentIndex((prev) => Math.min(totalSlides - 1, prev + 1));
  };

  const goToSlide = (index: number) => {
    setCurrentIndex(index);
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(content);
      setCopied(true);
      toast.success("Deck JSON copied to clipboard");
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Failed to copy");
    }
  };

  const handleCopyMarkdown = async () => {
    try {
      const markdown = slidesToMarkdown(slidesData);
      await navigator.clipboard.writeText(markdown);
      toast.success("Deck copied as Markdown");
    } catch {
      toast.error("Failed to copy");
    }
  };

  const canGoPrevious = currentIndex > 0;
  const canGoNext = currentIndex < totalSlides - 1;

  return (
    <div
      className={cn(
        "slides-card overflow-hidden rounded-xl border border-border bg-card shadow-sm",
        className
      )}
      ref={containerRef}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-border border-b bg-muted/30 px-4 py-2">
        <div className="flex items-center gap-2 font-medium text-muted-foreground text-sm">
          <Presentation className="size-4" />
          <span>Deck</span>
          <span className="text-xs">
            ({currentIndex + 1} of {totalSlides})
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={handleCopyMarkdown}
            title="Copy as Markdown"
            type="button"
          >
            <FileText className="size-4" />
          </button>
          <button
            className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            onClick={handleCopy}
            title="Copy JSON"
            type="button"
          >
            {copied ? (
              <Check className="size-4" />
            ) : (
              <Copy className="size-4" />
            )}
          </button>
        </div>
      </div>

      {/* Slide Content */}
      <div className="relative min-h-[200px] p-6">
        {/* Slide Title */}
        <h3 className="mb-4 font-bold text-foreground text-xl tracking-tight">
          {currentSlide.title}
        </h3>

        {/* Slide Content - Bullets and Image */}
        <div
          className={cn(
            "flex gap-6",
            currentSlide.imageUrl ? "flex-row" : "flex-col"
          )}
        >
          {/* Bullets */}
          {currentSlide.bullets && currentSlide.bullets.length > 0 && (
            <ul
              className={cn("space-y-2", currentSlide.imageUrl ? "flex-1" : "")}
            >
              {currentSlide.bullets.map((bullet, i) => (
                <li
                  className="flex items-start gap-2 text-foreground text-sm"
                  key={i}
                >
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{bullet}</span>
                </li>
              ))}
            </ul>
          )}

          {/* Image */}
          {currentSlide.imageUrl && (
            <div
              className="flex shrink-0 flex-col items-center gap-2"
              style={{ maxWidth: "40%" }}
            >
              <img
                alt={currentSlide.imageCaption || currentSlide.title}
                className="max-h-40 rounded-lg border object-contain shadow-sm"
                src={currentSlide.imageUrl}
              />
              {currentSlide.imageCaption && (
                <p className="text-center text-muted-foreground text-xs">
                  {currentSlide.imageCaption}
                </p>
              )}
            </div>
          )}
        </div>

        {/* Speaker Notes */}
        {currentSlide.notes && (
          <div className="mt-4 border-border/50 border-t pt-3">
            <p className="text-muted-foreground text-xs italic">
              {currentSlide.notes}
            </p>
          </div>
        )}
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between border-border border-t bg-muted/30 px-4 py-2">
        {/* Previous Button */}
        <button
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 font-medium text-sm transition-colors",
            canGoPrevious
              ? "text-foreground hover:bg-muted"
              : "cursor-not-allowed text-muted-foreground/50"
          )}
          disabled={!canGoPrevious}
          onClick={goToPrevious}
          type="button"
        >
          <ChevronLeft className="size-4" />
          <span className="hidden sm:inline">Prev</span>
        </button>

        {/* Slide Indicators */}
        <div className="flex gap-1.5">
          {slides.map((_, i) => (
            <button
              aria-label={`Go to slide ${i + 1}`}
              className={cn(
                "size-2 rounded-full transition-all",
                i === currentIndex
                  ? "w-5 bg-primary"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              key={i}
              onClick={() => goToSlide(i)}
              type="button"
            />
          ))}
        </div>

        {/* Next Button */}
        <button
          className={cn(
            "flex items-center gap-1 rounded-md px-2 py-1 font-medium text-sm transition-colors",
            canGoNext
              ? "text-foreground hover:bg-muted"
              : "cursor-not-allowed text-muted-foreground/50"
          )}
          disabled={!canGoNext}
          onClick={goToNext}
          type="button"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRight className="size-4" />
        </button>
      </div>
    </div>
  );
}

// Export a utility to check if content looks like slides JSON
export function looksLikeSlides(text: string): boolean {
  return parseSlides(text) !== null;
}
