'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import styles from './Sidebar.module.css';

interface NavItem {
  name: string;
  href: string;
  isMocked?: boolean;
}

export default function Sidebar() {
  const pathname = usePathname();

  const navItems: NavItem[] = [
    { name: 'Dashboard', href: '/dashboard', isMocked: true },
    { name: 'Hosted zones', href: '/hosted-zones' },
    { name: 'Traffic policies', href: '/traffic-policies', isMocked: true },
    { name: 'Health checks', href: '/health-checks', isMocked: true },
    { name: 'Resolver', href: '/resolver', isMocked: true },
    { name: 'Profiles', href: '/profiles', isMocked: true },
  ];

  return (
    <aside className={styles.sidebar}>
      <div className={styles.title}>Route 53</div>
      <nav className={styles.nav}>
        {navItems.map((item) => {
          const isActive = pathname.startsWith(item.href);
          return (
            <Link 
              key={item.name} 
              href={item.href} 
              className={`${styles.navLink} ${isActive ? styles.active : ''}`}
            >
              <span className={styles.linkText}>
                {item.name}
              </span>
              {item.isMocked && (
                <span className={styles.mockedBadge}>mock</span>
              )}
            </Link>
          );
        })}
      </nav>
    </aside>
  );
}
