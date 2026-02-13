-- Migração para adicionar coluna 'teste' em units e automação de espelhamento
-- 1. Adiciona a coluna na tabela units
ALTER TABLE public.units ADD COLUMN IF NOT EXISTS teste BOOLEAN DEFAULT FALSE;

-- 2. Função de sincronização (Espelhamento)
CREATE OR REPLACE FUNCTION public.sync_unit_to_comercial_admin()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
    -- Se a unidade está marcada como teste
    IF (NEW.teste = true) THEN
        -- Se já existe um card vinculado a esta unidade no comercial_admin, atualiza os dados (Espelhamento)
        IF EXISTS (SELECT 1 FROM public.comercial_admin WHERE unit_id = NEW.id) THEN
            UPDATE public.comercial_admin 
            SET nome = NEW.unit_name,
                contato = NEW.contato,
                endereco = NEW.endereco,
                origem = 'Unidade em Teste' -- Garante identificação
            WHERE unit_id = NEW.id;
        ELSE
            -- Se não existe, cria um novo card na coluna 'leads'
            INSERT INTO public.comercial_admin (unit_id, nome, contato, endereco, origem, status)
            VALUES (NEW.id, NEW.unit_name, NEW.contato, NEW.endereco, 'Unidade em Teste', 'leads');
        END IF;
    
    -- Se o modo teste foi desativado (era true e virou false)
    ELSIF (OLD.teste = true AND NEW.teste = false) THEN
        -- Remove o card do Comercial Admin conforme solicitado
        DELETE FROM public.comercial_admin WHERE unit_id = NEW.id;
    END IF;
    
    RETURN NEW;
END;
$$;

-- 3. Trigger para monitorar mudanças na unidade
DROP TRIGGER IF EXISTS trigger_sync_unit_to_comercial ON public.units;
CREATE TRIGGER trigger_sync_unit_to_comercial
AFTER INSERT OR UPDATE OF teste, unit_name, contato, endereco ON public.units
FOR EACH ROW
EXECUTE FUNCTION public.sync_unit_to_comercial_admin();
