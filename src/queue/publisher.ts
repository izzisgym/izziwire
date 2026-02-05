import { getPrisma } from '../api/deps.js';
import { postToPage } from '../social/facebook.js';
import { publishPhoto } from '../social/instagram.js';
import { sendSlackNotification } from '../notifications/slack.js';
import { retry } from '../lib/retry.js';
import { getSetting } from '../settings/store.js';
import { publishWordPressDraft } from '../publish/wordpress.js';

const prisma = getPrisma();

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
      const errorNotes: string[] = [];
      try {
        if (post.platform === 'wordpress') {
          const already = await prisma.publishedPost.findFirst({
            where: { pendingPostId: post.id, platform: 'wordpress' },
          });
          if (!already) {
            const meta = (post.generationMetadata ?? {}) as { wpTitle?: string; wpTags?: string[] };
            const title = meta.wpTitle ?? post.content.slice(0, 80);
            const tags = meta.wpTags ?? post.hashtags ?? [];
            const game = post.article?.game;
            const categoryId =
              game === 'pokemon'
                ? await getSetting('WP_CATEGORY_POKEMON', 0)
                : game === 'onepiece'
                  ? await getSetting('WP_CATEGORY_ONEPIECE', 0)
                  : await getSetting('WP_CATEGORY_MTG', 0);
            const result = await publishWordPressDraft({
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
                platformPostId: String(result.id),
                postUrl: result.link ?? undefined,
              },
            });
            published++;
            anySuccess = true;
          } else {
            anySuccess = true;
          }
        }
        if (post.platform === 'facebook' || post.platform === 'both') {
          const already = await prisma.publishedPost.findFirst({
            where: { pendingPostId: post.id, platform: 'facebook' },
          });
          if (!already) {
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
            anySuccess = true;
          } else {
            anySuccess = true;
          }
        }
        if (post.platform === 'instagram' || post.platform === 'both') {
          const already = await prisma.publishedPost.findFirst({
            where: { pendingPostId: post.id, platform: 'instagram' },
          });
          if (!already) {
            if (!post.generatedImageUrl) {
              errorNotes.push('Instagram requires an image');
            } else {
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
              anySuccess = true;
            }
          } else {
            anySuccess = true;
          }
        }

        if (errorNotes.length) {
          const msg = `Post ${post.id}: ${errorNotes.join('; ')}`;
          errors.push(msg);
          await prisma.pendingPost.update({
            where: { id: post.id },
            data: { status: anySuccess ? 'published' : 'failed', reviewerNotes: errorNotes.join('; ') },
          });
          if (!anySuccess) {
            await sendSlackNotification(`Publish failed for post ${post.id}: ${errorNotes.join('; ')}`).catch(() => {});
          }
        } else {
          await prisma.pendingPost.update({
            where: { id: post.id },
            data: { status: 'published' },
          });
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
