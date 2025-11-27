export const handleSupabaseError = (error: any): string => {
  if (!error) return 'Erro desconhecido';
  const message = error.message || '';

  if (message.includes('apenas administradores') || message.includes('Apenas administradores')) {
    return 'Você não tem permissão de administrador';
  }
  if (message.includes('não autenticado') || message.includes('Usuário não autenticado')) {
    return 'Sessão expirada. Faça login novamente';
  }
  if (message.includes('sua conta') || message.includes('da sua conta')) {
    return 'Você só pode gerenciar recursos da sua conta';
  }
  if (message.includes('Sem permissão') || message.includes('não tem permissão')) {
    return 'Você não tem permissão para esta operação';
  }
  if (message.includes('não encontrado') || message.includes('não pertence')) {
    return 'Registro não encontrado ou não pertence a você';
  }
  if (message.includes('6 números') || message.includes('6 dígitos')) {
    return 'Senha deve conter exatamente 6 números';
  }
  if (error.code === 'PGRST301' || error.code === '401') {
    return 'Token inválido. Faça login novamente';
  }
  if (error.code === '23505') return 'Registro duplicado';
  if (error.code === '23503') return 'Não é possível excluir: existem registros vinculados';
  if (error.code === '23502') return 'Campo obrigatório não preenchido';
  
  return message || 'Erro ao processar operação';
};

export const isAuthError = (error: any): boolean => {
  if (!error) return false;
  const message = error.message || '';
  return message.includes('não autenticado') || message.includes('JWT') || 
         error.code === 'PGRST301' || error.code === '401';
};
