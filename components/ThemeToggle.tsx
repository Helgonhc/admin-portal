'use client';

import { useState, useEffect } from 'react';
import { Sun, Moon } from 'lucide-react';

export function ThemeToggle() {
    const [dark, setDark] = useState(false);

    useEffect(() => {
        // Verificar se o modo dark já está salvo ou se o sistema prefere
        const isDark = localStorage.getItem('theme') === 'dark' ||
            (!localStorage.getItem('theme') && window.matchMedia('(prefers-color-scheme: dark)').matches);

        setDark(isDark);
        if (isDark) {
            document.documentElement.classList.add('dark');
        }
    }, []);

    const toggleTheme = () => {
        if (dark) {
            document.documentElement.classList.remove('dark');
            localStorage.setItem('theme', 'light');
            setDark(false);
        } else {
            document.documentElement.classList.add('dark');
            localStorage.setItem('theme', 'dark');
            setDark(true);
        }
    };

    return (
        <button
            onClick={toggleTheme}
            className="p-2 rounded-lg bg-gray-100 dark:bg-gray-800 text-gray-500 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700 transition-colors"
            title={dark ? 'Mudar para modo claro' : 'Mudar para modo escuro'}
        >
            {dark ? <Sun size={20} /> : <Moon size={20} />}
        </button>
    );
}
