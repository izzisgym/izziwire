import type { PostStatus, Platform } from '@prisma/client';

export type { PostStatus, Platform };

export interface PendingPostCreate {
  content: string;
  platform: Platform;
  postType: string;
  articleId?: string;
  generatedImageUrl?: string;
  imageSource?: string;
  hashtags?: string[];
  generationMetadata?: Record<string, unknown>;
}

export interface ApprovePostInput {
  scheduledFor?: Date;
  notes?: string;
}
