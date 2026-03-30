import { PICKUP_SHEET_CHROMA_KEYS, PICKUP_SHEET_URL } from "./pickupAtlas";

export async function createPickupHudSheetDataUrl(): Promise<string> {
  const image = await loadImage(PICKUP_SHEET_URL);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;

  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("Unable to create pickup HUD canvas.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.drawImage(image, 0, 0);

  const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
  const chromaKeys = PICKUP_SHEET_CHROMA_KEYS.map(parseHexColor);
  const pixels = imageData.data;
  for (let index = 0; index < pixels.length; index += 4) {
    const red = pixels[index];
    const green = pixels[index + 1];
    const blue = pixels[index + 2];
    if (chromaKeys.some((color) => color.r === red && color.g === green && color.b === blue)) {
      pixels[index + 3] = 0;
    }
  }

  context.putImageData(imageData, 0, 0);
  return canvas.toDataURL();
}

async function loadImage(url: string): Promise<HTMLImageElement> {
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error(`Failed to load pickup HUD sheet: ${url}`));
    image.src = url;
  });
}

function parseHexColor(value: string): { r: number; g: number; b: number } {
  const normalized = value.replace("#", "");
  return {
    r: Number.parseInt(normalized.slice(0, 2), 16),
    g: Number.parseInt(normalized.slice(2, 4), 16),
    b: Number.parseInt(normalized.slice(4, 6), 16)
  };
}
