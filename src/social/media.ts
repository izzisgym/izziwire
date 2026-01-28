import { resizeForPlatform, PLATFORM_SIZES } from '../ai/imageResize.js';

export { PLATFORM_SIZES };

export async function getImageBytesForPlatform(
  imageUrl: string,
  platform: 'instagram_feed' | 'instagram_square' | 'instagram_story' | 'facebook_feed' | string
): Promise<Buffer> {
  return resizeForPlatform(imageUrl, platform);
}
