import { getPrisma } from '../api/deps.js';
import { postToPage } from '../social/facebook.js';
import { publishPhoto } from '../social/instagram.js';
import { sendSlackNotification } from '../notifications/slack.js';
import { retry } from '../lib/retry.js';
import { getSetting } from '../settings/store.js';
import { publishWordPressDraft } from '../publish/wordpress.js';
import type { PendingPost } from '@prisma/client';

const prisma = getPrisma();

export type PublishResult = {
  wordpress?: { id: number; link?: string };
  facebook?: { id: string; postUrl?: string };
  instagram?: { id: string };
  errors: string[];
};

type PostWithArticle = PendingPost & { article?: { game?: string } | null };

/**
 * Publish a single post to all platforms specified by post.platform.
 * Creates PublishedPost records; does not update pending post status.
 */
export async function publishPostToPlatforms(post: PostWithArticle): Promise<PublishResult> {
  const result: PublishResult = { errors: [] };

  if ((post.platform as string) === 'wordpress') {
    const already = await prisma.publishedPost.findFirst({
      where: { pendingPostId: post.id, platform: 'wordpress' },
    });
    if (!already) {
      try {
        const meta = (post.generationMetadata ?? {}) as { wpTitle?: string; wpTags?: string[]; game?: string };
        const title = meta.wpTitle ?? post.content.slice(0, 80);
        const tags = meta.wpTags ?? post.hashtags ?? [];
        const game = meta.game ?? post.article?.game;
        const categoryId =
          game === 'pokemon'
            ? await getSetting('WP_CATEGORY_POKEMON', 0)
            : game === 'onepiece'
              ? await getSetting('WP_CATEGORY_ONEPIECE', 0)
              : await getSetting('WP_CATEGORY_MTG', 0);
        const wpResult = await publishWordPressDraft({
          title,
          body: post.content,
          tags,
          categoryId,
          featuredImageUrl: post.generatedImageUrl ?? null,
        });
        await prisma.publishedPost.create({
          data: {
            pendingPostId: post.id,
            platform: 'wordpress',
            platformPostId: String(wpResult.id),
            postUrl: wpResult.link ?? undefined,
          },
        });
        result.wordpress = { id: wpResult.id, link: wpResult.link };
      } catch (e) {
        result.errors.push(`WordPress: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  if (post.platform === 'facebook' || post.platform === 'both') {
    const already = await prisma.publishedPost.findFirst({
      where: { pendingPostId: post.id, platform: 'facebook' },
    });
    if (!already) {
      try {
        const payload: { message: string; link?: string; picture?: string } = { message: post.content };
        if (post.generatedImageUrl) payload.picture = post.generatedImageUrl;
        const fbResult = (await retry(() => postToPage(payload), { attempts: 3, delayMs: 2000 })) as {
          id: string;
          post_id?: string;
        };
        await prisma.publishedPost.create({
          data: {
            pendingPostId: post.id,
            platform: 'facebook',
            platformPostId: fbResult.id,
            postUrl: fbResult.post_id ? `https://facebook.com/${fbResult.post_id}` : undefined,
          },
        });
        result.facebook = { id: fbResult.id, postUrl: fbResult.post_id ? `https://facebook.com/${fbResult.post_id}` : undefined };
      } catch (e) {
        result.errors.push(`Facebook: ${e instanceof Error ? e.message : String(e)}`);
      }
    }
  }

  if (post.platform === 'instagram' || post.platform === 'both') {
    const already = await prisma.publishedPost.findFirst({
      where: { pendingPostId: post.id, platform: 'instagram' },
    });
    if (!already) {
      if (!post.generatedImageUrl) {
        result.errors.push('Instagram: requires an image');
      } else {
        try {
          const igResult = (await retry(
            () =>
              publishPhoto({
                imageUrl: post.generatedImageUrl!,
                caption: post.content,
                hashtags: post.hashtags,
              }),
            { attempts: 3, delayMs: 2000 }
          )) as { id: string };
          await prisma.publishedPost.create({
            data: {
              pendingPostId: post.id,
              platform: 'instagram',
              platformPostId: igResult.id,
            },
          });
          result.instagram = { id: igResult.id };
        } catch (e) {
          result.errors.push(`Instagram: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }
  }

  return result;
}

export async function runPublishCycle(): Promise<{ published: number; errors: string[] }> {
  const now = new Date();
  const enabled = await getSetting('PUBLISH_ENABLED', true);
  if (!enabled) {
    return { published: 0, errors: ['Publish disabled'] };
  }
  const batchSize = 25;
  let published = 0;
  const errors: string[] = [];

  while (true) {
    const pending = await prisma.pendingPost.findMany({
      where: {
        status: { in: ['approved', 'scheduled'] },
        OR: [{ scheduledFor: null }, { scheduledFor: { lte: now } }],
      },
      orderBy: { createdAt: 'asc' },
      take: batchSize,
      include: { article: true },
    });
    if (!pending.length) break;

    for (const post of pending) {
      let anySuccess = false;
      try {
        const result = await publishPostToPlatforms(post);
        anySuccess = !!(result.wordpress || result.facebook || result.instagram);
        if (result.wordpress || result.facebook || result.instagram) {
          published += [result.wordpress, result.facebook, result.instagram].filter(Boolean).length;
        }
        if (result.errors.length) {
          errors.push(`Post ${post.id}: ${result.errors.join('; ')}`);
        }
        await prisma.pendingPost.update({
          where: { id: post.id },
          data: {
            status: anySuccess ? 'published' : 'failed',
            reviewerNotes: result.errors.length ? result.errors.join('; ') : undefined,
          },
        });
        if (!anySuccess && result.errors.length) {
          await sendSlackNotification(`Publish failed for post ${post.id}: ${result.errors.join('; ')}`).catch(() => {});
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        errors.push(`Post ${post.id}: ${msg}`);
        await prisma.pendingPost.update({
          where: { id: post.id },
          data: { status: anySuccess ? 'published' : 'failed', reviewerNotes: msg },
        });
        if (!anySuccess) {
          await sendSlackNotification(`Publish failed for post ${post.id}: ${msg}`).catch(() => {});
        }
      }
    }
  }

  return { published, errors };
}
