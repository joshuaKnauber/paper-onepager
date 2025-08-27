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

if (process.env.PAGE_USERNAME && process.env.PAGE_PASSWORD) {
  app.use(
    "*",
    basicAuth({
      username: process.env.PAGE_USERNAME,
      password: process.env.PAGE_PASSWORD,
    })
  );
}

app.post(
  "/api/edit",
  zValidator(
    "json",
    z.object({
      html: z.string(),
      drawoverUrl: z.string(),
      pageUrl: z.string(),
    })
  ),
  async (c) => {
    const { text: newHtml } = await generateText({
      model: openrouter("google/gemini-2.5-flash"),
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `
🎨 YOU ARE A DESIGN INTERPRETER - NOT A CODE REVIEWER

FUNDAMENTAL RULE: Every single drawing is a DESIGN ELEMENT to be implemented in HTML. 
- Drawings = Real website elements to add/modify
- NOT annotations, NOT comments, NOT markup notes
- NOT "suggestions" or "feedback" 
- They are ACTUAL CONTENT for the final webpage

The user sketched these elements because they want them on their website. Your job is to make their sketch into reality by adding the corresponding HTML elements.

WHAT YOU RECEIVE:
1. Original website screenshot
2. Same screenshot with RED DRAWINGS = new design elements to implement
3. Current HTML code

YOUR MISSION: Transform every drawing into actual HTML elements and add them to the page.

HOW TO INTERPRET DRAWINGS:

✅ SHAPES = NEW HTML ELEMENTS (Default assumption):
- Rectangle/square = <div> container, card, or section
- Rectangle with scribbles = <button> with that text content
- Square with X/cross = <img> tag (use Picsum photos)
- Circle/oval = Profile image, avatar, icon
- Lines = <hr> dividers, borders, separators
- Scribbled text = <h1>, <h2>, <p> based on size

✅ DRAWINGS ON EXISTING ELEMENTS = MODIFICATIONS:
- Text over existing text = Change content
- Arrows = Move elements to new positions
- Boxes around elements = Add containers, styling

❌ ONLY REMOVE IF EXPLICITLY CROSSED OUT:
- Heavy strikethrough lines over existing content
- Big X marks directly on top of existing elements

CORE PRINCIPLE: When you see ANY drawing, ask "What HTML element does this represent?" not "Is this just a note?"

PRESERVE + ENHANCE: Keep all existing content and ADD the drawn elements to create an enhanced version of the page.

Only use existing assets/styles from the HTML or common HTML/Tailwind elements.

For images: Use existing image URLs from the HTML when appropriate. If adding new images, use Picsum photos (https://picsum.photos/) with specific dimensions like:
- https://picsum.photos/400/300 for general images
- https://picsum.photos/800/400 for hero/banner images  
- https://picsum.photos/150/150 for profile/avatar images
- https://picsum.photos/300/200 for card images

Return ONLY the complete updated HTML. No explanations, no code blocks, no other text.

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

    return c.text(newHtml);
  }
);

const staticFilePath = path.join(__dirname, "../client/dist");
app.use("*", serveStatic({ root: staticFilePath }));

export default app;
