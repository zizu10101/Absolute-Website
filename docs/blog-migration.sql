-- Run in Supabase SQL editor before using the Blog (Gear Guides) feature.
-- No DDL execution path exists from the app or its scripts (anon/service-role REST keys only,
-- not a Postgres connection), so this always has to be run manually — same as every other
-- migration in this project.

CREATE TABLE IF NOT EXISTS blog_posts (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  title TEXT NOT NULL,
  slug TEXT NOT NULL UNIQUE,
  content TEXT NOT NULL,
  excerpt TEXT,
  image_url TEXT,
  thumbnail_url TEXT,
  author TEXT DEFAULT 'Absolute Soccer Gear Experts',
  is_published BOOLEAN NOT NULL DEFAULT false,
  published_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  featured_product_ids UUID[] DEFAULT '{}'
);

CREATE INDEX IF NOT EXISTS idx_blog_posts_slug ON blog_posts(slug);
CREATE INDEX IF NOT EXISTS idx_blog_posts_published ON blog_posts(is_published, published_at DESC);

-- If blog_posts already exists from an earlier run of this file (before thumbnail_url /
-- featured_product_ids were added), run these lines on their own to add the columns
-- without re-running the rest:
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS thumbnail_url TEXT;
ALTER TABLE blog_posts ADD COLUMN IF NOT EXISTS featured_product_ids UUID[] DEFAULT '{}';

-- Seed: first Gear Guides article
INSERT INTO blog_posts (title, slug, content, excerpt, author, is_published)
VALUES (
  'FG vs AG vs Turf: Which Soccer Cleat Do You Actually Need?',
  'fg-vs-ag-vs-turf-soccer-cleats',
  '## Introduction
Buying soccer cleats used to be simple. But with modern synthetic turf fields across Canada, choosing the wrong outsole can ruin your gear or cause knee injuries.

## Firm Ground (FG) Cleats: For Natural Grass
Firm Ground cleats are designed for natural grass pitches.

**Stud Design:** Plastic or TPU studs that dig into real soil.
**Best For:** Natural grass fields.
**Caution:** Do not use FG cleats on artificial turf! Bladed studs can cause ACL injuries.

## Artificial Grass (AG) Cleats: For Modern Turf
Built for 3G and 4G rubber infill turf fields.

**Stud Design:** Shorter, round hollow studs for smooth rotation.
**Best For:** Modern artificial turf pitches.

## Turf Shoes (TF): For Indoor and Hard Ground
**Stud Design:** Flat rubber outsole with small rubber nubs.
**Best For:** Indoor facilities, hard ground, short carpet turf.

## Quick Reference Guide

| Field Type | Recommended Shoe | Stud Type |
|-----------|-----------------|-----------|
| Natural Grass | Firm Ground (FG) | Bladed/Molded studs |
| 3G/4G Turf | Artificial Grass (AG) | Short round studs |
| Indoor/Hard Ground | Turf (TF) | Rubber nubs |

## Final Thoughts
Playing on the correct outsole keeps you safe and improves performance.

Browse our full collection of [FG, AG, and Turf cleats](/category/footwear) at Absolute Soccer Mississauga!',
  'Confused about FG, AG, and Turf soccer cleats? Learn the key differences and which cleat is right for your field type.',
  'Absolute Soccer Gear Experts',
  true
);
