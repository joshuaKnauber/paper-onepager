import { serveStatic } from "@hono/node-server/serve-static";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { basicAuth } from "hono/basic-auth";
import { cors } from "hono/cors";
import { logger } from "hono/logger";
import { requestId } from "hono/request-id";

import { z } from "zod";

import { generateText } from "ai";
import * as path from "path";
import { openrouter } from "./lib/ai-client";
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
        model: openrouter("google/gemini-2.5-flash"),
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
- Arrows = move/reposition existing elements OR indicate where new elements should be placed

STEP 2: ARROW ANALYSIS (CRITICAL)
Pay special attention to arrows and their directional meaning:
- Identify the START point of each arrow (what element it's pointing FROM)
- Identify the END point of each arrow (where it's pointing TO)
- Determine if the arrow indicates:
  * MOVING an existing element from one location to another
  * ADDING a new element at the target location
  * REPOSITIONING elements within the same container
- Note the direction: up, down, left, right, diagonal
- Consider if multiple arrows show a sequence of movements or placements

STEP 3: SPATIAL ANALYSIS
Determine the position and relationships of each shape:
- Where is each shape located relative to existing page elements?
- What existing text content or UI elements are nearby that can be used as reference points?
- How do the shapes relate to each other spatially?
- For arrows: What is the exact path from source to destination?

STEP 4: COLOR-BASED ACTION MAPPING
Categorize each shape by its color meaning (DO NOT mention colors in final output):
- GREEN = ADD new elements OR MODIFY/EDIT existing ones (NEVER DELETE)
- RED = DELETE/REMOVE elements (NEVER ADD OR MODIFY)

STEP 5: WIREFRAME INTERPRETATION
Convert the shapes into web UI elements based on context:
- Consider the existing page layout and content
- Determine appropriate sizes (large/small/full-width etc.)
- Identify layout relationships (horizontal rows, vertical stacks, grids)
- Reference specific visible text content on the page for positioning
- For arrows: Translate the movement/placement into precise positioning instructions

STEP 6: HTML CONTEXT ANALYSIS
Examine the current HTML structure to understand:
- Existing element IDs, classes, and structure
- Current layout containers and sections
- Text content that can serve as reference points
- CSS classes and styling patterns

STEP 7: GENERATE PRECISE INSTRUCTIONS
Provide specific instructions for the HTML editor with exact placement details:
- WHERE: Specify exact HTML elements, IDs, or classes as insertion points
- WHAT: Describe the exact HTML elements to add/modify/remove
- HOW: Include specific CSS classes, attributes, or structure needed
- FOR ARROWS: Provide exact "move from X to Y" or "place at location Y" instructions

Format your output as precise instructions that include:
1. Exact HTML element selectors or text content for reference points
2. Specific placement (before, after, inside, replace, move from X to Y)
3. Complete element specifications with classes and attributes
4. Any required CSS styling or layout considerations
5. Clear directional instructions based on arrow analysis

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
        model: openrouter("x-ai/grok-code-fast-1"),
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

When adding images, use Picsum placeholder images (https://picsum.photos/WIDTH/HEIGHT) with appropriate dimensions for the context.
For other media elements (videos, icons, etc.), use real working URLs from internet sources.

IMPORTANT: All media elements (images, videos, etc.) must include explicit height and width styles in the style attribute.

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
