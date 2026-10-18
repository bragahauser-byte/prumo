-- Foto de perfil (JPEG reduzido em data URL) e preferências de notificação (alertas, insights e lembretes programados).
alter table public.profiles
  add column avatar_data text check (avatar_data is null or (length(avatar_data) <= 200000 and avatar_data like 'data:image/%')),
  add column notification_settings jsonb;
