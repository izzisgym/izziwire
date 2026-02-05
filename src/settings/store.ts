import { getPrisma } from '../api/deps.js';
import type { Prisma } from '@prisma/client';

const prisma = getPrisma();

export type SettingKey =
  | 'SCRAPE_INTERVAL_HOURS'
  | 'USER_AGENT'
  | 'DEFAULT_AI_MODEL'
  | 'IMAGE_MODEL'
  | 'SCRAPE_ENABLED'
  | 'PUBLISH_ENABLED'
  | 'NEWS_SEARCH_ENABLED'
  | 'NEWS_TOPICS_POKEMON'
  | 'NEWS_TOPICS_ONEPIECE'
  | 'NEWS_TOPICS_MTG'
  | 'WP_CATEGORY_POKEMON'
  | 'WP_CATEGORY_ONEPIECE'
  | 'WP_CATEGORY_MTG'
  | 'AUTO_GENERATE_LIMIT'
  | 'AUTO_GENERATE_WINDOW_HOURS';

type SettingsMap = {
  SCRAPE_INTERVAL_HOURS: number;
  USER_AGENT: string;
  DEFAULT_AI_MODEL: string;
  IMAGE_MODEL: string;
  SCRAPE_ENABLED: boolean;
  PUBLISH_ENABLED: boolean;
  NEWS_SEARCH_ENABLED: boolean;
  NEWS_TOPICS_POKEMON: string[];
  NEWS_TOPICS_ONEPIECE: string[];
  NEWS_TOPICS_MTG: string[];
  WP_CATEGORY_POKEMON: number;
  WP_CATEGORY_ONEPIECE: number;
  WP_CATEGORY_MTG: number;
  AUTO_GENERATE_LIMIT: number;
  AUTO_GENERATE_WINDOW_HOURS: number;
};

const cache: Partial<SettingsMap> = {};
let cacheAt = 0;
const CACHE_TTL_MS = 30_000;

function nowMs() {
  return Date.now();
}

function isCacheFresh() {
  return nowMs() - cacheAt < CACHE_TTL_MS;
}

export async function getSetting<K extends SettingKey>(
  key: K,
  fallback: SettingsMap[K]
): Promise<SettingsMap[K]> {
  if (isCacheFresh() && key in cache) {
    return cache[key] as SettingsMap[K];
  }
  const row = await prisma.setting.findUnique({ where: { key } });
  const value = row?.value as Prisma.JsonValue | undefined;
  const resolved = (value ?? fallback) as SettingsMap[K];
  cache[key] = resolved;
  cacheAt = nowMs();
  return resolved;
}

export async function getAllSettings(defaults: SettingsMap): Promise<SettingsMap> {
  if (isCacheFresh() && Object.keys(cache).length) {
    return { ...defaults, ...cache } as SettingsMap;
  }
  const rows = await prisma.setting.findMany({
    where: { key: { in: Object.keys(defaults) } },
  });
  const result = { ...defaults } as SettingsMap;
  for (const row of rows) {
    const key = row.key as SettingKey;
    (result as Record<SettingKey, SettingsMap[SettingKey]>)[key] = row.value as SettingsMap[SettingKey];
  }
  Object.assign(cache, result);
  cacheAt = nowMs();
  return result;
}

export async function setSettings(updates: Partial<SettingsMap>): Promise<void> {
  const entries = Object.entries(updates) as [SettingKey, SettingsMap[SettingKey]][];
  for (const [key, value] of entries) {
    await prisma.setting.upsert({
      where: { key },
      update: { value },
      create: { key, value },
    });
    (cache as Record<SettingKey, SettingsMap[SettingKey]>)[key] = value;
  }
  cacheAt = nowMs();
}
