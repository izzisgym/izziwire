import { getPrisma } from '../api/deps.js';
import type { PendingPostCreate, ApprovePostInput } from './types.js';
import type { PostStatus } from '@prisma/client';

const prisma = getPrisma();

export async function getPendingPosts(limit = 50) {
  return prisma.pendingPost.findMany({
    where: { status: 'pending' },
    orderBy: { createdAt: 'desc' },
    take: limit,
    include: {
      article: { select: { title: true, url: true, game: true } },
    },
  });
}

export async function getPostById(id: string) {
  return prisma.pendingPost.findUnique({
    where: { id },
    include: {
      article: { select: { title: true, url: true, game: true, summary: true } },
    },
  });
}

export async function createPendingPost(data: PendingPostCreate) {
  return prisma.pendingPost.create({
    data: {
      content: data.content,
      platform: data.platform,
      postType: data.postType,
      articleId: data.articleId ?? undefined,
      generatedImageUrl: data.generatedImageUrl ?? undefined,
      imageSource: data.imageSource ?? undefined,
      hashtags: data.hashtags ?? [],
      generationMetadata: data.generationMetadata ?? undefined,
      status: 'pending',
    },
  });
}

export async function approvePost(
  id: string,
  input: ApprovePostInput = {}
): Promise<{ status: PostStatus; scheduledFor?: Date }> {
  const { scheduledFor, notes } = input;
  const status: PostStatus = scheduledFor ? 'scheduled' : 'approved';
  await prisma.pendingPost.update({
    where: { id },
    data: {
      status,
      scheduledFor: scheduledFor ?? undefined,
      reviewerNotes: notes ?? undefined,
      reviewedAt: new Date(),
    },
  });
  return { status, scheduledFor };
}

export async function rejectPost(id: string, reason: string): Promise<void> {
  await prisma.pendingPost.update({
    where: { id },
    data: {
      status: 'rejected',
      reviewerNotes: reason,
      reviewedAt: new Date(),
    },
  });
}
