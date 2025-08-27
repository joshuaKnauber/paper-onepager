import { serveStatic } from "@hono/node-server/serve-static";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";

import { z } from "zod";

import { openrouter } from "@openrouter/ai-sdk-provider";
import { generateText } from "ai";
import * as path from "path";

const app = new Hono();

app.use("*", cors());
app.use(logger());
app.use("*", requestId());

app.use(
  "*",
  basicAuth({
    username: process.env.PAGE_USERNAME!,
    password: process.env.PAGE_PASSWORD!,
  })
);

app.post(
  "/api/refactor",
  zValidator(
    "json",
    z.object({
      html: z.string(),
      drawoverUrl: z.string(),
      pageUrl: z.string(),
    })
  ),
  async (c) => {
    const { text: analysis } = await generateText({
      model: openrouter("google/gemini-2.5-flash"),
      temperature: 0.2,
      messages: [
        {
          role: "system",
          content: `
Your job is to analyze the screenshot of a website you are given. The screenshot has a drawing by the user on top of it. Describe the changes the user wants to make to the website.
Respond with a description of the changes, referencing the elements that need to change or be added.

Changes are drawn over the original website in red.
These are things the user will likely want to do and you should recognize:
- Remove parts of the UI. For this the user will likely cross them out. Only remove sections if the user crosses them out explicitely.
- Add new elements to the UI. For this the user will likely draw them in. Common elements will include:
  - Container: Square
  - Divider: Line
  - Text: Scribbled line (size determines if header or content)
  - Image: Square with cross
  - Button: Rectangle with scribbled text inside
- Change elements. For this the user will likely draw an arrow to a picture of how the element should look afterwards

You will receive two screenshots:
- An image of the entire page without any edits
- An image of the section the user wants to edit with the changes drawn over in red

Keep your response short and concise. Describe precisely the changes the user wants to make.

---

Website HTML:
${c.req.valid("json").html}
      `.trim(),
        },
        {
          role: "user",
          content: [
            {
              type: "image",
              image: c.req.valid("json").pageUrl,
            },
            {
              type: "image",
              image: c.req.valid("json").drawoverUrl,
            },
          ],
        },
      ],
    });
    console.log(analysis);

    const { text: newHtml } = await generateText({
      model: openrouter("x-ai/grok-code-fast-1"),
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `
You are a coding assistant that makes changes to the HTML of a website based on the described changes.
You receive the current state of the page and a description of what you should change. Return the full new html with changes.
Only use assets and styles that already occur in the HTML or that are common to html and tailwind.
If you need additional assets like images include them with links.

Return the full html with the edits made.
Do not include any other context or explanations. Do not wrap the code in tags or add any other characters. Only respond with the updated code.

---

Current HTML:
${c.req.valid("json").html}
      `.trim(),
        },
        {
          role: "user",
          content: analysis,
        },
      ],
    });
    return c.text(newHtml);
  }
);

const staticFilePath = path.join(__dirname, "../client/dist");
app.use("*", serveStatic({ root: staticFilePath }));

export default app;
