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
    const [isFullList, setIsFullList] = useState(false);
    const wrapperRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const debounceTimer = useRef<NodeJS.Timeout | null>(null);

    // Fecha dropdown ao clicar fora
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
                setIsOpen(false);
                setSearchTerm('');
                setIsFullList(false);
                setSelectedIndex(-1);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    // Busca com debounce ou lista completa
    useEffect(() => {
        if (debounceTimer.current) {
            clearTimeout(debounceTimer.current);
        }

        if (isFullList) {
            loadFullList();
            return;
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
                    20
                );
                setSuggestions(results);
            } catch (error) {
                console.error('Erro ao buscar profissionais:', error);
                setSuggestions([]);
            } finally {
                setIsLoading(false);
            }
        }, 300);

        return () => {
            if (debounceTimer.current) {
                clearTimeout(debounceTimer.current);
            }
        };
    }, [searchTerm, unitId, isFullList]);

    const loadFullList = async () => {
        setIsLoading(true);
        try {
            // Busca simplificada para carregar todos os ativos da unidade
            const results = await searchProfissionaisByName(
                unitId,
                '', // Vazio para pegar todas as ativas (ajustado no service se necessário, mas aqui usaremos limit alto)
                appointmentData || { data: null, horario: '', periodo: null },
                100
            );
            setSuggestions(results);
        } catch (error) {
            console.error('Erro ao carregar lista completa:', error);
            setSuggestions([]);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSelect = (profissionalNome: string) => {
        onChange(profissionalNome);
        setIsOpen(false);
        setSearchTerm('');
        setIsFullList(false);
        setSelectedIndex(-1);
        if (onSelect) onSelect();
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (!isOpen) return;
        const totalItems = suggestions.length + 1; // +1 pela opção "Sem Profissional"

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => (prev < totalItems - 1 ? prev + 1 : prev));
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => (prev > 0 ? prev - 1 : -1));
                break;
            case 'Enter':
                e.preventDefault();
                if (selectedIndex === 0) {
                    handleSelect('');
                } else if (selectedIndex > 0 && selectedIndex <= suggestions.length) {
                    handleSelect(suggestions[selectedIndex - 1].nome || '');
                }
                break;
            case 'Escape':
                e.preventDefault();
                setIsOpen(false);
                setSearchTerm('');
                setIsFullList(false);
                setSelectedIndex(-1);
                break;
        }
    };

    return (
        <div ref={wrapperRef} className={`relative ${className}`}>
            {!isOpen ? (
                // Modo visualização: mostra nome atual (Largura fixa e truncamento)
                <div className="flex items-center gap-1">
                    <button
                        type="button"
                        onClick={() => {
                            if (!disabled) {
                                setIsOpen(true);
                                setIsFullList(false);
                                setTimeout(() => inputRef.current?.focus(), 0);
                            }
                        }}
                        disabled={disabled}
                        className="flex-1 min-w-0 rounded-lg border border-border-secondary bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary hover:border-accent-primary/50 focus:outline-none transition-all text-left flex items-center justify-between disabled:opacity-50 disabled:cursor-not-allowed group"
                    >
                        <span className={`truncate flex-1 ${value ? 'text-text-primary' : 'text-text-tertiary'}`}>
                            {value || 'Profissional'}
                        </span>
                        <Icon name="search" className="w-3.5 h-3.5 text-text-secondary group-hover:text-accent-primary transition-colors ml-2 flex-shrink-0" />
                    </button>
                    <button
                        type="button"
                        onClick={() => {
                            if (!disabled) {
                                setIsOpen(true);
                                setIsFullList(true);
                            }
                        }}
                        disabled={disabled}
                        className="p-2 rounded-lg border border-border-secondary bg-bg-tertiary text-text-secondary hover:text-accent-primary hover:border-accent-primary/50 transition-all disabled:opacity-50 flex-shrink-0"
                        title="Ver lista completa"
                    >
                        <Icon name="ChevronDown" className={`w-4 h-4 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
                    </button>
                </div>
            ) : (
                // Modo edição: campo de busca
                <div className="relative">
                    <div className="relative flex items-center">
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchTerm}
                            onChange={(e) => {
                                setSearchTerm(e.target.value);
                                if (isFullList) setIsFullList(false);
                            }}
                            onKeyDown={handleKeyDown}
                            placeholder={isFullList ? "Filtrando lista..." : "Digite para buscar..."}
                            className="w-full rounded-lg border border-accent-primary bg-bg-tertiary px-3 py-1.5 text-sm text-text-primary placeholder:text-text-tertiary focus:outline-none focus:ring-2 focus:ring-accent-primary/20 transition-all pr-10"
                            autoComplete="off"
                        />
                        <button
                            type="button"
                            onClick={() => {
                                setIsOpen(false);
                                setSearchTerm('');
                                setIsFullList(false);
                            }}
                            className="absolute right-2 p-1 text-text-tertiary hover:text-text-primary transition-colors"
                        >
                            <Icon name="close" className="w-4 h-4" />
                        </button>
                    </div>

                    {isLoading && (
                        <div className="absolute right-10 top-1/2 -translate-y-1/2">
                            <Icon name="Loader2" className="w-3.5 h-3.5 animate-spin text-accent-primary" />
                        </div>
                    )}

                    {/* Dropdown de sugestões */}
                    <div className="absolute z-50 mt-1 w-full rounded-lg border border-border-secondary bg-bg-secondary shadow-xl max-h-64 overflow-y-auto animate-in fade-in slide-in-from-top-1 duration-200">
                        {/* Opção: Sem Profissional */}
                        <button
                            type="button"
                            onClick={() => handleSelect('')}
                            onMouseEnter={() => setSelectedIndex(0)}
                            className={`w-full px-3 py-2 text-left text-sm transition-colors border-b border-border-secondary/50 flex items-center gap-2 ${selectedIndex === 0 ? 'bg-accent-primary/10 text-accent-primary font-medium' : 'text-text-tertiary italic hover:bg-bg-tertiary'}`}
                        >
                            <Icon name="UserX" className="w-4 h-4" />
                            Sem Profissional
                        </button>

                        {/* Lista de Sugestões */}
                        {suggestions.length === 0 && searchTerm.trim().length >= 2 && !isLoading ? (
                            <div className="px-3 py-4 text-sm text-text-secondary text-center">
                                Nenhuma profissional encontrada
                            </div>
                        ) : (
                            suggestions.map((prof, index) => {
                                const realIndex = index + 1;
                                return (
                                    <button
                                        key={prof.id}
                                        type="button"
                                        onClick={() => handleSelect(prof.nome || '')}
                                        onMouseEnter={() => setSelectedIndex(realIndex)}
                                        className={`w-full px-3 py-2 text-left text-sm transition-colors truncate flex items-center justify-between ${realIndex === selectedIndex
                                            ? 'bg-accent-primary/10 text-text-primary'
                                            : 'text-text-primary hover:bg-bg-tertiary border-b border-border-secondary/20'
                                            }`}
                                        title={prof.nome || ''}
                                    >
                                        <span className="truncate">{prof.nome}</span>
                                        {value === prof.nome && (
                                            <Icon name="Check" className="w-3.5 h-3.5 text-accent-primary flex-shrink-0" />
                                        )}
                                    </button>
                                );
                            })
                        )}

                        {isFullList && suggestions.length === 0 && isLoading && (
                            <div className="px-3 py-8 text-sm text-text-tertiary text-center">
                                Carregando lista completa...
                            </div>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
};
