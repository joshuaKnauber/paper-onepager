import { serveStatic } from "@hono/node-server/serve-static";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";

import { z } from "zod";

import { openrouter } from "@openrouter/ai-sdk-provider";
import { generateText, stepCountIs, tool } from "ai";
import * as path from "path";

const app = new Hono();

app.use("*", cors());
app.use(logger());
app.use("*", requestId());

// app.use(
//   "*",
//   basicAuth({
//     username: process.env.PAGE_USERNAME!,
//     password: process.env.PAGE_PASSWORD!,
//   })
// );

app.post(
  "/api/refactor",
  zValidator(
    "json",
    z.object({
      html: z.string(),
      dataUrl: z.url(),
    })
  ),
  async (c) => {
    let modifiedHtml = c.req.valid("json").html;
    const { text } = await generateText({
      // model: openrouter("google/gemini-2.0-flash-lite-001"),
      // model: openrouter("google/gemini-2.5-flash"),
      // model: openrouter("google/gemini-2.5-pro"),
      // model: openrouter("anthropic/claude-3.7-sonnet"),
      model: openrouter("openai/gpt-5"),
      temperature: 0.1,
      stopWhen: stepCountIs(3),
      tools: {
        editHtml: tool({
          description: "Make an edit to the HTML by replacing part of it",
          inputSchema: z.object({
            replaceHtml: z
              .string()
              .describe(
                "The part of the original HTML you want to replace. This can include regular expressions for matching bigger chunks of the html"
              ),
            replaceWithHTml: z
              .string()
              .describe(
                "The new HTML you want to replace the original section with"
              ),
          }),
          // location below is inferred to be a string:
          execute: async ({ replaceHtml, replaceWithHTml }) => {
            console.log(`Replacing "${replaceHtml}" with "${replaceWithHTml}"`);
            const oldHtml = modifiedHtml;
            const expression = new RegExp(replaceHtml, "g");
            modifiedHtml = modifiedHtml.replace(expression, replaceWithHTml);
            return { success: oldHtml !== modifiedHtml, newHtml: modifiedHtml };
          },
        }),
      },
      messages: [
        {
          role: "system",
          content: `
You are a coding assistant that makes changes based on the users input.
You receive the current state of the page and a drawover the user made. Use the modify tool provided to you to make changes to the HTML until it matches the drawover.

---

Current HTML:
${c.req.valid("json").html}
      `.trim(),
        },
        {
          role: "user",
          content: [
            {
              type: "image",
              image: c.req.valid("json").dataUrl,
            },
          ],
        },
      ],
    });
    return c.text(modifiedHtml);
  }
);

const staticFilePath = path.join(__dirname, "../client/dist");
app.use("*", serveStatic({ root: staticFilePath }));

export default app;
