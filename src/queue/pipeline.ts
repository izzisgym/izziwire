import { getPrisma } from '../api/deps.js';
import { generatePost } from '../ai/contentGenerator.js';
import { generateImage } from '../ai/imageGenerator.js';
import type { Platform } from '@prisma/client';

const prisma = getPrisma();

export async function runPipelineForArticle(params: {
  articleId: string;
  platform?: Platform;
  postType?: string;
  generateImage?: boolean;
}): Promise<string> {
  const { articleId, platform = 'instagram', postType = 'news', generateImage: doImage = false } = params;

  const article = await prisma.article.findUniqueOrThrow({
    where: { id: articleId },
    include: { source: true },
  });

  const result = await generatePost({
    topic: article.title,
    postType: postType as 'news' | 'engagement' | 'card_spotlight' | 'poll',
    platform: platform as string,
    game: article.game,
    facts: article.summary ?? undefined,
  });

  let generatedImageUrl: string | null = null;
  let imageSource: string | null = null;
  if (doImage) {
    try {
      generatedImageUrl = await generateImage({
        topic: article.title,
        game: article.game,
      });
      imageSource = 'dalle';
    } catch {
      imageSource = 'none';
    }
  }

  const post = await prisma.pendingPost.create({
    data: {
      articleId: article.id,
      content: result.content,
      platform: platform as Platform,
      postType,
      generatedImageUrl,
      imageSource,
      hashtags: result.hashtags,
      status: 'pending',
      aiModel: result.model ?? undefined,
      generationMetadata: result.tokensUsed != null ? { tokensUsed: result.tokensUsed } : undefined,
    },
  });

  return post.id;
}
