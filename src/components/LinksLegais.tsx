import { LINK_POLITICA_PRIVACIDADE, LINK_TERMOS_USO } from '@/lib/linksLegais';

// Links para a Política de Privacidade e os Termos de Uso do site.
// No Electron, target="_blank" é aberto no navegador padrão (setWindowOpenHandler em electron/main.cjs).
export default function LinksLegais({ className = '' }: { className?: string }) {
  const link = 'text-blue-600 hover:underline dark:text-blue-400';
  return (
    <p className={`text-xs text-center text-gray-500 dark:text-gray-400 ${className}`}>
      <a href={LINK_POLITICA_PRIVACIDADE} target="_blank" rel="noopener noreferrer" className={link}>
        Política de Privacidade
      </a>
      <span aria-hidden="true"> · </span>
      <a href={LINK_TERMOS_USO} target="_blank" rel="noopener noreferrer" className={link}>
        Termos de Uso
      </a>
    </p>
  );
}
