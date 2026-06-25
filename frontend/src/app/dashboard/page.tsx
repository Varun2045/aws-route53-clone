'use client';

import React from 'react';
import Link from 'next/link';

export default function DashboardPage() {
  return (
    <div style={{ padding: '8px 0' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--aws-text)', marginBottom: '16px' }}>Dashboard</h1>
      <div style={{
        backgroundColor: 'var(--aws-panel-bg)',
        border: '1px solid var(--aws-border)',
        borderRadius: '4px',
        padding: '40px 24px',
        textAlign: 'center',
        boxShadow: 'var(--aws-shadow)'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--aws-text)', marginBottom: '12px' }}>Dashboard Service Console</h2>
        <p style={{ color: 'var(--aws-text-secondary)', fontSize: '13.5px', maxWidth: '500px', margin: '0 auto 24px auto', lineHeight: 1.5 }}>
          The Route 53 Dashboard provides a centralized overview of your DNS traffic statistics, query health, domain registration statuses, and active health check alarms. This panel is simulated.
        </p>
        <Link href="/hosted-zones" className="aws-btn aws-btn-primary">
          Manage Hosted Zones
        </Link>
      </div>
    </div>
  );
}
