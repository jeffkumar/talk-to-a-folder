/**
 * Centralized file type definitions for document imports.
 * Used by Google Drive, Microsoft OneDrive/SharePoint integrations.
 */

export const SUPPORTED_FILE_EXTENSIONS = [
  "pdf",
  "doc",
  "docx",
  "csv",
  "xlsx",
  "xls",
  "txt",
  "jpg",
  "jpeg",
  "png",
] as const;

export type SupportedFileExtension = (typeof SUPPORTED_FILE_EXTENSIONS)[number];

export const SUPPORTED_MIME_TYPES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "text/csv",
  "application/vnd.ms-excel",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "text/plain",
  "image/jpeg",
  "image/png",
] as const;

export type SupportedMimeType = (typeof SUPPORTED_MIME_TYPES)[number];

/**
 * Google Docs/Sheets/Slides native formats.
 * These are exported to supported formats (PDF/xlsx) during sync.
 */
export const GOOGLE_DOCS_MIME_TYPES = [
  "application/vnd.google-apps.document",
  "application/vnd.google-apps.spreadsheet",
  "application/vnd.google-apps.presentation",
] as const;

export type GoogleDocsMimeType = (typeof GOOGLE_DOCS_MIME_TYPES)[number];

/**
 * Check if a file extension is supported.
 */
export function isSupportedExtension(ext: string): boolean {
  return SUPPORTED_FILE_EXTENSIONS.includes(
    ext.toLowerCase() as SupportedFileExtension
  );
}

/**
 * Check if a MIME type is supported.
 */
export function isSupportedMimeType(mimeType: string): boolean {
  return SUPPORTED_MIME_TYPES.includes(mimeType as SupportedMimeType);
}

/**
 * Check if a MIME type is a Google Docs native format.
 */
export function isGoogleDocsMimeType(mimeType: string): boolean {
  return GOOGLE_DOCS_MIME_TYPES.includes(mimeType as GoogleDocsMimeType);
}

/**
 * Get a display string of supported file extensions for UI.
 */
export function getFileTypesDisplayString(): string {
  return SUPPORTED_FILE_EXTENSIONS.map((ext) => `.${ext}`).join(", ");
}

/**
 * Check if a filename has a supported extension.
 */
export function isSupportedFileName(name: string | null): boolean {
  if (!name) return false;
  const trimmed = name.trim();
  if (!trimmed) return false;
  const lastDot = trimmed.lastIndexOf(".");
  if (lastDot <= 0 || lastDot === trimmed.length - 1) return false;
  const ext = trimmed.slice(lastDot + 1).toLowerCase();
  return isSupportedExtension(ext);
}
