import { PrismaClient } from '@prisma/client';
import { getConfig as getAppConfig, type Config } from '../config.js';

export const getConfig = getAppConfig;
export type { Config };

let prismaInstance: PrismaClient | null = null;

export function getPrisma(): PrismaClient {
  if (!prismaInstance) {
    prismaInstance = new PrismaClient();
  }
  return prismaInstance;
}
