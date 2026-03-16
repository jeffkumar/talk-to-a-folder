import { streamObject } from "ai";
import { z } from "zod";
import { slidesPrompt, updateDocumentPrompt } from "@/lib/ai/prompts";
import { myProvider } from "@/lib/ai/providers";
import { createDocumentHandler } from "@/lib/artifacts/server";

const slidesSchema = z.object({
  slides: z.array(
    z.object({
      title: z.string().describe("Slide title"),
      bullets: z.array(z.string()).describe("Key points as bullet items"),
      notes: z.string().optional().describe("Speaker notes for this slide"),
      imageUrl: z
        .string()
        .optional()
        .describe("URL of an image to display on this slide"),
      imageCaption: z.string().optional().describe("Caption for the image"),
    })
  ),
});

export const slidesDocumentHandler = createDocumentHandler<"slides">({
  kind: "slides",
  onCreateDocument: async ({ title, dataStream }) => {
    let draftContent = "";

    const { fullStream } = streamObject({
      model: myProvider.languageModel("artifact-model"),
      system: slidesPrompt,
      prompt: title,
      schema: slidesSchema,
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;

        if (object) {
          const jsonString = JSON.stringify(object);
          dataStream.write({
            type: "data-slidesDelta",
            data: jsonString,
            transient: true,
          });

          draftContent = jsonString;
        }
      }
    }

    dataStream.write({
      type: "data-slidesDelta",
      data: draftContent,
      transient: true,
    });

    return draftContent;
  },
  onUpdateDocument: async ({ document, description, dataStream }) => {
    let draftContent = "";

    const { fullStream } = streamObject({
      model: myProvider.languageModel("artifact-model"),
      system: updateDocumentPrompt(document.content, "slides"),
      prompt: description,
      schema: slidesSchema,
    });

    for await (const delta of fullStream) {
      const { type } = delta;

      if (type === "object") {
        const { object } = delta;

        if (object) {
          const jsonString = JSON.stringify(object);
          dataStream.write({
            type: "data-slidesDelta",
            data: jsonString,
            transient: true,
          });

          draftContent = jsonString;
        }
      }
    }

    return draftContent;
  },
});
