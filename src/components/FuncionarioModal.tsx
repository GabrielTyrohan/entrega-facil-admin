import React, { useState, useEffect } from 'react';
import { X, User, Mail, Phone, Briefcase, Lock, Eye, EyeOff } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useCreateFuncionario, useUpdateFuncionario, Funcionario } from '../hooks/useFuncionarios';
import { toast } from '../utils/toast';

interface FuncionarioModalProps {
  isOpen: boolean;
  onClose: () => void;
  funcionarioToEdit?: Funcionario | null;
}

const DEFAULT_PERMISSIONS = {
  orcamentos_pj: false,
  vendas_atacado: false,
  notas_fiscais: false,
  caixa: false,
  acertos: false,
  relatorios: false
};

const FuncionarioModal: React.FC<FuncionarioModalProps> = ({ isOpen, onClose, funcionarioToEdit }) => {
  const { user } = useAuth();
  const createMutation = useCreateFuncionario();
  const updateMutation = useUpdateFuncionario();
  
  const [nome, setNome] = useState('');
  const [email, setEmail] = useState('');
  const [telefone, setTelefone] = useState('');
  const [cargo, setCargo] = useState('');
  const [senha, setSenha] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [permissions, setPermissions] = useState(DEFAULT_PERMISSIONS);

  useEffect(() => {
    if (isOpen) {
        if (funcionarioToEdit) {
            setNome(funcionarioToEdit.nome);
            setEmail(funcionarioToEdit.email);
            setTelefone(funcionarioToEdit.telefone || '');
            setCargo(funcionarioToEdit.cargo || '');
            setPermissions({ ...DEFAULT_PERMISSIONS, ...funcionarioToEdit.permissoes });
            setSenha(''); 
        } else {
            setNome('');
            setEmail('');
            setTelefone('');
            setCargo('');
            setPermissions(DEFAULT_PERMISSIONS);
            setSenha(Math.floor(100000 + Math.random() * 900000).toString());
        }
    }
  }, [funcionarioToEdit, isOpen]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    if (isOpen) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  const handlePermissionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, checked } = e.target;
    setPermissions(prev => ({ ...prev, [name]: checked }));
  };

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!nome || !email || (!funcionarioToEdit && !senha)) {
      toast.error('Preencha os campos obrigatórios');
      return;
    }

    try {
      if (funcionarioToEdit) {
        await updateMutation.mutateAsync({
          id: funcionarioToEdit.id,
          nome,
          email,
          telefone,
          cargo,
          permissoes: permissions
        });
        toast.success('Funcionário atualizado com sucesso!');
      } else {
        await createMutation.mutateAsync({
          administrador_id: user?.id,
          nome,
          email,
          senha,
          telefone,
          cargo,
          permissoes: permissions
        });
        toast.success(`Funcionário criado! Senha: ${senha}`, { duration: 10000 });
      }
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || 'Erro ao salvar funcionário');
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-2 sm:p-4"
      onClick={handleBackdropClick}
    >
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 sm:p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {funcionarioToEdit ? 'Editar Funcionário' : 'Novo Funcionário'}
          </h2>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg">
            <X className="w-5 h-5 text-gray-500 dark:text-gray-400" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 sm:p-6 space-y-4">
            {/* Info Pessoal */}
            <div className="space-y-4">
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Nome Completo *</label>
                    <div className="relative">
                        <User className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                            type="text"
                            value={nome}
                            onChange={e => setNome(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            required
                        />
                    </div>
                </div>
                <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Email *</label>
                    <div className="relative">
                        <Mail className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                        <input
                            type="email"
                            value={email}
                            onChange={e => setEmail(e.target.value)}
                            className="w-full pl-10 pr-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            required
                        />
                    </div>
                </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Telefone</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={telefone}
                                onChange={e => setTelefone(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Cargo</label>
                        <div className="relative">
                            <Briefcase className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input
                                type="text"
                                value={cargo}
                                onChange={e => setCargo(e.target.value)}
                                className="w-full pl-10 pr-3 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                            />
                        </div>
                    </div>
                 </div>

                 {!funcionarioToEdit && (
                    <div>
                        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Senha *</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-2.5 w-4 h-4 text-gray-400" />
                            <input
                                type={showPassword ? "text" : "password"}
                                value={senha}
                                onChange={e => setSenha(e.target.value)}
                                className="w-full pl-10 pr-10 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                                required
                            />
                             <button
                                type="button"
                                onClick={() => setShowPassword(!showPassword)}
                                className="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                            </button>
                        </div>
                         <p className="text-xs text-gray-500 mt-1">Senha gerada automaticamente: {senha}</p>
                    </div>
                 )}
            </div>

            <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
                <h3 className="text-sm font-semibold text-gray-900 dark:text-white mb-3">Permissões de Acesso</h3>
                <div className="grid grid-cols-2 gap-3">
                    {Object.keys(DEFAULT_PERMISSIONS).map((key) => (
                        <label key={key} className="flex items-center space-x-2 cursor-pointer">
                            <input
                                name={key}
                                type="checkbox"
                                checked={permissions[key as keyof typeof permissions]}
                                onChange={handlePermissionChange}
                                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <span className="text-sm text-gray-700 dark:text-gray-300 capitalize">
                                {key.replace('_', ' ')}
                            </span>
                        </label>
                    ))}
                </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
                <button
                    type="button"
                    onClick={onClose}
                    className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 dark:bg-gray-700 dark:text-gray-300 dark:border-gray-600 dark:hover:bg-gray-600"
                >
                    Cancelar
                </button>
                <button
                    type="submit"
                    className="px-4 py-2 text-sm font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-blue-500"
                >
                    {funcionarioToEdit ? 'Salvar Alterações' : 'Criar Funcionário'}
                </button>
            </div>
        </form>
      </div>
    </div>
  );
};

export default FuncionarioModal;
