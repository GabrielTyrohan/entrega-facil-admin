// ============================================
// ARQUIVO: src/components/layout/CommandPalette.tsx
// Busca Ctrl+K: acha telas e ações rápidas que o usuário tem permissão para abrir.
// ============================================

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { Command } from 'cmdk';
import { CornerDownLeft, Moon, Search, Sun } from 'lucide-react';
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { useTheme } from '@/contexts/ThemeContext';
import { ACOES_RAPIDAS, MENU_ITEMS, PATH_TO_SECTION, useVisibleMenu } from './menu';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Contadores do menu (ex.: pedidos pendentes) para mostrar ao lado da tela. */
  badges?: Record<string, number>;
}

const grupoCls =
  '[&_[cmdk-group-heading]]:px-2.5 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2.5 [&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-semibold [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-[0.06em] [&_[cmdk-group-heading]]:text-gray-400';

const itemCls =
  'flex h-9 cursor-pointer select-none items-center gap-2.5 rounded-md px-2.5 text-[13.5px] text-gray-700 outline-none data-[selected=true]:bg-blue-50 data-[selected=true]:text-blue-700 dark:text-gray-200 dark:data-[selected=true]:bg-blue-500/15 dark:data-[selected=true]:text-blue-300';

export default function CommandPalette({ open, onOpenChange, badges }: Props) {
  const navigate = useNavigate();
  const { permissions, isAdmin, userType } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const telas = useVisibleMenu(userType, permissions, isAdmin, MENU_ITEMS);

  const acoes = useMemo(() => {
    const liberadas = new Set(telas.filter((t) => !t.disabled).map((t) => t.path));
    return ACOES_RAPIDAS.filter((a) => liberadas.has(a.base));
  }, [telas]);

  const ir = (path: string) => {
    onOpenChange(false);
    navigate(path);
  };

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-[80] bg-gray-950/40 backdrop-blur-[1px] data-[state=open]:animate-in data-[state=open]:fade-in-0" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className="fixed left-1/2 top-[14vh] z-[81] w-[calc(100%-2rem)] max-w-[560px] -translate-x-1/2 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-2xl data-[state=open]:animate-in data-[state=open]:fade-in-0 data-[state=open]:zoom-in-95 dark:border-gray-700 dark:bg-gray-800"
        >
          <DialogPrimitive.Title className="sr-only">Buscar telas e ações</DialogPrimitive.Title>
          <Command label="Buscar telas e ações" loop>
            <div className="flex h-12 items-center gap-2.5 border-b border-gray-200 px-4 dark:border-gray-700">
              <Search className="h-4 w-4 shrink-0 text-gray-400" />
              <Command.Input
                autoFocus
                placeholder="Buscar telas ou ações… (ex.: compra, devedores, NF-e)"
                className="h-full flex-1 bg-transparent text-[14.5px] text-gray-900 outline-none placeholder:text-gray-400 dark:text-white"
              />
              <kbd className="rounded border border-gray-200 px-1.5 font-mono text-[10.5px] text-gray-400 dark:border-gray-600">Esc</kbd>
            </div>

            <Command.List className="max-h-[min(360px,60vh)] overflow-y-auto p-1.5">
              <Command.Empty className="py-8 text-center text-sm text-gray-500">Nada encontrado. Tente outra palavra.</Command.Empty>

              {acoes.length > 0 && (
                <Command.Group heading="Ações" className={grupoCls}>
                  {acoes.map((a) => {
                    const Icon = a.icon;
                    return (
                      <Command.Item key={a.path} value={`${a.label} ${a.palavras ?? ''}`} onSelect={() => ir(a.path)} className={itemCls}>
                        <Icon className="h-4 w-4 shrink-0 opacity-70" />
                        <span className="flex-1 truncate">{a.label}</span>
                        {!!badges?.[a.base] && (
                          <span className="rounded-full bg-blue-600 px-1.5 font-mono text-[11px] font-semibold text-white">{badges[a.base]}</span>
                        )}
                      </Command.Item>
                    );
                  })}
                </Command.Group>
              )}

              <Command.Group heading="Telas" className={grupoCls}>
                {telas.map((t) => {
                  const Icon = t.icon;
                  return (
                    <Command.Item
                      key={t.path}
                      value={`${t.label} ${PATH_TO_SECTION[t.path] ?? ''}`}
                      disabled={t.disabled}
                      onSelect={() => ir(t.path)}
                      className={`${itemCls} data-[disabled=true]:cursor-not-allowed data-[disabled=true]:opacity-50`}
                    >
                      <Icon className="h-4 w-4 shrink-0 opacity-70" />
                      <span className="flex-1 truncate">{t.label}</span>
                      <span className="text-xs text-gray-400">{PATH_TO_SECTION[t.path]}</span>
                    </Command.Item>
                  );
                })}
              </Command.Group>

              <Command.Group heading="Aparência" className={grupoCls}>
                <Command.Item
                  value="tema escuro claro aparência"
                  onSelect={() => {
                    toggleTheme();
                    onOpenChange(false);
                  }}
                  className={itemCls}
                >
                  {theme === 'light' ? <Moon className="h-4 w-4 opacity-70" /> : <Sun className="h-4 w-4 opacity-70" />}
                  <span>{theme === 'light' ? 'Usar tema escuro' : 'Usar tema claro'}</span>
                </Command.Item>
              </Command.Group>
            </Command.List>

            <div className="flex items-center gap-4 border-t border-gray-200 px-4 py-2 text-[11.5px] text-gray-400 dark:border-gray-700">
              <span>↑ ↓ navegar</span>
              <span className="inline-flex items-center gap-1">
                <CornerDownLeft className="h-3 w-3" /> abrir
              </span>
              <span>Esc fechar</span>
            </div>
          </Command>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}
