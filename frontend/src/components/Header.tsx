'use client';

import React, { useRef, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import styles from './Header.module.css';

export default function Header() {
  const { user, theme, toggleTheme, logout } = useApp();
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Focus search input when "/" key is pressed
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === '/' && document.activeElement !== searchInputRef.current) {
        // Prevent default browser behavior of searching/typing "/"
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!user) return null;

  return (
    <header className={styles.header}>
      {/* Left side: Logo & Service Name */}
      <div className={styles.left}>
        <div className={styles.logoContainer}>
          <span className={styles.awsLogo}>aws</span>
          <span className={styles.serviceDivider}>|</span>
          <span className={styles.serviceName}>Route 53</span>
        </div>
      </div>

      {/* Middle: Mock Console Search */}
      <div className={styles.middle}>
        <div className={styles.searchWrapper}>
          <svg className={styles.searchIcon} viewBox="0 0 24 24" width="16" height="16">
            <path fill="currentColor" d="M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z"/>
          </svg>
          <input
            ref={searchInputRef}
            type="text"
            placeholder='Search services, features, and docs (Press "/" to focus)'
            className={styles.searchInput}
          />
        </div>
      </div>

      {/* Right side: Preferences, Theme, Region, and Account Profile */}
      <div className={styles.right}>
        {/* Theme Toggle Button */}
        <button 
          onClick={toggleTheme} 
          className={styles.themeBtn}
          title={`Switch to ${theme === 'light' ? 'Dark' : 'Light'} Mode`}
        >
          {theme === 'light' ? (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12 3a9 9 0 1 0 9 9c0-.46-.04-.92-.1-1.36a5.389 5.389 0 0 1-4.4 2.26 5.403 5.403 0 0 1-3.14-9.8c-.44-.06-.9-.1-1.36-.1z"/>
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
              <path d="M12 7a5 5 0 1 1 0 10 5 5 0 0 1 0-10zm0 2a3 3 0 1 0 0 6 3 3 0 0 0 0-6zm0-7a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0V3a1 1 0 0 1 1-1zm0 16a1 1 0 0 1 1 1v2a1 1 0 1 1-2 0v-2a1 1 0 0 1 1-1zM5.636 5.636a1 1 0 0 1 1.414 0l1.414 1.414a1 1 0 1 1-1.414 1.414L5.636 7.05a1 1 0 0 1 0-1.414zm11.314 11.314a1 1 0 0 1 1.414 0l1.414 1.414a1 1 0 1 1-1.414 1.414l-1.414-1.414a1 1 0 0 1 0-1.414zM2 12a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2H3a1 1 0 0 1-1-1zm16 0a1 1 0 0 1 1-1h2a1 1 0 1 1 0 2h-2a1 1 0 0 1-1-1zM6.343 17.657a1 1 0 0 1 0 1.414l-1.414 1.414a1 1 0 1 1-1.414-1.414l1.414-1.414a1 1 0 0 1 1.414 0zm11.314-11.314a1 1 0 0 1 0 1.414l-1.414 1.414a1 1 0 1 1-1.414-1.414l1.414-1.414a1 1 0 0 1 1.414 0z"/>
            </svg>
          )}
        </button>

        {/* Region Selector Indicator (Route53 is Global in AWS) */}
        <div className={styles.regionBadge} title="DNS Services are Global">
          <span className={styles.regionDot}></span>
          Global
        </div>

        {/* User Account Dropdown */}
        <div className={styles.accountMenu}>
          <div className={styles.accountTrigger}>
            <span className={styles.accountUser}>{user.username}</span>
            <span className={styles.accountNumber}>@ {user.aws_account_id}</span>
            <svg className={styles.caretIcon} viewBox="0 0 24 24" width="14" height="14">
              <path fill="currentColor" d="M7 10l5 5 5-5z"/>
            </svg>
          </div>
          
          {/* Dropdown content */}
          <div className={styles.dropdown}>
            <div className={styles.dropdownHeader}>
              <strong>AWS Account</strong>
              <div>Account ID: {user.aws_account_id}</div>
              <div>Role: AdministratorAccess</div>
            </div>
            <div className={styles.dropdownDivider}></div>
            <button onClick={logout} className={styles.logoutBtn}>
              Sign Out of Console
            </button>
          </div>
        </div>
      </div>
    </header>
  );
}
