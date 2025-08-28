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
    try {
      // Step 1: Interpret the images
      console.time("Image Interpretation");
      const { text: changeDescription } = await generateText({
        model: groq("meta-llama/llama-4-scout-17b-16e-instruct"),
        temperature: 0.3,
        messages: [
          {
            role: "system",
            content: `
You are a wireframe interpreter. Follow these steps in order to analyze the images:

STEP 1: SHAPE RECOGNITION
First, identify all drawn shapes on the image:
- Rectangles/squares with X, cross, or scribbles inside = IMAGES/PHOTOS
- Plain rectangles/squares = containers, sections, buttons, or cards  
- Squiggly/wavy lines = TEXT content (headings, paragraphs, labels)
- Straight horizontal/vertical lines = dividers, borders, separators
- Circles/ovals = profile images, avatars, icons, or rounded media
- Triangular shapes = play buttons, video elements
- Small squares/rectangles = form inputs, checkboxes
- Arrows = move/reposition existing elements

STEP 2: SPATIAL ANALYSIS
Determine the position and relationships of each shape:
- Where is each shape located relative to existing page elements?
- What existing text content or UI elements are nearby that can be used as reference points?
- How do the shapes relate to each other spatially?

STEP 3: COLOR-BASED ACTION MAPPING
Categorize each shape by its color meaning (DO NOT mention colors in final output):
- GREEN = ADD new elements OR MODIFY/EDIT existing ones (NEVER DELETE)
- RED = DELETE/REMOVE elements (NEVER ADD OR MODIFY)

STEP 4: WIREFRAME INTERPRETATION
Convert the shapes into web UI elements based on context:
- Consider the existing page layout and content
- Determine appropriate sizes (large/small/full-width etc.)
- Identify layout relationships (horizontal rows, vertical stacks, grids)
- Reference specific visible text content on the page for positioning

STEP 5: HTML CONTEXT ANALYSIS
Examine the current HTML structure to understand:
- Existing element IDs, classes, and structure
- Current layout containers and sections
- Text content that can serve as reference points
- CSS classes and styling patterns

STEP 6: GENERATE PRECISE INSTRUCTIONS
Provide specific instructions for the HTML editor with exact placement details:
- WHERE: Specify exact HTML elements, IDs, or classes as insertion points
- WHAT: Describe the exact HTML elements to add/modify/remove
- HOW: Include specific CSS classes, attributes, or structure needed

Format your output as precise instructions that include:
1. Exact HTML element selectors or text content for reference points
2. Specific placement (before, after, inside, replace)
3. Complete element specifications with classes and attributes
4. Any required CSS styling or layout considerations

Current HTML structure for reference:
${c.req.valid("json").html}

Remember: Look at the original website screenshot and the same screenshot with colored drawings that represent specific changes to implement.
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
You are an HTML editor. You will receive precise instructions for modifying HTML code.

Follow these steps:
1. LOCATE: Find the exact elements mentioned in the instructions using selectors, IDs, classes, or text content
2. IMPLEMENT: Make the specified changes (add/modify/remove elements)
3. PRESERVE: Keep all existing styling, classes, and structure unless specifically instructed to change
4. VALIDATE: Ensure the HTML remains well-formed and functional

When adding media elements (images, videos, icons, etc.), use real working URLs from internet sources.

Return ONLY the complete updated HTML. No explanations, no code blocks, no other text.

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
    } catch (error) {
      console.error(error);
      return c.text("Internal Server Error", { status: 500 });
    }
  }
);

const staticFilePath = path.join(__dirname, "../client/dist");
app.use("*", serveStatic({ root: staticFilePath }));

export default app;
