import React, { useState, useEffect, useRef } from 'react';
import { searchProfissionaisByName, Profissional } from '../../services/profissionais/profissionais.service';
import { Icon } from './Icon';

interface ProfessionalAutocompleteProps {
    unitId: string;
    value: string; // Nome da profissional atual
    onChange: (nome: string) => void;
    onSelect?: () => void; // Callback após seleção
    className?: string;
    disabled?: boolean;
    // Dados do atendimento atual para filtro de conflito
    appointmentData?: {
        data: string | null;
        horario: string;
        periodo: string | null;
        atendimentoId?: string;
    };
}

export const ProfessionalAutocomplete: React.FC<ProfessionalAutocompleteProps> = ({
    unitId,
    value,
    onChange,
    onSelect,
    className = '',
    disabled = false,
    appointmentData
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [suggestions, setSuggestions] = useState<Profissional[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(-1);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Fecha dropdown ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
                setSelectedIndex(-1);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Busca com debounce
    useEffect(() => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        if (searchTerm.trim().length < 2) {
            setSuggestions([]);
            setIsLoading(false);
            return;
        }

        setIsLoading(true);
        debounceTimer.current = setTimeout(async () => {
            try {
                const results = await searchProfissionaisByName(
                    unitId,
                    searchTerm,
                    appointmentData || { data: null, horario: '', periodo: null },
                    10
                );
                setSuggestions(results);
            } catch (error) {
                console.error('Erro ao buscar profissionais:', error);
                setSuggestions([]);
            } finally {
                setIsLoading(false);
            }
        }, 300); // 300ms de debounce

        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, [searchTerm, unitId]);

    const handleSelect = (profissional: Profissional) => {
        onChange(profissional.nome || '');
        setIsOpen(false);
        setSearchTerm('');
        setSelectedIndex(-1);
        if (onSelect) onSelect();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen || suggestions.length === 0) return;

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev =>
                    prev < suggestions.length - 1 ? prev + 1 : prev
                );
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex >= 0 && selectedIndex < suggestions.length) {
                    handleSelect(suggestions[selectedIndex]);
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                setSearchTerm('');
                setSelectedIndex(-1);
                break;
        }
    };

    return (
        <div ref={wrapperRef} className={`relative ${className}`}>
            {!isOpen ? (
                // Modo visualização: mostra nome atual
                <button
                    type="button"
                    onClick={() => {
                        if (!disabled) {
                            setIsOpen(true);
                            setTimeout(() => inputRef.current?.focus(), 0);
                        }
                    }}
                    disabled={disabled}
                    className="w-full rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary hover:border-accent-primary/50 focus:outline-none transition-all text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    <span className={`truncate ${value ? 'text-text-primary' : 'text-text-tertiary'}`}>
                        {value || 'Selecionar profissional'}
                    </span>
                    <Icon name="search" className="w-4 h-4 text-text-secondary" />
                </button>
            ) : (
                // Modo edição: campo de busca
                <div className="relative">
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        onKeyDown={handleKeyDown}
                        placeholder="Digite para buscar..."
                        className="w-full rounded-lg border border-accent-primary bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all"
                        autoComplete="off"
                    />
                    {isLoading && (
                        <div className="absolute right-3 top-1/2 -translate-y-1/2">
                            <Icon name="Loader2" className="w-4 h-4 animate-spin text-text-secondary" />
                        </div>
                    )}

                    {/* Dropdown de sugestões */}
                    {searchTerm.trim().length >= 2 && (
                        <div className="absolute z-50 mt-1 w-full rounded-lg border border-border-secondary bg-bg-secondary shadow-lg max-h-60 overflow-y-auto">
                            {suggestions.length === 0 && !isLoading && (
                                <div className="px-3 py-2 text-sm text-text-secondary text-center">
                                    Nenhuma profissional encontrada
                                </div>
                            )}
                            {suggestions.map((prof, index) => (
                                <button
                                    key={prof.id}
                                    type="button"
                                    onClick={() => handleSelect(prof)}
                                    className={`w-full px-3 py-2 text-left text-sm transition-colors truncate ${index === selectedIndex
                                        ? 'bg-accent-primary/10 text-text-primary'
                                        : 'text-text-primary hover:bg-bg-tertiary'
                                        }`}
                                    title={prof.nome || ''}
                                >
                                    {prof.nome}
                                </button>
                            ))}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};
