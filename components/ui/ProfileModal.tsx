import React, { useState, useEffect } from 'react';
import { User } from '../../types';
import { Icon } from './Icon';

interface ProfileModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSave: (data: { email?: string; password?: string; full_name?: string }) => Promise<void>;
    user: User | null;
    // Opcional: valor inicial do nome se não vier no objeto user (mantido para compatibilidade futura)
    fullNameInitial?: string;
}

const ProfileModal: React.FC<ProfileModalProps> = ({ isOpen, onClose, onSave, user, fullNameInitial }) => {
    const [email, setEmail] = useState('');
    const [fullName, setFullName] = useState('');
    const [password, setPassword] = useState('');
    const [confirmPassword, setConfirmPassword] = useState('');
    const [error, setError] = useState('');
    const [successMessage, setSuccessMessage] = useState('');
    const [isLoading, setIsLoading] = useState(false);

    useEffect(() => {
        if (user) {
            setEmail(user.email);
        }
        setFullName((user as any)?.full_name || fullNameInitial || '');
        // Redefinir estado ao abrir/fechar
        setError('');
        setSuccessMessage('');
        setPassword('');
        setConfirmPassword('');
    }, [user, isOpen, fullNameInitial]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError('');
        setSuccessMessage('');

        if (password && password !== confirmPassword) {
            setError('As senhas não coincidem.');
            return;
        }
        if (password && password.length < 6) {
            setError('A senha deve ter pelo menos 6 caracteres.');
            return;
        }

        const dataToUpdate: { email?: string; password?: string; full_name?: string } = {};
        if (email !== user?.email) {
            dataToUpdate.email = email;
        }
        if (password) {
            dataToUpdate.password = password;
        }
        if (fullName && fullName.trim().length > 0 && fullName !== (user as any)?.full_name) {
            dataToUpdate.full_name = fullName.trim();
        }

        if (Object.keys(dataToUpdate).length === 0) {
            setSuccessMessage("Nenhuma alteração para salvar.");
            setTimeout(onClose, 2000);
            return;
        }

        setIsLoading(true);
        try {
            await onSave(dataToUpdate);
            setSuccessMessage("Perfil atualizado com sucesso!");
             setTimeout(onClose, 2000);
        } catch (err: any) {
            setError(err.message || 'Falha ao atualizar o perfil.');
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-60" aria-modal="true" role="dialog" onClick={onClose}>
            <div className="w-full max-w-lg p-6 mx-4 bg-bg-secondary rounded-lg shadow-lg" onClick={(e)=>e.stopPropagation()}>
                <div className="flex items-center justify-between pb-3 border-b border-border-primary">
                    <h2 className="text-xl font-bold text-text-primary">Meu Perfil</h2>
                    <button onClick={onClose} className="p-1 rounded-full text-text-secondary hover:bg-bg-tertiary">
                        <Icon name="close" />
                    </button>
                </div>
                <form onSubmit={handleSubmit} className="mt-6 space-y-4">
                    {error && <p className="text-sm text-center text-danger bg-danger/10 p-2 rounded-md">{error}</p>}
                    {successMessage && <p className="text-sm text-center text-success bg-success/10 p-2 rounded-md">{successMessage}</p>}
                    
                    <div>
                        <label htmlFor="profile_full_name" className="block text-sm font-medium text-text-secondary">Nome Completo</label>
                        <input
                            type="text"
                            name="full_name"
                            id="profile_full_name"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            placeholder="Seu nome"
                            className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
                        />
                    </div>
                    <div>
                        <label htmlFor="profile_email" className="block text-sm font-medium text-text-secondary">Email</label>
                        <input
                            type="email"
                            name="email"
                            id="profile_email"
                            value={email}
                            onChange={(e) => setEmail(e.target.value)}
                            required
                            className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
                        />
                    </div>
                    <div>
                        <label htmlFor="profile_password" className="block text-sm font-medium text-text-secondary">Nova Senha</label>
                        <input
                            type="password"
                            name="password"
                            id="profile_password"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Deixe em branco para não alterar"
                            className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
                        />
                    </div>
                     <div>
                        <label htmlFor="profile_confirm_password" className="block text-sm font-medium text-text-secondary">Confirmar Nova Senha</label>
                        <input
                            type="password"
                            name="confirm_password"
                            id="profile_confirm_password"
                            value={confirmPassword}
                            onChange={(e) => setConfirmPassword(e.target.value)}
                            placeholder="Repita a nova senha"
                            className="w-full px-3 py-2 mt-1 border rounded-md bg-bg-secondary border-border-secondary focus:ring-accent-primary focus:border-accent-primary"
                            disabled={!password}
                        />
                    </div>

                    <div className="flex justify-end pt-4 space-x-3">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={isLoading}
                            className="px-4 py-2 text-sm font-medium border rounded-md text-text-secondary border-border-secondary hover:bg-bg-tertiary disabled:opacity-50"
                        >
                            Cancelar
                        </button>
                        <button
                            type="submit"
                            disabled={isLoading}
                            className="flex items-center justify-center w-32 px-4 py-2 text-sm font-medium text-white border border-transparent rounded-md bg-accent-primary hover:bg-accent-secondary disabled:bg-gray-400"
                        >
                            {isLoading ? (
                                <div className="w-5 h-5 border-2 border-white rounded-full border-t-transparent animate-spin"></div>
                            ) : (
                                'Salvar'
                            )}
                        </button>
                    </div>
                     <p className="text-xs text-center text-text-secondary pt-2">
                        Se você alterar seu e-mail, será necessário confirmá-lo através de um link enviado para o novo endereço.
                    </p>
                </form>
            </div>
        </div>
    );
};

export default ProfileModal;
