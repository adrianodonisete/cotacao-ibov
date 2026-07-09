import Link from 'next/link';
import { SpikeMark } from './SpikeMark';

type Col = { title: string; links: { label: string; href: string }[] };

const COLUMNS: Col[] = [
  {
    title: 'Produto',
    links: [
      { label: 'Cotação', href: '/' },
      { label: 'Cadastrar Ativos', href: '/cadastro-ativos' },
      { label: 'Cadastrar Aportes', href: '/cadastro-aportes' },
      { label: 'Cache Conteúdo', href: '/cache' },
    ],
  },
  {
    title: 'Listagens',
    links: [
      { label: 'Listar Ativos', href: '/listagem-ativos' },
      { label: 'Listar Aportes', href: '/listagem-aportes' },
      { label: 'Totais por Ações', href: '/total-assets/acao' },
      { label: 'Totais por FIIs', href: '/total-assets/fii' },
    ],
  },
  {
    title: 'Fontes',
    links: [
      { label: 'Brapi (BR)', href: 'https://brapi.dev', },
      { label: 'Twelve Data (US)', href: 'https://twelvedata.com' },
      { label: 'Radar Opções (TD)', href: 'https://radaropcoes.com' },
      { label: 'Banco Central (índices)', href: 'https://www.bcb.gov.br' },
    ],
  },
  {
    title: 'Stack',
    links: [
      { label: 'Next.js 16', href: 'https://nextjs.org' },
      { label: 'React 19', href: 'https://react.dev' },
      { label: 'Tailwind 4', href: 'https://tailwindcss.com' },
      { label: 'Supabase', href: 'https://supabase.com' },
    ],
  },
];

export function Footer() {
  return (
    <footer className="bg-surface-dark text-on-dark-soft mt-16">
      <div className="max-w-6xl mx-auto px-6 py-16">
        <div className="flex items-center gap-2 text-on-dark mb-10">
          <SpikeMark size={18} />
          <span className="font-display text-title-md">Cotação IBOV</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8 mb-12">
          {COLUMNS.map(col => (
            <div key={col.title}>
              <h3 className="font-sans text-caption-uppercase uppercase text-on-dark-soft/70 mb-4">{col.title}</h3>
              <ul className="space-y-2.5">
                {col.links.map(link => {
                  const isExternal = link.href.startsWith('http');
                  if (isExternal) {
                    return (
                      <li key={link.label}>
                        <a href={link.href} target="_blank" rel="noreferrer" className="font-sans text-body-sm text-on-dark-soft hover:text-on-dark transition-colors">
                          {link.label}
                        </a>
                      </li>
                    );
                  }
                  return (
                    <li key={link.label}>
                      <Link href={link.href} className="font-sans text-body-sm text-on-dark-soft hover:text-on-dark transition-colors">
                        {link.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>
        <div className="pt-8 border-t border-surface-dark-elev flex flex-col md:flex-row md:items-center md:justify-between gap-3 text-caption">
          <p>© {new Date().getFullYear()} Cotação IBOV — projeto pessoal.</p>
          <p>Dados de cotação: Brapi, Twelve Data, Radar Opções, BCB. Não é recomendação de investimento.</p>
        </div>
      </div>
    </footer>
  );
}
