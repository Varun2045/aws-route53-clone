'use client';

import React, { useState, useEffect } from 'react';
import { useApp } from '@/context/AppContext';
import { useRouter } from 'next/navigation';
import styles from './page.module.css';

export default function LoginPage() {
  const { user, login, loading } = useApp();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('admin');
  const [submitting, setSubmitting] = useState(false);
  const router = useRouter();

  // Redirect if already logged in
  useEffect(() => {
    if (!loading && user) {
      router.push('/hosted-zones');
    }
  }, [user, loading]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password) return;
    
    setSubmitting(true);
    const success = await login(username, password);
    setSubmitting(false);

    if (success) {
      router.push('/hosted-zones');
    }
  };

  if (loading || user) {
    return (
      <div className={styles.loadingScreen}>
        <div className={styles.spinner}></div>
      </div>
    );
  }

  return (
    <div className={styles.loginContainer}>
      <div className={styles.card}>
        <div className={styles.logoWrapper}>
          <span className={styles.awsLogo}>aws</span>
        </div>
        
        <h1 className={styles.title}>Sign in</h1>
        
        <form onSubmit={handleSubmit} className={styles.form}>
          <div className={styles.fieldGroup}>
            <label className={styles.label}>AWS Account ID (Simulated)</label>
            <input 
              type="text" 
              value="1234-5678-9012" 
              disabled 
              className={styles.inputDisabled}
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Username</label>
            <input 
              type="text" 
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              className="aws-input"
              placeholder="e.g. admin"
              autoFocus
            />
          </div>

          <div className={styles.fieldGroup}>
            <label className={styles.label}>Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              className="aws-input"
              placeholder="e.g. admin"
            />
          </div>

          <button 
            type="submit" 
            disabled={submitting} 
            className="aws-btn aws-btn-primary w-full m-b-2"
          >
            {submitting ? 'Authenticating...' : 'Sign in'}
          </button>
        </form>

        <div className={styles.infoBox}>
          <p><strong>Demo Access Credentials:</strong></p>
          <p>Username: <code>admin</code></p>
          <p>Password: <code>admin</code></p>
        </div>

        <div className={styles.footer}>
          <a href="#" className={styles.footerLink}>Forgot password?</a>
          <span className={styles.footerDivider}>•</span>
          <a href="#" className={styles.footerLink}>Create a new AWS account</a>
        </div>
      </div>
    </div>
  );
}
