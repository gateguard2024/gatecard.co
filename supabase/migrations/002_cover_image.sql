-- Add cover image URL to sites (nullable — falls back to gradient if null)
alter table sites add column if not exists cover_image_url text;
