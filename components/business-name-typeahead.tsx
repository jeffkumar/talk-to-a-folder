"use client";

import { useEffect, useState } from "react";
import { useDebounceValue } from "usehooks-ts";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverAnchor,
  PopoverContent,
} from "@/components/ui/popover";

function normalizeBusinessName(value: string): string {
  return value.trim();
}

function includesCaseInsensitive(haystack: string, needle: string): boolean {
  return haystack.toLowerCase().includes(needle.toLowerCase());
}

function uniqueStrings(values: string[]): string[] {
  const out: string[] = [];
  const seen = new Set<string>();
  for (const value of values) {
    const v = value.trim();
    if (v.length === 0) {
      continue;
    }
    const key = v.toLowerCase();
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    out.push(v);
  }
  return out;
}

export function BusinessNameTypeahead({
  value,
  onChange,
  options,
  inputId,
  placeholder,
}: {
  value: string;
  onChange: (next: string) => void;
  options: string[];
  inputId: string;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);

  // Debounce the query used for filtering to prevent jitter while typing fast
  const [debouncedQuery, setDebouncedQuery] = useDebounceValue(
    normalizeBusinessName(value),
    300
  );

  useEffect(() => {
    setDebouncedQuery(normalizeBusinessName(value));
  }, [value, setDebouncedQuery]);

  const normalizedOptions = uniqueStrings(options);

  // Only show results if we have at least 2 characters
  const shouldFilter = debouncedQuery.length >= 2;

  const filtered = shouldFilter
    ? normalizedOptions
        .filter((name) => includesCaseInsensitive(name, debouncedQuery))
        .slice(0, 8)
    : [];

  const shouldShow = open && filtered.length > 0;

  return (
    <Popover onOpenChange={setOpen} open={shouldShow}>
      <PopoverAnchor asChild>
        <Input
          autoComplete="off"
          id={inputId}
          onBlur={() => {
            // Allow a click on a suggestion before closing.
            window.setTimeout(() => setOpen(false), 150);
          }}
          onChange={(e) => {
            onChange(e.target.value);
            setOpen(true);
          }}
          onFocus={() => {
            if (value.length >= 2) {
              setOpen(true);
            }
          }}
          placeholder={placeholder}
          value={value}
        />
      </PopoverAnchor>
      <PopoverContent
        align="start"
        className="w-[--radix-popover-trigger-width] p-1"
        onCloseAutoFocus={(e) => e.preventDefault()}
        onOpenAutoFocus={(e) => e.preventDefault()}
        sideOffset={4}
      >
        <div className="max-h-48 overflow-auto">
          {filtered.map((name) => (
            <Button
              className="h-8 w-full justify-start px-2 text-sm"
              key={name}
              onClick={() => {
                onChange(name);
                setOpen(false);
              }} // Prevent focus loss on mousedown
              onMouseDown={(e) => e.preventDefault()}
              type="button"
              variant="ghost"
            >
              {name}
            </Button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
