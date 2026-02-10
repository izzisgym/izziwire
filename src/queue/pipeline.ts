import { getPrisma } from '../api/deps.js';
import { generatePost } from '../ai/contentGenerator.js';
import { generateWordPressPost } from '../ai/wordpressGenerator.js';
import type { Platform } from '@prisma/client';

const prisma = getPrisma();

export async function runPipelineForArticle(params: {
  articleId: string;
  platform?: Platform;
  postType?: string;
  generateImage?: boolean;
}): Promise<string> {
  const { articleId, platform = 'instagram', postType = 'news' } = params;

  const article = await prisma.article.findUniqueOrThrow({
    where: { id: articleId },
    include: { source: true },
  });

  let result: { content: string; hashtags: string[]; tokensUsed?: number; model?: string };
  let wpTitle: string | undefined;
  let wpTags: string[] | undefined;

  if ((platform as string) === 'wordpress') {
    const wp = await generateWordPressPost({
      topic: article.title,
      summary: article.summary ?? undefined,
      game: article.game,
    });
    result = { content: wp.body, hashtags: wp.tags, tokensUsed: wp.tokensUsed, model: undefined };
    wpTitle = wp.title;
    wpTags = wp.tags;
  } else {
    result = await generatePost({
      topic: article.title,
      postType: postType as 'news' | 'engagement' | 'card_spotlight' | 'poll',
      platform: platform as string,
      game: article.game,
      facts: article.summary ?? undefined,
    });
  }

  // Use the image from the scraped article source instead of generating one
  const generatedImageUrl = article.imageUrl ?? null;
  const imageSource = article.imageUrl ? 'original' : 'none';

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
      generationMetadata:
        result.tokensUsed != null || wpTitle
          ? { tokensUsed: result.tokensUsed, wpTitle, wpTags }
          : undefined,
    },
  });

  return post.id;
}
