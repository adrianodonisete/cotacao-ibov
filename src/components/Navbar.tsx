'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const links = [
	{ href: '/', label: 'Cotação IBOV' },
	{ href: '/cadastro-ativos', label: 'Cadastro de Ativos' },
	{ href: '/listagem-ativos', label: 'Listagem de Ativos' },
	{ href: '/cadastro-aportes', label: 'Cadastro Aportes' },
	{ href: '/listagem-aportes', label: 'Listagem de Aportes' },
	{ href: '/cache', label: 'Cache Conteúdo' },
];

export default function Navbar() {
	const pathname = usePathname();

	return (
		<nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
			<div className="max-w-5xl mx-auto px-4">
				<div className="flex items-center gap-1 h-14 overflow-x-auto">
					{links.map(link => (
						<Link
							key={link.href}
							href={link.href}
							className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
								pathname === link.href
									? 'bg-emerald-500/20 text-emerald-400'
									: 'text-gray-400 hover:text-white hover:bg-gray-800'
							}`}>
							{link.label}
						</Link>
					))}
				</div>
			</div>
		</nav>
	);
}
