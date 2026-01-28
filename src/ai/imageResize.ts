import sharp from 'sharp';
import { getConfig } from '../config.js';

export const PLATFORM_SIZES: Record<string, [number, number]> = {
  instagram_feed: [1080, 1350],
  instagram_square: [1080, 1080],
  instagram_story: [1080, 1920],
  facebook_feed: [1200, 630],
};

export async function resizeForPlatform(
  imageUrl: string,
  platform: string
): Promise<Buffer> {
  const res = await fetch(imageUrl);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status}`);
  const buf = Buffer.from(await res.arrayBuffer());
  const [w, h] = PLATFORM_SIZES[platform] ?? [1080, 1080];
  const targetRatio = w / h;

  const meta = await sharp(buf).metadata();
  const imgW = meta.width ?? 1;
  const imgH = meta.height ?? 1;
  const imgRatio = imgW / imgH;

  let left = 0;
  let top = 0;
  let width = imgW;
  let height = imgH;
  if (imgRatio > targetRatio) {
    width = Math.round(imgH * targetRatio);
    left = Math.round((imgW - width) / 2);
  } else {
    height = Math.round(imgW / targetRatio);
    top = Math.round((imgH - height) / 2);
  }

  const out = await sharp(buf)
    .extract({ left, top, width, height })
    .resize(w, h)
    .jpeg({ quality: 85 })
    .toBuffer();
  return out;
}
