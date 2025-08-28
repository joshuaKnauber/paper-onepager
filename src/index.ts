import { serveStatic } from "@hono/node-server/serve-static";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";

import { z } from "zod";

import { groq } from "@ai-sdk/groq";
import { generateText } from "ai";
import * as path from "path";
import { scaleImage } from "./lib/images";

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
    // Step 1: Interpret the images
    console.time("Image Interpretation");
    const { text: changeDescription } = await generateText({
      model: groq("meta-llama/llama-4-maverick-17b-128e-instruct"),
      temperature: 0.3,
      messages: [
        {
          role: "system",
          content: `
You are a wireframe interpreter. Look at the original website screenshot and the same screenshot with colored drawings that represent specific changes to implement.

CRITICAL: The drawing colors (GREEN/RED) are ONLY for categorizing actions - DO NOT mention colors in your instructions. The elements you describe should use normal/default colors appropriate for the website.

ABSOLUTE COLOR RULES - NO EXCEPTIONS:
- GREEN = ONLY ADD new elements OR MODIFY/EDIT existing ones - NEVER DELETE
- RED = ONLY DELETE/REMOVE elements - NEVER ADD OR MODIFY

GREEN ACTIONS ONLY:
- ADD new containers, sections, buttons, images, text, etc.
- MODIFY/EDIT existing content or elements
- MOVE elements to new positions

RED ACTIONS ONLY:
- DELETE/REMOVE existing elements completely

SHAPE INTERPRETATION RULES - Pay close attention to these:
- Rectangles/squares with X, cross, or scribbles inside = IMAGES/PHOTOS (very important to recognize)
- Plain rectangles/squares = containers, sections, buttons, or cards
- Squiggly/wavy lines = TEXT content (headings, paragraphs, labels)
- Straight horizontal/vertical lines = dividers, borders, separators
- Circles/ovals = profile images, avatars, icons, or rounded media
- Triangular shapes = play buttons, video elements
- Small squares/rectangles = form inputs, checkboxes
- Arrows = move/reposition existing elements

When referencing existing elements on the page, USE THE ACTUAL TEXT CONTENT you can see (e.g., "below the 'Get Started' button", "next to the 'About Us' heading", "above the 'Contact' section", "to the right of the 'Welcome to our site' text").

Be direct and specific about what should be changed. Include:
1. POSITION relative to existing elements using visible text when possible
2. SIZE when relevant (e.g., "large button", "small icon", "full-width image", "narrow sidebar")
3. LAYOUT relationships (e.g., "in a horizontal row", "stacked vertically", "as a grid of 3 items")

DO NOT mention drawing colors (green/red) in your output. Write 2-3 sentences with clear instructions that reference specific text content on the page when describing positions.
          `.trim(),
        },
        {
          role: "user",
          content: [
            {
              type: "image",
              image: await scaleImage(c.req.valid("json").drawoverUrl),
            },
          ],
        },
      ],
    });
    console.timeEnd("Image Interpretation");
    console.log("Change description:", changeDescription);

    // Step 2: Make HTML edits based on the description
    console.time("HTML Generation");
    const { text: newHtml } = await generateText({
      model: groq("openai/gpt-oss-120b"),
      temperature: 0.1,
      messages: [
        {
          role: "system",
          content: `
You are an HTML editor. You will receive a description of changes to make and the current HTML code.

When adding media elements (images, videos, icons, etc.), use real working URLs from internet sources that would actually load in a browser.

Make the requested changes and return ONLY the complete updated HTML. No explanations, no code blocks, no other text.

Current HTML:
${c.req.valid("json").html}
          `.trim(),
        },
        {
          role: "user",
          content: changeDescription,
        },
      ],
    });
    console.timeEnd("HTML Generation");

    return c.text(newHtml);
  }
);

const staticFilePath = path.join(__dirname, "../client/dist");
app.use("*", serveStatic({ root: staticFilePath }));

export default app;
