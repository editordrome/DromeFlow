-- 1. Adicionar o vínculo de Identidade em Profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auth_user_id uuid UNIQUE REFERENCES auth.users(id);

-- Para não quebrar nada e vincular o único usuário atual que bate:
UPDATE public.profiles SET auth_user_id = id WHERE id IN (SELECT id FROM auth.users);

-- Na interface Admin teremos que garantir que novos perfis criados 
-- tenham seus auth_user_ids mapeados. Mas para este MVP, o chat depende de preencher.

-- 2. Corrigir RLS em umbler_user_configs
DROP POLICY IF EXISTS "Usuários podem ver suas próprias configurações" ON public.umbler_user_configs;
DROP POLICY IF EXISTS "Usuários podem inserir suas próprias configurações" ON public.umbler_user_configs;
DROP POLICY IF EXISTS "Usuários podem atualizar suas próprias configurações" ON public.umbler_user_configs;

CREATE POLICY "Acesso as configuracoes (Read)" 
ON public.umbler_user_configs
FOR SELECT 
USING (
  user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid()) 
  OR 
  auth.uid() IN (SELECT auth_user_id FROM public.profiles WHERE role = 'admin')
);

CREATE POLICY "Acesso as configuracoes (Insert)" 
ON public.umbler_user_configs
FOR INSERT 
WITH CHECK (
  user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
);

CREATE POLICY "Acesso as configuracoes (Update)" 
ON public.umbler_user_configs
FOR UPDATE 
USING (
  user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
)
WITH CHECK (
  user_id IN (SELECT id FROM public.profiles WHERE auth_user_id = auth.uid())
);

-- Trigger Function on auth.users -> profiles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  -- Tenta achar o perfil pelo email. Se achar, cadastra o auth_user_id. 
  -- Se não achar, ignora. No sistema atual as contas sao criadas via API.
  UPDATE public.profiles 
  SET auth_user_id = NEW.id 
  WHERE email = NEW.email;
  
  -- Para este projeto, o perfil já contem ID proprio, então apenas linkamos.
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- Forçando a linkagem para os profiles existentes baseados no email 
-- caso seus emails batam com a auth.users (forma segura de mapear)
UPDATE public.profiles p
SET auth_user_id = u.id
FROM auth.users u
WHERE p.email = u.email AND p.auth_user_id IS NULL;
