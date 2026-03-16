import { createAnthropic } from "@ai-sdk/anthropic";
import { createOpenAI } from "@ai-sdk/openai";
import { customProvider } from "ai";
import { isTestEnvironment } from "../constants";

// Anthropic provider for Claude (preferred when available)
const anthropicApiKey = process.env.ANTHROPIC_API_KEY;
const anthropic = anthropicApiKey
  ? createAnthropic({
      apiKey: anthropicApiKey,
    })
  : null;

// Baseten provider for DeepSeek V3.1
const basetenApiKey = process.env.BASETEN_API_KEY;
const baseten = basetenApiKey
  ? createOpenAI({
      apiKey: basetenApiKey,
      baseURL: "https://inference.baseten.co/v1",
    })
  : null;

// GLM via Baseten (uses separate API key)
const glmApiKey = process.env.GLM_API_KEY;
const glmBaseten = glmApiKey
  ? createOpenAI({
      apiKey: glmApiKey,
      baseURL: "https://inference.baseten.co/v1",
    })
  : null;

// OpenAI provider for reliable structured extraction (optional)
const openaiApiKey = process.env.OPENAI_API_KEY;
const openai = openaiApiKey
  ? createOpenAI({
      apiKey: openaiApiKey,
    })
  : null;

// Claude Sonnet model (balanced performance)
const claudeSonnetModel = anthropic
  ? anthropic.languageModel("claude-sonnet-4-6")
  : null;

// Claude Opus model (most powerful reasoning)
const claudeOpusModel = anthropic
  ? anthropic.languageModel("claude-opus-4-5-20251101")
  : null;

// Fallback: use DeepSeek as the default model
const deepseekModel = baseten
  ? baseten.chat("deepseek-ai/DeepSeek-V3.1")
  : glmBaseten
    ? glmBaseten.chat("zai-org/GLM-4.7")
    : null;

// Primary model: prefer Claude Sonnet, fallback to DeepSeek
const defaultModel = claudeSonnetModel ?? deepseekModel;

// Extraction model: prefer OpenAI for reliable structured JSON output, then Claude
const extractionModel = openai
  ? openai.chat("gpt-4o-mini")
  : (claudeSonnetModel ?? deepseekModel);

export const myProvider = isTestEnvironment
  ? (() => {
      const { artifactModel, chatModel, titleModel } = require("./models.mock");
      return customProvider({
        languageModels: {
          "claude-sonnet": chatModel,
          "claude-opus": chatModel,
          "deepseek-v3": chatModel,
          "glm-4": chatModel,
          "title-model": titleModel,
          "artifact-model": artifactModel,
          "chat-model": chatModel,
          "chat-model-reasoning": chatModel,
          "extraction-model": chatModel,
        },
      });
    })()
  : customProvider({
      languageModels: {
        // Claude Sonnet - balanced performance
        "claude-sonnet": claudeSonnetModel ?? defaultModel!,
        // Claude Opus - most powerful reasoning
        "claude-opus": claudeOpusModel ?? defaultModel!,
        // DeepSeek V3.1 via Baseten
        "deepseek-v3": deepseekModel ?? defaultModel!,
        // GLM-4.7 via Baseten - alternative model
        "glm-4": glmBaseten
          ? glmBaseten.chat("zai-org/GLM-4.7")
          : defaultModel!,
        // Title generation
        "title-model": defaultModel!,
        // Artifact generation
        "artifact-model": defaultModel!,
        // Chat model aliases (used by generate-doc, chat, and other routes)
        "chat-model": defaultModel!,
        "chat-model-reasoning": defaultModel!,
        // Extraction model: OpenAI preferred for reliable structured JSON
        "extraction-model": extractionModel!,
      },
    });
