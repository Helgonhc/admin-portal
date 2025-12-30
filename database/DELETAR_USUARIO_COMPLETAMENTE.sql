-- =====================================================
-- FUNÇÃO: DELETAR USUÁRIO COMPLETAMENTE (AUTH + PROFILES)
-- =====================================================

-- Remover função antiga para evitar erro de tipo de retorno
DROP FUNCTION IF EXISTS delete_user_completely(uuid);

CREATE OR REPLACE FUNCTION delete_user_completely(user_uuid UUID)
RETURNS JSONB AS $$
DECLARE
  v_user_email TEXT;
BEGIN
  -- 1. Obter o e-mail do usuário para logs/confirmação (opcional)
  SELECT email INTO v_user_email FROM auth.users WHERE id = user_uuid;

  IF v_user_email IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Usuário não encontrado no sistema de autenticação.');
  END IF;

  -- 2. Deletar do auth.users (isso dispara o ON DELETE CASCADE para public.profiles)
  -- Se não houver CASCADE, deletamos manualmente abaixo
  DELETE FROM auth.users WHERE id = user_uuid;

  -- 3. Garantir que o perfil foi removido (caso não haja cascade)
  DELETE FROM public.profiles WHERE id = user_uuid;

  RETURN jsonb_build_object(
    'success', true, 
    'message', format('Usuário %s (%s) excluído permanentemente.', v_user_email, user_uuid)
  );

EXCEPTION WHEN OTHERS THEN
  RETURN jsonb_build_object(
    'success', false, 
    'message', 'Erro ao excluir usuário: ' || SQLERRM
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Permissões
GRANT EXECUTE ON FUNCTION delete_user_completely TO authenticated;
GRANT EXECUTE ON FUNCTION delete_user_completely TO service_role;

-- Comentário
COMMENT ON FUNCTION delete_user_completely IS 'Exclui um usuário permanentemente do Auth e do Profiles.';
