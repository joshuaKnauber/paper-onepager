const sharp = require("sharp");

export async function scaleImage(base64: string): Promise<string> {
  // Remove data URL prefix if present
  const base64Data = base64.replace(/^data:image\/[a-z]+;base64,/, "");

  // Convert base64 to buffer
  const inputBuffer = Buffer.from(base64Data, "base64");

  // Resize image with Sharp
  const resizedBuffer = await sharp(inputBuffer)
    .resize({
      width: 1000,
      height: 1000,
      fit: "inside",
      withoutEnlargement: true,
    })
    .jpeg({ quality: 60 })
    .toBuffer();

  // Convert back to base64
  return `data:image/jpeg;base64,${resizedBuffer.toString("base64")}`;
}
