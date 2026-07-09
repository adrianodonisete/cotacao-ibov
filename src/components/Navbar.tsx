'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';
import { Button } from './ui/Button';
import { SpikeMark } from './ui/SpikeMark';

type NavItem = {
  label: string;
  href?: string;
  children?: { href: string; label: string }[];
};

const navItems: NavItem[] = [
  { label: 'Cotação IBOV', href: '/' },
  {
    label: 'Cadastro',
    children: [
      { href: '/cadastro-ativos', label: 'Cadastrar Ativos' },
      { href: '/cadastro-aportes', label: 'Cadastrar Aportes' },
    ],
  },
  {
    label: 'Listar',
    children: [
      { href: '/listagem-ativos', label: 'Listar Ativos' },
      { href: '/listagem-aportes', label: 'Listar Aportes' },
    ],
  },
  {
    label: 'Totais por Categoria',
    children: [
      { href: '/total-assets/acao', label: 'Totais por Ações' },
      { href: '/total-assets/fii', label: 'Totais por FIIs' },
    ],
  },
  { label: 'Cache Conteúdo', href: '/cache' },
];

export default function Navbar() {
  const pathname = usePathname();
  const [openLabel, setOpenLabel] = useState<string | null>(null);

  return (
    <nav className="bg-canvas border-b border-hairline sticky top-0 z-50">
      <div className="max-w-6xl mx-auto px-6">
        <div className="flex items-center gap-1 h-16">
          <Link href="/" className="flex items-center gap-2 mr-4 text-ink hover:text-body-strong transition-colors">
            <SpikeMark size={18} className="text-ink" />
            <span className="font-display text-title-md tracking-tight">
              Cotação <span className="text-primary">IBOV</span>
            </span>
          </Link>

          {navItems.slice(1).map(item => {
            const isParentActive = item.children?.some(c => pathname === c.href) ?? false;
            const isDirectActive = !item.children && pathname === item.href;
            const isActive = isDirectActive || isParentActive;

            if (!item.children) {
              return (
                <Link
                  key={item.href}
                  href={item.href!}
                  className={`whitespace-nowrap px-3.5 py-2 rounded-md font-sans text-body-sm font-medium transition-colors ${
                    isActive
                      ? 'bg-surface-card text-ink'
                      : 'text-body hover:text-ink hover:bg-surface-soft'
                  }`}
                >
                  {item.label}
                </Link>
              );
            }

            return (
              <div
                key={item.label}
                className="relative before:absolute before:top-full before:left-0 before:right-0 before:h-1 before:content-['']"
                onMouseEnter={() => setOpenLabel(item.label)}
                onMouseLeave={() => setOpenLabel(null)}
              >
                <button
                  className={`whitespace-nowrap px-3.5 py-2 rounded-md font-sans text-body-sm font-medium transition-colors flex items-center gap-1 ${
                    isActive
                      ? 'bg-surface-card text-ink'
                      : 'text-body hover:text-ink hover:bg-surface-soft'
                  }`}
                >
                  {item.label}
                  <span className="text-[10px] leading-none">▾</span>
                </button>
                {openLabel === item.label && (
                  <div className="absolute top-full left-0 mt-1 bg-canvas border border-hairline rounded-md shadow-md min-w-[200px] py-1 z-50">
                    {item.children.map(child => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={`block px-4 py-2 font-sans text-body-sm rounded-sm transition-colors ${
                          pathname === child.href
                            ? 'text-primary bg-surface-soft'
                            : 'text-body hover:text-ink hover:bg-surface-soft'
                        }`}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            );
          })}

          <div className="ml-auto">
            <Link href="/">
              <Button variant="primary" size="sm">
                Nova Cotação
              </Button>
            </Link>
          </div>
        </div>
      </div>
    </nav>
  );
}
