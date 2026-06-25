'use client';

import React from 'react';
import { useApp } from '@/context/AppContext';
import Header from './Header';
import Sidebar from './Sidebar';
import ToastContainer from './ToastContainer';
import styles from './AWSLayout.module.css';

export default function AWSLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useApp();

  if (loading) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.spinner}></div>
        <div className={styles.loadingText}>Initializing AWS Console Session...</div>
      </div>
    );
  }

  // If user is not logged in, we render children directly (which is the login page)
  if (!user) {
    return (
      <>
        <ToastContainer />
        {children}
      </>
    );
  }

  return (
    <div className={styles.layout}>
      <Header />
      <div className={styles.body}>
        <Sidebar />
        <main className={styles.content}>
          <div className={styles.innerContent}>
            {children}
          </div>
        </main>
      </div>
      <ToastContainer />
    </div>
  );
}
