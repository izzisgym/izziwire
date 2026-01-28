import * as repo from './repository.js';
import { sendSlackNotification } from '../notifications/slack.js';
import type { PendingPostCreate, ApprovePostInput } from './types.js';

export async function createPendingPost(data: PendingPostCreate) {
  const post = await repo.createPendingPost(data);
  await sendSlackNotification(
    `New ${data.postType} post pending approval!\nPlatform: ${data.platform}\nPreview: ${data.content.slice(0, 100)}...`
  );
  return post;
}

export const getPendingPosts = repo.getPendingPosts;
export const getPostById = repo.getPostById;

export async function approvePost(id: string, input: ApprovePostInput = {}) {
  const current = await repo.getPostById(id);
  if (!current) throw new Error('Post not found');
  if (current.status !== 'pending') throw new Error(`Invalid transition from ${current.status}`);
  return repo.approvePost(id, input);
}

export async function rejectPost(id: string, reason: string) {
  const current = await repo.getPostById(id);
  if (!current) throw new Error('Post not found');
  if (current.status !== 'pending') throw new Error(`Invalid transition from ${current.status}`);
  return repo.rejectPost(id, reason);
}
