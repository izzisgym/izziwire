import { getPrisma } from '../api/deps.js';
import { postToPage } from '../social/facebook.js';
import { publishPhoto } from '../social/instagram.js';
import { sendSlackNotification } from '../notifications/slack.js';
import { retry } from '../lib/retry.js';

const prisma = getPrisma();

export async function runPublishCycle(): Promise<{ published: number; errors: string[] }> {
  const now = new Date();
  const pending = await prisma.pendingPost.findMany({
    where: {
      status: { in: ['approved', 'scheduled'] },
      OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
    },
    include: { article: true },
  });
  let published = 0;
  const errors: string[] = [];

  for (const post of pending) {
    try {
      if (post.platform === 'facebook' || post.platform === 'both') {
        const payload: { message: string; link?: string; picture?: string } = {
          message: post.content,
        };
        if (post.generatedImageUrl) payload.picture = post.generatedImageUrl;
        const result = await retry(() => postToPage(payload), { attempts: 3, delayMs: 2000 });
        await prisma.publishedPost.create({
          data: {
            pendingPostId: post.id,
            platform: 'facebook',
            platformPostId: result.id,
            postUrl: result.post_id ? `https://facebook.com/${result.post_id}` : undefined,
          },
        });
        published++;
      }
      if (post.platform === 'instagram' || post.platform === 'both') {
        if (!post.generatedImageUrl) {
          errors.push(`Post ${post.id}: Instagram requires an image`);
          continue;
        }
        const result = await retry(
          () =>
            publishPhoto({
              imageUrl: post.generatedImageUrl!,
              caption: post.content,
              hashtags: post.hashtags,
            }),
          { attempts: 3, delayMs: 2000 }
        );
        await prisma.publishedPost.create({
          data: {
            pendingPostId: post.id,
            platform: 'instagram',
            platformPostId: result.id,
          },
        });
        published++;
      }
      await prisma.pendingPost.update({
        where: { id: post.id },
        data: { status: 'published' },
      });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`Post ${post.id}: ${msg}`);
      await prisma.pendingPost.update({
        where: { id: post.id },
        data: { status: 'failed', reviewerNotes: msg },
      });
      await sendSlackNotification(`Publish failed for post ${post.id}: ${msg}`).catch(() => {});
    }
  }

  return { published, errors };
}
