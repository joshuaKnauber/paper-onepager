import { serveStatic } from "@hono/node-server/serve-static";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";

import { z } from "zod";

import { openrouter } from "@openrouter/ai-sdk-provider";
import { generateObject } from "ai";
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
    const { object } = await generateObject({
      // model: openrouter("google/gemini-2.5-flash"),
      // model: openrouter("google/gemini-2.5-pro"),
      // model: openrouter("anthropic/claude-3.7-sonnet"),
      model: openrouter("openai/gpt-5"),
      schema: z.object({
        change: z.object({
          replaceHtml: z
            .string()
            .describe(
              "Part of the original HTML you want to replace. This should be a valid html snippet from the original HTML"
            ),
          replaceWithHtml: z
            .string()
            .describe(
              "The new content to replace the original HTML. This should be the valid html snippet to replace the part of the original HTML with"
            ),
        }),
      }),
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `
You are a coding assistant that makes changes based on the users input.
You receive the current state of the page and a drawover the user made. Make the changes to the HTML to implement the changes from the drawover.
Respond with the changes you need to make to the html.

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
    console.log(object.change);
    let newHtml = c.req.valid("json").html;
    for (const change of [object.change]) {
      newHtml = newHtml.replace(change.replaceHtml, change.replaceWithHtml);
    }
    return c.text(newHtml);
  }
);

const staticFilePath = path.join(__dirname, "../client/dist");
app.use("*", serveStatic({ root: staticFilePath }));

export default app;
