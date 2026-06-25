'use client';

import React from 'react';
import Link from 'next/link';

export default function HealthChecksPage() {
  return (
    <div style={{ padding: '8px 0' }}>
      <h1 style={{ fontSize: '22px', fontWeight: 600, color: 'var(--aws-text)', marginBottom: '16px' }}>Health checks</h1>
      <div style={{
        backgroundColor: 'var(--aws-panel-bg)',
        border: '1px solid var(--aws-border)',
        borderRadius: '4px',
        padding: '40px 24px',
        textAlign: 'center',
        boxShadow: 'var(--aws-shadow)'
      }}>
        <h2 style={{ fontSize: '18px', fontWeight: 600, color: 'var(--aws-text)', marginBottom: '12px' }}>Resource Health Monitoring</h2>
        <p style={{ color: 'var(--aws-text-secondary)', fontSize: '13.5px', maxWidth: '500px', margin: '0 auto 24px auto', lineHeight: 1.5 }}>
          Route 53 health checks monitor the health and performance of your web servers, endpoints, and other resources. You can configure DNS records to fail over to healthy resources. This feature is simulated.
        </p>
        <Link href="/hosted-zones" className="aws-btn aws-btn-primary">
          Manage Hosted Zones
        </Link>
      </div>
    </div>
  );
}
