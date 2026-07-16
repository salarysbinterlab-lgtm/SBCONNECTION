-- 90_seed_app_settings.sql
insert into app_settings(key, value, description, is_public) values
('UPLOAD_FOLDER_ID','1rYD6ys45AziVhhjZEczxejzW5i2YOljz','Google Drive folder: general uploads / news / mission / IT attachments', false),
('REWARD_FOLDER_ID','1lPC8VGyf6OQqomQgBRxHPJ8FgtcaVc5b','Google Drive folder: reward images', false),
('GOOGLE_DRIVE_FOLDER_ID','1wOfrms0w-_LRvc0eUbwzGayco3NFakdU','Google Drive folder: main docs/logo/reports', false),
('USER_AVATAR_FOLDER_ID','1rYD6ys45AziVhhjZEczxejzW5i2YOljz','Google Drive folder: user avatars, fallback to UPLOAD_FOLDER_ID', false),
('DEFAULT_AVATAR_URL','https://cdn-icons-png.flaticon.com/512/149/149071.png','Default avatar URL', true)
on conflict (key) do update set
  value = excluded.value,
  description = excluded.description,
  is_public = excluded.is_public,
  updated_at = now();
