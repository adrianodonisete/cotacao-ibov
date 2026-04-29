'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useState } from 'react';

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
	{ label: 'Cache Conteúdo', href: '/cache' },
];

export default function Navbar() {
	const pathname = usePathname();
	const [openLabel, setOpenLabel] = useState<string | null>(null);

	return (
		<nav className="bg-gray-900 border-b border-gray-800 sticky top-0 z-50">
			<div className="max-w-5xl mx-auto px-4">
				<div className="flex items-center gap-1 h-14">
					{navItems.map(item => {
						const isParentActive = item.children?.some(c => pathname === c.href) ?? false;
						const isDirectActive = !item.children && pathname === item.href;
						const isActive = isDirectActive || isParentActive;

						if (!item.children) {
							return (
								<Link
									key={item.href}
									href={item.href!}
									className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors ${
										isActive
											? 'bg-emerald-500/20 text-emerald-400'
											: 'text-gray-400 hover:text-white hover:bg-gray-800'
									}`}>
									{item.label}
								</Link>
							);
						}

						return (
							<div
								key={item.label}
								className="relative"
								onMouseEnter={() => setOpenLabel(item.label)}
								onMouseLeave={() => setOpenLabel(null)}>
								<button
									className={`whitespace-nowrap px-4 py-2 rounded-lg text-sm font-medium transition-colors flex items-center gap-1 ${
										isActive
											? 'bg-emerald-500/20 text-emerald-400'
											: 'text-gray-400 hover:text-white hover:bg-gray-800'
									}`}>
									{item.label}
									<span className="text-xs leading-none">▾</span>
								</button>
								{openLabel === item.label && (
									<div className="absolute top-full left-0 bg-gray-900 border border-gray-800 rounded-lg shadow-lg min-w-[180px] z-50 py-1 pt-2">
										{item.children.map(child => (
											<Link
												key={child.href}
												href={child.href}
												className={`block px-4 py-2 text-sm rounded transition-colors ${
													pathname === child.href
														? 'text-emerald-400'
														: 'text-gray-400 hover:text-white hover:bg-gray-800'
												}`}>
												{child.label}
											</Link>
										))}
									</div>
								)}
							</div>
						);
					})}
				</div>
			</div>
		</nav>
	);
}
