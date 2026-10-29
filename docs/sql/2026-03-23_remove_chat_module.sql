-- =====================================================
-- Migração: Remoção do Módulo de Chat Umbler (uTalk V2)
-- Data: 2026-03-23
-- Descrição: Remove todas as tabelas, views, e colunas vinculadas ao módulo de chat.
-- =====================================================

-- 1. DROP VIEW
DROP VIEW IF EXISTS public.v_utalk_my_chats;

-- 2. DROP TABLES
DROP TABLE IF EXISTS public.utalk_messages CASCADE;
DROP TABLE IF EXISTS public.utalk_chats CASCADE;
DROP TABLE IF EXISTS public.utalk_contacts CASCADE;
DROP TABLE IF EXISTS public.utalk_integrations CASCADE;
DROP TABLE IF EXISTS public.utalk_user_map CASCADE;
DROP TABLE IF EXISTS public.utalk_webhook_events CASCADE;

-- 3. DROP COLUMNS (se exisirem)
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'profiles' 
    AND column_name = 'umbler_member_id'
  ) THEN
    ALTER TABLE public.profiles DROP COLUMN umbler_member_id;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'user_profiles' 
    AND column_name = 'umbler_member_id'
  ) THEN
    ALTER TABLE public.user_profiles DROP COLUMN umbler_member_id;
  END IF;
END $$;

-- 4. REMOVE MODULE
DELETE FROM public.modules WHERE code = 'chat';
