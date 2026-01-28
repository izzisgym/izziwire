-- CreateEnum
CREATE TYPE "Game" AS ENUM ('pokemon', 'onepiece', 'mtg');

-- CreateEnum
CREATE TYPE "Platform" AS ENUM ('facebook', 'instagram', 'both');

-- CreateEnum
CREATE TYPE "PostStatus" AS ENUM ('pending', 'approved', 'rejected', 'scheduled', 'published', 'failed');

-- CreateTable
CREATE TABLE "news_sources" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "game" "Game" NOT NULL,
    "source_type" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "rss_feed_url" TEXT,
    "scrape_selector" JSONB,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "priority" INTEGER NOT NULL DEFAULT 5,
    "last_scraped_at" TIMESTAMP(3),
    "last_etag" TEXT,
    "last_modified" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "news_sources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "articles" (
    "id" TEXT NOT NULL,
    "source_id" TEXT NOT NULL,
    "external_id" TEXT,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "summary" TEXT,
    "image_url" TEXT,
    "published_at" TIMESTAMP(3),
    "scraped_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "game" "Game" NOT NULL,
    "content_type" TEXT,
    "is_processed" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "articles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pending_posts" (
    "id" TEXT NOT NULL,
    "article_id" TEXT,
    "content" TEXT NOT NULL,
    "platform" "Platform" NOT NULL,
    "post_type" TEXT NOT NULL,
    "generated_image_url" TEXT,
    "image_source" TEXT,
    "hashtags" TEXT[] NOT NULL,
    "status" "PostStatus" NOT NULL DEFAULT 'pending',
    "reviewer_notes" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "scheduled_for" TIMESTAMP(3),
    "ai_model" TEXT,
    "generation_metadata" JSONB,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pending_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "published_posts" (
    "id" TEXT NOT NULL,
    "pending_post_id" TEXT,
    "platform" TEXT NOT NULL,
    "platform_post_id" TEXT,
    "published_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "post_url" TEXT,
    "likes" INTEGER NOT NULL DEFAULT 0,
    "comments" INTEGER NOT NULL DEFAULT 0,
    "shares" INTEGER NOT NULL DEFAULT 0,
    "reach" INTEGER NOT NULL DEFAULT 0,
    "metrics_updated_at" TIMESTAMP(3),

    CONSTRAINT "published_posts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "social_tokens" (
    "id" TEXT NOT NULL,
    "platform" TEXT NOT NULL,
    "account_name" TEXT,
    "page_id" TEXT,
    "access_token" TEXT NOT NULL,
    "token_type" TEXT,
    "expires_at" TIMESTAMP(3),
    "refresh_token" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "social_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "articles_url_key" ON "articles"("url");

-- CreateIndex
CREATE INDEX "articles_game_idx" ON "articles"("game");

-- CreateIndex
CREATE INDEX "articles_is_processed_idx" ON "articles"("is_processed");

-- CreateIndex
CREATE INDEX "pending_posts_status_idx" ON "pending_posts"("status");

-- CreateIndex
CREATE INDEX "idx_pending_scheduled" ON "pending_posts"("scheduled_for");

-- CreateIndex
CREATE INDEX "published_posts_platform_published_at_idx" ON "published_posts"("platform", "published_at");

-- AddForeignKey
ALTER TABLE "articles" ADD CONSTRAINT "articles_source_id_fkey" FOREIGN KEY ("source_id") REFERENCES "news_sources"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pending_posts" ADD CONSTRAINT "pending_posts_article_id_fkey" FOREIGN KEY ("article_id") REFERENCES "articles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "published_posts" ADD CONSTRAINT "published_posts_pending_post_id_fkey" FOREIGN KEY ("pending_post_id") REFERENCES "pending_posts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
