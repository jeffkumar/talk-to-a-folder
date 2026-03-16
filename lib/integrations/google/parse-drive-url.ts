export type DriveUrlInfo =
  | { type: "folder"; id: string }
  | { type: "file"; id: string };

const FOLDER_RE =
  /drive\.google\.com\/drive\/(?:u\/\d+\/)?folders\/([a-zA-Z0-9_-]+)/;
const FILE_RE = /drive\.google\.com\/file\/d\/([a-zA-Z0-9_-]+)/;
const OPEN_RE = /drive\.google\.com\/open\?id=([a-zA-Z0-9_-]+)/;

export function parseDriveUrl(input: string): DriveUrlInfo | null {
  const folderMatch = FOLDER_RE.exec(input);
  if (folderMatch) {
    return { type: "folder", id: folderMatch[1] };
  }

  const fileMatch = FILE_RE.exec(input);
  if (fileMatch) {
    return { type: "file", id: fileMatch[1] };
  }

  const openMatch = OPEN_RE.exec(input);
  if (openMatch) {
    return { type: "file", id: openMatch[1] };
  }

  return null;
}

const DRIVE_URL_RE =
  /https?:\/\/drive\.google\.com\/(?:drive\/(?:u\/\d+\/)?folders\/|file\/d\/|open\?id=)[a-zA-Z0-9_-]+/g;

export function extractDriveFolderIds(text: string): string[] {
  const ids: string[] = [];
  for (const match of text.matchAll(DRIVE_URL_RE)) {
    const parsed = parseDriveUrl(match[0]);
    if (parsed?.type === "folder") {
      ids.push(parsed.id);
    }
  }
  return ids;
}
