import React, { useState, useRef, useEffect } from 'react';
import { Icon } from './Icon';
import { exportToPDF, exportToExcel, ExportOptions } from '../../services/utils/export.service';

interface ExportButtonProps {
    options: ExportOptions;
    disabled?: boolean;
}

export const ExportButton: React.FC<ExportButtonProps> = ({ options, disabled }) => {
    const [isOpen, setIsOpen] = useState(false);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleExport = (format: 'pdf' | 'xls' | 'xlsx' | 'csv') => {
        if (format === 'pdf') {
            exportToPDF(options);
        } else {
            exportToExcel(options, format);
        }
        setIsOpen(false);
    };

    return (
        <div className="relative" ref={dropdownRef}>
            <button
                type="button"
                disabled={disabled || options.data.length === 0}
                onClick={() => setIsOpen(!isOpen)}
                className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white rounded-md bg-accent-primary hover:bg-accent-secondary transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
                <Icon name="Download" className="w-4 h-4" />
                <span>Exportar</span>
                <Icon name={isOpen ? 'ChevronUp' : 'ChevronDown'} className="w-4 h-4" />
            </button>

            {isOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-bg-secondary border border-border-primary rounded-md shadow-lg z-50 overflow-hidden">
                    <div className="py-1">
                        <button
                            onClick={() => handleExport('pdf')}
                            className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-tertiary transition-colors"
                        >
                            <Icon name="FileText" className="w-4 h-4 text-red-500" />
                            PDF (.pdf)
                        </button>
                        <button
                            onClick={() => handleExport('xlsx')}
                            className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-tertiary transition-colors"
                        >
                            <Icon name="FileSpreadsheet" className="w-4 h-4 text-green-600" />
                            Excel (.xlsx)
                        </button>
                        <button
                            onClick={() => handleExport('xls')}
                            className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-tertiary transition-colors"
                        >
                            <Icon name="FileSpreadsheet" className="w-4 h-4 text-green-500" />
                            Excel 97-2003 (.xls)
                        </button>
                        <button
                            onClick={() => handleExport('csv')}
                            className="flex items-center gap-2 w-full px-4 py-2 text-left text-sm text-text-primary hover:bg-bg-tertiary transition-colors"
                        >
                            <Icon name="FileJson" className="w-4 h-4 text-blue-500" />
                            CSV UTF-8 (.csv)
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
};
