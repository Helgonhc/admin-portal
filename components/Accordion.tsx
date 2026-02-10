'use client';

import { useState, ReactNode } from 'react';
import { ChevronRight } from 'lucide-react';

interface AccordionProps {
    title: string;
    subtitle?: string;
    icon?: ReactNode;
    children: ReactNode;
    defaultOpen?: boolean;
    badge?: string | number;
    badgeColor?: string;
}

export function Accordion({
    title,
    subtitle,
    icon,
    children,
    defaultOpen = false,
    badge,
    badgeColor = 'bg-indigo-50 text-indigo-600'
}: AccordionProps) {
    const [isOpen, setIsOpen] = useState(defaultOpen);

    return (
        <div className="w-full">
            <div
                className="flex items-center justify-between py-4 px-2 cursor-pointer group/accordion hover:opacity-80 transition-all select-none"
                onClick={() => setIsOpen(!isOpen)}
            >
                <div className="flex items-center gap-4">
                    {icon && (
                        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-md bg-white dark:bg-slate-800 transition-transform duration-500 ${isOpen ? 'rotate-12' : ''}`}>
                            {icon}
                        </div>
                    )}
                    <div>
                        <h3 className="text-lg font-black text-slate-900 dark:text-white uppercase tracking-tight flex items-center gap-3">
                            {title}
                            {badge !== undefined && (
                                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-black ${badgeColor}`}>
                                    {badge}
                                    {typeof badge === 'number' ? (badge === 1 ? ' ITEM' : ' ITENS') : ''}
                                </span>
                            )}
                            <ChevronRight size={18} className={`text-slate-300 transition-transform duration-300 ${isOpen ? 'rotate-90' : ''}`} />
                        </h3>
                        {subtitle && (
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em]">{subtitle}</p>
                        )}
                    </div>
                </div>
            </div>

            <div className={`overflow-hidden transition-all duration-500 ease-in-out ${isOpen ? 'max-h-[5000px] opacity-100 mb-8' : 'max-h-0 opacity-0 mb-0'}`}>
                {children}
            </div>
        </div>
    );
}
