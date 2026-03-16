import equal from "fast-deep-equal";
import { Quote } from "lucide-react";
import { memo, useState } from "react";
import { toast } from "sonner";
import { useCopyToClipboard } from "usehooks-ts";
import type { Vote } from "@/lib/db/schema";
import type { ChatMessage } from "@/lib/types";
import { Action, Actions } from "./elements/actions";
import { CopyIcon } from "./icons";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";

export function PureMessageActions({
  chatId,
  message,
  vote,
  isLoading,
  setMode,
  showCitations,
  onToggleCitations,
}: {
  chatId: string;
  message: ChatMessage;
  vote: Vote | undefined;
  isLoading: boolean;
  setMode?: (mode: "view" | "edit") => void;
  showCitations?: boolean;
  onToggleCitations?: () => void;
}) {
  const [_, copyToClipboard] = useCopyToClipboard();
  const [popoverOpen, setPopoverOpen] = useState(false);

  if (isLoading) {
    return null;
  }

  const textFromParts = message.parts
    ?.filter((part) => part.type === "text")
    .map((part) => part.text)
    .join("\n")
    .trim();

  const handleCopy = async () => {
    if (!textFromParts) {
      toast.error("There's no text to copy!");
      return;
    }

    await copyToClipboard(textFromParts);
    toast.success("Copied to clipboard!");
  };

  // User messages don't show actions
  if (message.role === "user") {
    return null;
  }

  return (
    <Actions className="-ml-0.5">
      <Action onClick={handleCopy} tooltip="Copy">
        <CopyIcon />
      </Action>

      {onToggleCitations && (
        <Popover open={popoverOpen} onOpenChange={setPopoverOpen}>
          <PopoverTrigger asChild>
            <Button
              aria-label="Toggle citations"
              className="relative size-7 p-1 text-muted-foreground hover:text-foreground"
              onPointerEnter={() => setPopoverOpen(true)}
              onPointerLeave={() => setPopoverOpen(false)}
              onClick={onToggleCitations}
              size="sm"
              type="button"
              variant="ghost"
            >
              <Quote className="size-3.5" />
            </Button>
          </PopoverTrigger>
          <PopoverContent
            align="start"
            className="w-56 p-3 text-muted-foreground text-sm"
            side="top"
            onPointerEnter={() => setPopoverOpen(true)}
            onPointerLeave={() => setPopoverOpen(false)}
          >
            <p>
              {showCitations
                ? "Citations are on. Click the button to hide source links in responses."
                : "Citations are off. Click the button to show source links in assistant responses."}
            </p>
          </PopoverContent>
        </Popover>
      )}
    </Actions>
  );
}

export const MessageActions = memo(
  PureMessageActions,
  (prevProps, nextProps) => {
    if (!equal(prevProps.vote, nextProps.vote)) {
      return false;
    }
    if (prevProps.isLoading !== nextProps.isLoading) {
      return false;
    }
    if (prevProps.showCitations !== nextProps.showCitations) {
      return false;
    }
    return true;
  }
);
