import { createContext, useContext, useEffect, useState, ReactNode } from 'react';

type Theme = 'light' | 'dark';
export type ThemeStyle = 'enterprise' | 'nebula';

interface ThemeContextType {
  theme: Theme;
  themeStyle: ThemeStyle;
  toggleTheme: () => void;
  setTheme: (theme: Theme) => void;
  setThemeStyle: (style: ThemeStyle) => void;
  toggleThemeStyle: () => void;
}

const THEME_STORAGE_KEY = 'syncfolk-theme';
const STYLE_STORAGE_KEY = 'effectime-theme-style';

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const isTheme = (value: string | null): value is Theme => value === 'light' || value === 'dark';
const isThemeStyle = (value: string | null): value is ThemeStyle => value === 'enterprise' || value === 'nebula';

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setTheme] = useState<Theme>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (isTheme(stored)) return stored;
      return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    return 'light';
  });

  const [themeStyle, setThemeStyle] = useState<ThemeStyle>(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem(STYLE_STORAGE_KEY);
      if (isThemeStyle(stored)) return stored;
    }
    return 'enterprise';
  });

  useEffect(() => {
    const root = document.documentElement;

    root.classList.toggle('dark', theme === 'dark' || themeStyle === 'nebula');
    root.classList.toggle('theme-enterprise', themeStyle === 'enterprise');
    root.classList.toggle('theme-nebula', themeStyle === 'nebula');
    root.dataset.themeStyle = themeStyle;

    localStorage.setItem(THEME_STORAGE_KEY, theme);
    localStorage.setItem(STYLE_STORAGE_KEY, themeStyle);
  }, [theme, themeStyle]);

  const toggleTheme = () => setTheme(prev => prev === 'dark' ? 'light' : 'dark');
  const toggleThemeStyle = () => setThemeStyle(prev => prev === 'nebula' ? 'enterprise' : 'nebula');

  return (
    <ThemeContext.Provider value={{ theme, themeStyle, toggleTheme, setTheme, setThemeStyle, toggleThemeStyle }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (!context) throw new Error('useTheme must be used within ThemeProvider');
  return context;
}
