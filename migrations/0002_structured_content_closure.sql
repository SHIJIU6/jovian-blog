ALTER TABLE projects ADD COLUMN image_url TEXT;
ALTER TABLE projects ADD COLUMN tags_json TEXT;

ALTER TABLE resources ADD COLUMN logo_url TEXT;
ALTER TABLE resources ADD COLUMN tags_json TEXT;

ALTER TABLE bloggers ADD COLUMN avatar_url TEXT;

ALTER TABLE pictures ADD COLUMN uploaded_at TEXT;
ALTER TABLE pictures ADD COLUMN image_url TEXT;
ALTER TABLE pictures ADD COLUMN images_json TEXT;
