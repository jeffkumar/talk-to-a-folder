import type { LucideIcon } from "lucide-react";

export type RemixTemplateId =
  | "product_build_plan"
  | "next_steps"
  | "slides"
  | "twitter_thread"
  | "instagram_caption"
  | "linkedin_post"
  | "newsletter_excerpt"
  | "custom";

export type RemixCategory = "product" | "strategy" | "social";

export type RemixTemplate = {
  id: RemixTemplateId;
  name: string;
  description: string;
  category?: RemixCategory;
  iconName:
    | "Twitter"
    | "Instagram"
    | "Linkedin"
    | "Mail"
    | "FileText"
    | "Pencil"
    | "Presentation"
    | "Target"
    | "ArrowRight";
  prompt: string;
};

export const REMIX_TEMPLATES: RemixTemplate[] = [
  // Product Development
  {
    id: "product_build_plan",
    name: "Product Build Plan",
    description: "Roadmap with phases, milestones, and timeline",
    category: "product",
    iconName: "Target",
    prompt: `Create a product build plan / roadmap from this content.

Guidelines:
- Identify the core problem and solution being addressed
- Break down into 3-5 distinct phases (Discovery, MVP, Beta, Launch, etc.)
- Each phase should have 2-4 key milestones with deliverables
- Include rough timeline estimates where possible
- Highlight dependencies between phases
- Note any risks or open questions
- End with success criteria / definition of done

Format as a clear, scannable roadmap that a team can execute against.`,
  },
  {
    id: "next_steps",
    name: "Next Steps",
    description: "Prioritized actions and opportunities to focus on",
    category: "product",
    iconName: "ArrowRight",
    prompt: `Analyze this content and identify the best next steps to focus on.

Guidelines:
- Identify 3-5 key opportunities or actions based on the context
- Prioritize by impact, urgency, and feasibility
- For each next step, provide:
  - A clear, actionable title
  - Why it matters (expected impact)
  - Suggested owner or team if apparent
  - Any dependencies or blockers to address first
- Consider both quick wins and strategic moves
- Look for patterns, gaps, or unresolved items that need attention
- End with a recommended "focus this week" action

Format as a prioritized, actionable list that helps decide what to do next.`,
  },
  // Strategy
  {
    id: "slides",
    name: "Slide Deck",
    description: "Presentation slides with key points",
    category: "strategy",
    iconName: "Presentation",
    prompt: `Create a professional slide deck presentation from this content.

Guidelines:
- Create 5-8 slides depending on content complexity
- First slide should be a compelling title slide
- Each slide should have a clear, concise title (max 6 words)
- Include 3-5 bullet points per slide, each under 15 words
- Focus on key insights, data points, and memorable quotes
- Use a logical flow that tells a story
- Last slide should be a strong closing/call-to-action
- Include speaker notes for each slide with additional context

IMPORTANT: You MUST output valid JSON in this exact format:
{"slides":[{"title":"Slide Title","bullets":["Point 1","Point 2","Point 3"],"notes":"Speaker notes here"}]}

Do not include any text before or after the JSON. Only output the JSON object.`,
  },
  // Social Media
  {
    id: "twitter_thread",
    name: "Twitter/X Thread",
    description: "Engaging thread with hooks and hashtags",
    category: "social",
    iconName: "Twitter",
    prompt: `Transform this content into an engaging Twitter/X thread.

Guidelines:
- Start with a powerful hook that stops the scroll
- Break into 5-10 tweets of max 280 characters each
- Number each tweet (1/, 2/, etc.)
- Use line breaks between tweets
- Include relevant emojis sparingly (1-2 per tweet max)
- Build tension and deliver value throughout
- End with a strong call to action
- Add a final tweet with 2-3 relevant hashtags

Format each tweet clearly separated by blank lines.`,
  },
  {
    id: "instagram_caption",
    name: "Instagram Caption",
    description: "Engaging caption with CTAs and hashtags",
    category: "social",
    iconName: "Instagram",
    prompt: `Create an Instagram caption from this content.

Guidelines:
- Lead with a hook or provocative question in the first line
- Keep the tone conversational and authentic
- Break into short, scannable paragraphs
- Include 3-5 relevant emojis naturally placed
- Include a clear call-to-action (save, share, comment, link in bio)
- End with a line break then 10-15 relevant hashtags
- Mix popular and niche hashtags

Make it feel personal and shareable.`,
  },
  {
    id: "linkedin_post",
    name: "LinkedIn Post",
    description: "Professional storytelling format",
    category: "social",
    iconName: "Linkedin",
    prompt: `Transform this into a LinkedIn post that drives engagement.

Guidelines:
- Start with a bold, attention-grabbing opening line (under 150 chars)
- Add a line break after the hook
- Use very short paragraphs (1-2 sentences max)
- Include a personal insight, lesson learned, or hot take
- Use "I" statements to make it personal
- Add strategic line breaks for readability
- End with a thought-provoking question to drive comments
- Keep it professional but personable
- No hashtags in the main text (add 3-5 at the very end if relevant)

The goal is to spark conversation.`,
  },
  {
    id: "newsletter_excerpt",
    name: "Newsletter Excerpt",
    description: "Email-friendly summary with key takeaways",
    category: "social",
    iconName: "Mail",
    prompt: `Create a newsletter excerpt from this content.

Guidelines:
- Write a compelling subject line suggestion at the top
- Start with a personal, conversational greeting hook
- Summarize the key points in 3-5 bullet points
- Include one actionable takeaway readers can use immediately
- Keep the total length to 150-250 words
- End with a soft CTA (reply to this email, check out the full piece, etc.)
- Write in second person ("you") to speak directly to the reader

Make it feel like a personal note, not a broadcast.`,
  },
  // Custom (always last)
  {
    id: "custom",
    name: "Custom Format",
    description: "Describe your own output format",
    iconName: "Pencil",
    prompt: "", // Will be replaced by user's custom instructions
  },
];

export function getTemplateById(
  id: RemixTemplateId
): RemixTemplate | undefined {
  return REMIX_TEMPLATES.find((t) => t.id === id);
}

export function getTemplatePrompt(
  id: RemixTemplateId,
  customInstructions?: string
): string {
  if (id === "custom") {
    return (
      customInstructions ||
      "Transform this content into a new format based on the user's instructions."
    );
  }
  const template = getTemplateById(id);
  return template?.prompt || "";
}
