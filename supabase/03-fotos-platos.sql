-- ==========================================================================
-- PUNTO ASADO - FOTOS DE LOS PLATOS (SUPABASE STORAGE)
-- Ejecutar UNA vez en Supabase → SQL Editor (después de esquema.sql).
-- Crea la carpeta pública "fotos-platos" donde el Panel de administrador
-- guarda las fotos que el admin sube desde su computadora o celular.
-- Cualquiera puede VER las fotos (la carta es pública); solo el admin
-- puede subirlas, cambiarlas o borrarlas.
-- ==========================================================================

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('fotos-platos', 'fotos-platos', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp'])
on conflict (id) do update
  set public = true,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "admin sube fotos de platos" on storage.objects;
create policy "admin sube fotos de platos" on storage.objects
  for insert to authenticated
  with check (bucket_id = 'fotos-platos' and public.es_admin());

drop policy if exists "admin cambia fotos de platos" on storage.objects;
create policy "admin cambia fotos de platos" on storage.objects
  for update to authenticated
  using (bucket_id = 'fotos-platos' and public.es_admin());

drop policy if exists "admin borra fotos de platos" on storage.objects;
create policy "admin borra fotos de platos" on storage.objects
  for delete to authenticated
  using (bucket_id = 'fotos-platos' and public.es_admin());
