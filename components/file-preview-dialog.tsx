"use client";

import {
  Download,
  ExternalLink,
  FileText,
  Image as ImageIcon,
  Loader2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ProjectDoc } from "@/lib/db/schema";
import { cn } from "@/lib/utils";

type FilePreviewDialogProps = {
  doc: ProjectDoc | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

function isImageMimeType(mimeType: string): boolean {
  return mimeType === "image/jpeg" || mimeType === "image/png";
}

function isPdfMimeType(mimeType: string): boolean {
  return mimeType === "application/pdf";
}

function isTextMimeType(mimeType: string): boolean {
  return mimeType === "text/plain" || mimeType === "text/markdown";
}

function isDocxMimeType(mimeType: string): boolean {
  return (
    mimeType ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document" ||
    mimeType === "application/msword"
  );
}

function ImagePreview({ src, alt }: { src: string; alt: string }) {
  return (
    <div className="flex items-center justify-center overflow-auto rounded-lg bg-muted/30 p-4">
      <img
        alt={alt}
        className="max-h-[70vh] max-w-full rounded-lg object-contain"
        src={src}
      />
    </div>
  );
}

function PdfPreview({ src }: { src: string }) {
  return (
    <div className="h-[70vh] w-full overflow-hidden rounded-lg">
      <iframe className="size-full border-0" src={src} title="PDF Preview" />
    </div>
  );
}

function TextPreview({ src }: { src: string }) {
  const [content, setContent] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setIsLoading(true);
    setError(null);
    setContent(null);

    fetch(src)
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to load file content");
        }
        return response.text();
      })
      .then((text) => {
        setContent(text);
        setIsLoading(false);
      })
      .catch((err) => {
        setError(err instanceof Error ? err.message : "Failed to load file");
        setIsLoading(false);
      });
  }, [src]);

  if (isLoading) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <Loader2 className="size-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex h-[50vh] items-center justify-center">
        <p className="text-muted-foreground">{error}</p>
      </div>
    );
  }

  return (
    <div className="max-h-[70vh] overflow-auto rounded-lg bg-muted/30 p-4">
      <pre className="whitespace-pre-wrap break-words font-mono text-foreground text-sm">
        {content}
      </pre>
    </div>
  );
}

function DocxPreview({ doc }: { doc: ProjectDoc }) {
  // For DOCX files, we show a message that they need to be downloaded
  // or we could show extracted text if available from turbopuffer
  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-4 rounded-lg bg-muted/30 p-8">
      <FileText className="size-16 text-muted-foreground" />
      <p className="text-center text-muted-foreground">
        Word documents cannot be previewed directly.
        <br />
        Please download the file to view its contents.
      </p>
      <Button asChild variant="outline">
        <a download={doc.filename} href={doc.blobUrl}>
          <Download className="mr-2 size-4" />
          Download {doc.filename}
        </a>
      </Button>
    </div>
  );
}

function UnsupportedPreview({ doc }: { doc: ProjectDoc }) {
  return (
    <div className="flex h-[50vh] flex-col items-center justify-center gap-4 rounded-lg bg-muted/30 p-8">
      <FileText className="size-16 text-muted-foreground" />
      <p className="text-center text-muted-foreground">
        Preview is not available for this file type.
        <br />
        Please download the file to view its contents.
      </p>
      <Button asChild variant="outline">
        <a download={doc.filename} href={doc.blobUrl}>
          <Download className="mr-2 size-4" />
          Download {doc.filename}
        </a>
      </Button>
    </div>
  );
}

function PreviewContent({ doc }: { doc: ProjectDoc }) {
  if (isImageMimeType(doc.mimeType)) {
    return <ImagePreview alt={doc.filename} src={doc.blobUrl} />;
  }

  if (isPdfMimeType(doc.mimeType)) {
    return <PdfPreview src={doc.blobUrl} />;
  }

  if (isTextMimeType(doc.mimeType)) {
    return <TextPreview src={doc.blobUrl} />;
  }

  if (isDocxMimeType(doc.mimeType)) {
    return <DocxPreview doc={doc} />;
  }

  return <UnsupportedPreview doc={doc} />;
}

export function FilePreviewDialog({
  doc,
  open,
  onOpenChange,
}: FilePreviewDialogProps) {
  if (!doc) {
    return null;
  }

  const isImage = isImageMimeType(doc.mimeType);
  const isPdf = isPdfMimeType(doc.mimeType);

  return (
    <Dialog onOpenChange={onOpenChange} open={open}>
      <DialogContent
        className={cn(
          "max-h-[90vh] overflow-hidden",
          isPdf || isImage ? "max-w-4xl" : "max-w-2xl"
        )}
      >
        <DialogHeader className="flex flex-row items-center justify-between gap-4">
          <DialogTitle className="flex items-center gap-2 truncate text-base">
            {isImage ? (
              <ImageIcon className="size-4 shrink-0" />
            ) : (
              <FileText className="size-4 shrink-0" />
            )}
            <span className="truncate">{doc.filename}</span>
          </DialogTitle>
          <div className="flex items-center gap-2">
            <Button asChild size="sm" variant="outline">
              <a href={doc.blobUrl} rel="noopener noreferrer" target="_blank">
                <ExternalLink className="mr-1 size-3" />
                Open
              </a>
            </Button>
            <Button asChild size="sm" variant="outline">
              <a download={doc.filename} href={doc.blobUrl}>
                <Download className="mr-1 size-3" />
                Download
              </a>
            </Button>
          </div>
        </DialogHeader>
        <PreviewContent doc={doc} />
      </DialogContent>
    </Dialog>
  );
}
