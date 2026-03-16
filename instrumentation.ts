import { registerOTel } from "@vercel/otel";

export function register() {
  // Skip OpenTelemetry in development - causes significant overhead
  if (process.env.NODE_ENV === "development") {
    return;
  }
  registerOTel({ serviceName: "ai-chatbot" });
}
