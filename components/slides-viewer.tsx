"use client";

import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react";
import { memo, useCallback, useEffect, useMemo, useState } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./ui/button";
import {
  Carousel,
  type CarouselApi,
  CarouselContent,
  CarouselItem,
} from "./ui/carousel";

export type Slide = {
  title: string;
  bullets: string[];
  notes?: string;
  imageUrl?: string;
  imageCaption?: string;
};

export type SlidesData = {
  slides: Slide[];
};

type SlidesViewerProps = {
  content: string;
  status: "streaming" | "idle";
  isCurrentVersion: boolean;
  currentVersionIndex: number;
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

export function safeParseSlides(content: string): SlidesData | null {
  if (!content) {
    return null;
  }

  // First try direct parse (fastest path for well-formed input)
  try {
    const parsed = JSON.parse(content.trim());
    if (parsed && Array.isArray(parsed.slides)) {
      return parsed as SlidesData;
    }
  } catch {
    // Direct parse failed, try extraction
  }

  // Try to extract JSON from surrounding text
  const extracted = extractSlidesJson(content);
  if (!extracted) {
    return null;
  }

  try {
    const parsed = JSON.parse(extracted);
    if (parsed && Array.isArray(parsed.slides)) {
      return parsed as SlidesData;
    }
    return null;
  } catch {
    return null;
  }
}

function SlideCard({
  slide,
  index,
  total,
  isActive,
}: {
  slide: Slide;
  index: number;
  total: number;
  isActive: boolean;
}) {
  return (
    <div
      className={cn(
        "slide-card flex h-full min-w-0 flex-col overflow-hidden rounded-lg border bg-card p-4 shadow-sm transition-all sm:p-6 md:p-8",
        isActive ? "ring-2 ring-primary" : ""
      )}
      style={{ wordBreak: "break-word" }}
    >
      <div className="mb-6 flex items-center justify-between">
        <span className="font-medium text-muted-foreground text-xs uppercase tracking-wider">
          Slide {index + 1} of {total}
        </span>
      </div>

      <h2 className="mb-6 break-words font-bold text-foreground text-xl tracking-tight sm:text-2xl md:text-3xl">
        {slide.title}
      </h2>

      <div
        className={cn(
          "flex flex-1 gap-6",
          slide.imageUrl ? "flex-row" : "flex-col"
        )}
      >
        {slide.bullets && slide.bullets.length > 0 && (
          <ul className={cn("space-y-3", slide.imageUrl ? "flex-1" : "")}>
            {slide.bullets.map((bullet, i) => (
              <li
                className="flex items-start gap-3 text-foreground text-sm sm:text-base md:text-lg"
                key={i}
              >
                <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary sm:mt-2" />
                <span className="break-words">{bullet}</span>
              </li>
            ))}
          </ul>
        )}

        {slide.imageUrl && (
          <div
            className="flex flex-col items-center gap-2"
            style={{ maxWidth: "40%" }}
          >
            <img
              alt={slide.imageCaption || slide.title}
              className="max-h-64 rounded-lg border object-contain shadow-sm"
              src={slide.imageUrl}
            />
            {slide.imageCaption && (
              <p className="text-center text-muted-foreground text-xs">
                {slide.imageCaption}
              </p>
            )}
          </div>
        )}
      </div>

      {slide.notes && (
        <div className="mt-6 border-t pt-4">
          <p className="break-words text-muted-foreground text-sm italic">
            {slide.notes}
          </p>
        </div>
      )}
    </div>
  );
}

function PureSlidesViewer({ content, status }: SlidesViewerProps) {
  const [api, setApi] = useState<CarouselApi>();
  const [currentSlideIndex, setCurrentSlideIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(false);

  const slidesData = useMemo(() => safeParseSlides(content), [content]);

  const slides = slidesData?.slides ?? [];
  const totalSlides = slides.length;

  // Sync carousel state with current slide index
  useEffect(() => {
    if (!api) {
      return;
    }

    const onSelect = () => {
      setCurrentSlideIndex(api.selectedScrollSnap());
      setCanScrollPrev(api.canScrollPrev());
      setCanScrollNext(api.canScrollNext());
    };

    onSelect();
    api.on("select", onSelect);
    api.on("reInit", onSelect);

    return () => {
      api.off("select", onSelect);
      api.off("reInit", onSelect);
    };
  }, [api]);

  // Reset to last slide if content shrinks
  useEffect(() => {
    if (api && currentSlideIndex >= totalSlides && totalSlides > 0) {
      api.scrollTo(totalSlides - 1);
    }
  }, [api, totalSlides, currentSlideIndex]);

  const goToPrevious = useCallback(() => {
    api?.scrollPrev();
  }, [api]);

  const goToNext = useCallback(() => {
    api?.scrollNext();
  }, [api]);

  const goToSlide = useCallback(
    (index: number) => {
      api?.scrollTo(index);
    },
    [api]
  );

  if (!slidesData || totalSlides === 0) {
    if (status === "streaming") {
      return (
        <div className="flex h-full items-center justify-center p-8">
          <div className="text-center">
            <div className="mx-auto mb-4 h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
            <p className="text-muted-foreground">Generating deck...</p>
          </div>
        </div>
      );
    }
    return (
      <div className="flex h-full items-center justify-center p-8">
        <p className="text-muted-foreground">No deck to display</p>
      </div>
    );
  }

  return (
    <div className="slides-viewer-container flex min-w-0 flex-col overflow-hidden">
      {/* Main slide display */}
      <div className="min-w-0 flex-1 overflow-hidden p-4">
        <Carousel className="mx-auto h-full min-w-0 max-w-4xl" setApi={setApi}>
          <CarouselContent className="h-full">
            {slides.map((slide, index) => (
              <CarouselItem className="h-full min-w-0" key={index}>
                <SlideCard
                  index={index}
                  isActive={index === currentSlideIndex}
                  slide={slide}
                  total={totalSlides}
                />
              </CarouselItem>
            ))}
          </CarouselContent>
        </Carousel>
      </div>

      {/* Navigation controls - using grid for reliable layout */}
      <div className="grid min-w-0 shrink-0 grid-cols-[auto_1fr_auto] items-center gap-2 border-t bg-muted/50 px-4 py-3">
        <Button
          className="gap-1"
          disabled={!canScrollPrev}
          onClick={goToPrevious}
          size="sm"
          variant="outline"
        >
          <ChevronLeftIcon className="h-4 w-4" />
          <span className="hidden sm:inline">Previous</span>
        </Button>

        {/* Slide indicator dots */}
        <div className="flex min-w-0 justify-center gap-1.5 overflow-hidden">
          {slides.map((_, i) => (
            <button
              aria-label={`Go to slide ${i + 1}`}
              className={cn(
                "h-2 w-2 shrink-0 rounded-full transition-all",
                i === currentSlideIndex
                  ? "w-6 bg-primary"
                  : "bg-muted-foreground/30 hover:bg-muted-foreground/50"
              )}
              key={i}
              onClick={() => goToSlide(i)}
              type="button"
            />
          ))}
        </div>

        <Button
          className="gap-1"
          disabled={!canScrollNext}
          onClick={goToNext}
          size="sm"
          variant="outline"
        >
          <span className="hidden sm:inline">Next</span>
          <ChevronRightIcon className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

function areEqual(prevProps: SlidesViewerProps, nextProps: SlidesViewerProps) {
  return (
    prevProps.currentVersionIndex === nextProps.currentVersionIndex &&
    prevProps.isCurrentVersion === nextProps.isCurrentVersion &&
    !(prevProps.status === "streaming" && nextProps.status === "streaming") &&
    prevProps.content === nextProps.content
  );
}

export const SlidesViewer = memo(PureSlidesViewer, areEqual);
