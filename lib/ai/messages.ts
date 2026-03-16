export const THINKING_MESSAGES = ["Vibing", "Flowing"] as const;

export function getRandomThinkingMessage(): string {
  const randomIndex = Math.floor(Math.random() * THINKING_MESSAGES.length);
  return THINKING_MESSAGES[randomIndex];
}
