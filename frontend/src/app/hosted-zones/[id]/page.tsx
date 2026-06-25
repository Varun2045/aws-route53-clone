'use client';

import React, { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { useApp } from '@/context/AppContext';
import styles from './page.module.css';

interface DNSRecord {
  id: string;
  hosted_zone_id: string;
  name: string;
  type: string;
  routing_policy: string;
  ttl: number;
  value: string;
  weight: number | null;
  set_id: string | null;
  alias: boolean;
  alias_target: string | null;
  health_check_id: string | null;
  created_at: string;
}

interface HostedZoneDetail {
  id: string;
  name: string;
  description: string | null;
  type: string;
  vpc_id: string | null;
  vpc_region: string | null;
  record_count: number;
  created_at: string;
  records: DNSRecord[];
}

export default function HostedZoneDetailPage() {
  const params = useParams();
  const router = useRouter();
  const zoneId = params.id as string;
  const { fetchApi, addToast, user } = useApp();

  // Detail State
  const [zone, setZone] = useState<HostedZoneDetail | null>(null);
  const [records, setRecords] = useState<DNSRecord[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search / Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState('');
  
  // Multi-select for deletion
  const [selectedRecordIds, setSelectedRecordIds] = useState<string[]>([]);
  
  // Create / Edit Record Panel State
  const [panelOpen, setPanelOpen] = useState(false);
  const [editingRecord, setEditingRecord] = useState<DNSRecord | null>(null);
  const [recSubdomain, setRecSubdomain] = useState('');
  const [recType, setRecType] = useState('A');
  const [recAlias, setRecAlias] = useState(false);
  const [recAliasTarget, setRecAliasTarget] = useState('');
  const [recTtl, setRecTtl] = useState(300);
  const [recValue, setRecValue] = useState('');
  const [recRouting, setRecRouting] = useState('Simple');
  const [recWeight, setRecWeight] = useState<number>(100);
  const [recSetId, setRecSetId] = useState('');
  const [savingRecord, setSavingRecord] = useState(false);

  // Import Modal State
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importing, setImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Keyboard shortcut Esc to close panel/modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (panelOpen) setPanelOpen(false);
        if (importModalOpen) setImportModalOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [panelOpen, importModalOpen]);

  // Fetch Zone and Records
  const fetchZoneDetails = async () => {
    if (!user) return;
    setLoading(true);
    try {
      // 1. Fetch zone basic info
      const zoneRes = await fetchApi(`/api/hosted-zones/${zoneId}`);
      if (zoneRes.ok) {
        const zoneData = await zoneRes.json();
        setZone(zoneData);
        
        // 2. Fetch record listing with optional filters
        let recordsUrl = `/api/hosted-zones/${zoneId}/records`;
        const queryParams = [];
        if (searchQuery.trim()) {
          queryParams.push(`query=${encodeURIComponent(searchQuery.trim())}`);
        }
        if (typeFilter) {
          queryParams.push(`type=${encodeURIComponent(typeFilter)}`);
        }
        if (queryParams.length > 0) {
          recordsUrl += `?${queryParams.join('&')}`;
        }

        const recRes = await fetchApi(recordsUrl);
        if (recRes.ok) {
          const recData = await recRes.json();
          setRecords(recData);
        }
      } else {
        addToast('Hosted Zone not found', 'error');
        router.push('/hosted-zones');
      }
    } catch (err) {
      addToast('Error loading details from API', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZoneDetails();
    setSelectedRecordIds([]);
  }, [zoneId, searchQuery, typeFilter]);

  // Handle panel close
  const closePanel = () => {
    setPanelOpen(false);
    setEditingRecord(null);
  };

  // Open Create Record panel
  const openCreatePanel = () => {
    setEditingRecord(null);
    setRecSubdomain('');
    setRecType('A');
    setRecAlias(false);
    setRecAliasTarget('');
    setRecTtl(300);
    setRecValue('');
    setRecRouting('Simple');
    setRecWeight(100);
    setRecSetId('');
    setPanelOpen(true);
  };

  // Open Edit Record panel
  const openEditPanel = (record: DNSRecord) => {
    // If Apex NS/SOA, warn user or do not allow editing ( apex NS and SOA in Route53 should be read-only/managed )
    if (zone && record.name === zone.name && (record.type === 'SOA' || record.type === 'NS')) {
      addToast('Apex NS and SOA records are managed by AWS and cannot be edited.', 'info');
      return;
    }

    setEditingRecord(record);
    
    // Extract subdomain
    let sub = '';
    if (zone && record.name.endsWith('.' + zone.name)) {
      sub = record.name.substring(0, record.name.length - zone.name.length - 1);
    } else if (zone && record.name === zone.name) {
      sub = '';
    }
    
    setRecSubdomain(sub);
    setRecType(record.type);
    setRecAlias(record.alias);
    setRecAliasTarget(record.alias_target || '');
    setRecTtl(record.ttl);
    setRecValue(record.value);
    setRecRouting(record.routing_policy);
    setRecWeight(record.weight !== null ? record.weight : 100);
    setRecSetId(record.set_id || '');
    setPanelOpen(true);
  };

  // Save Record (Create or Update)
  const handleSaveRecord = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!zone) return;

    // Validation
    const name = recSubdomain.trim() ? `${recSubdomain.trim()}.${zone.name}` : zone.name;
    const value = recAlias ? '' : recValue.trim();
    if (!recAlias && !value) {
      addToast('Record value is required', 'error');
      return;
    }
    if (recAlias && !recAliasTarget.trim()) {
      addToast('Alias target is required', 'error');
      return;
    }

    setSavingRecord(true);
    try {
      const payload = {
        name: name,
        type: recType,
        routing_policy: recRouting,
        ttl: recAlias ? 0 : Number(recTtl),
        value: value,
        weight: recRouting === 'Weighted' ? Number(recWeight) : null,
        set_id: recRouting === 'Weighted' ? recSetId.trim() || 'weighted-set' : null,
        alias: recAlias,
        alias_target: recAlias ? recAliasTarget.trim() : null,
        health_check_id: null
      };

      const url = editingRecord 
        ? `/api/hosted-zones/${zoneId}/records/${editingRecord.id}`
        : `/api/hosted-zones/${zoneId}/records`;
      
      const method = editingRecord ? 'PUT' : 'POST';

      const res = await fetchApi(url, {
        method,
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        addToast(
          editingRecord 
            ? `Successfully updated record ${name}` 
            : `Successfully created record ${name}`,
          'success'
        );
        closePanel();
        fetchZoneDetails();
      } else {
        const err = await res.json();
        addToast(err.detail || 'Failed to save DNS record', 'error');
      }
    } catch (err) {
      addToast('API Error saving DNS record', 'error');
    } finally {
      setSavingRecord(false);
    }
  };

  // Toggle selection
  const toggleSelectRecord = (id: string, record: DNSRecord) => {
    // Prevent selecting default NS/SOA records
    if (zone && record.name === zone.name && (record.type === 'NS' || record.type === 'SOA')) {
      addToast('Apex NS and SOA records cannot be deleted.', 'info');
      return;
    }

    setSelectedRecordIds((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    // Only select deletable records
    const deletableRecords = records.filter(r => 
      !(zone && r.name === zone.name && (r.type === 'NS' || r.type === 'SOA'))
    );

    if (selectedRecordIds.length === deletableRecords.length) {
      setSelectedRecordIds([]);
    } else {
      setSelectedRecordIds(deletableRecords.map((r) => r.id));
    }
  };

  // Delete records
  const handleDeleteRecords = async () => {
    if (selectedRecordIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete the ${selectedRecordIds.length} selected record(s)?`)) {
      return;
    }

    try {
      const res = await fetchApi(`/api/hosted-zones/${zoneId}/records/bulk-delete`, {
        method: 'POST',
        body: JSON.stringify(selectedRecordIds)
      });

      if (res.ok) {
        const data = await res.json();
        addToast(`Successfully deleted ${data.deleted_count} record(s).`, 'success');
        setSelectedRecordIds([]);
        fetchZoneDetails();
      } else {
        addToast('Failed to delete records', 'error');
      }
    } catch (err) {
      addToast('API Error deleting records', 'error');
    }
  };

  // Export Zone
  const handleExportZone = async (format: 'bind' | 'json') => {
    if (!zone) return;
    try {
      const res = await fetchApi(`/api/hosted-zones/${zoneId}/export?format=${format}`);
      if (res.ok) {
        if (format === 'json') {
          const data = await res.json();
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${zone.name}json`;
          a.click();
          addToast('Zone records exported successfully as JSON.', 'success');
        } else {
          const text = await res.text();
          const blob = new Blob([text], { type: 'text/plain' });
          const url = URL.createObjectURL(blob);
          const a = document.createElement('a');
          a.href = url;
          a.download = `${zone.name}zone`;
          a.click();
          addToast('Zone records exported successfully as BIND format.', 'success');
        }
      } else {
        addToast('Failed to export zone records', 'error');
      }
    } catch (err) {
      addToast('Error downloading exported records', 'error');
    }
  };

  // Import BIND file
  const handleImportBind = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!importFile) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append('file', importFile);

      const res = await fetchApi(`/api/hosted-zones/${zoneId}/import/bind`, {
        method: 'POST',
        // Note: For Fetch FormData uploads, we let the browser set the boundary headers automatically,
        // so we pass headers as empty so fetchApi doesn't force Content-Type application/json.
        headers: {}, 
        body: formData
      });

      if (res.ok) {
        const data = await res.json();
        addToast(`Successfully imported ${data.imported_count} record(s) from BIND file.`, 'success');
        setImportFile(null);
        if (fileInputRef.current) fileInputRef.current.value = '';
        setImportModalOpen(false);
        fetchZoneDetails();
      } else {
        const err = await res.json();
        addToast(err.detail || 'Failed to import BIND file', 'error');
      }
    } catch (err) {
      addToast('API Error importing BIND file', 'error');
    } finally {
      setImporting(false);
    }
  };

  // Filter deletable records list for select all matching check
  const deletableRecords = records.filter(r => 
    !(zone && r.name === zone.name && (r.type === 'NS' || r.type === 'SOA'))
  );

  return (
    <div className={styles.container}>
      {/* Detail Header breadcrumb */}
      <div className={styles.breadcrumb}>
        <Link href="/hosted-zones">Hosted zones</Link>
        <span className={styles.divider}>&gt;</span>
        <span className={styles.activePage}>{zone?.name || 'Loading...'}</span>
      </div>

      {/* Main Metadata Panel */}
      {zone && (
        <div className={styles.metadataCard}>
          <div className={styles.metadataHeader}>
            <div>
              <h1 className={styles.zoneTitle}>{zone.name}</h1>
              <span className={`aws-badge ${zone.type === 'Public' ? 'aws-badge-public' : 'aws-badge-private'}`}>
                {zone.type}
              </span>
            </div>
            
            <div className={styles.headerActions}>
              {/* Import BIND File */}
              <button 
                onClick={() => setImportModalOpen(true)}
                className="aws-btn aws-btn-secondary"
              >
                Import zone file
              </button>

              {/* Export Dropdown */}
              <div className={styles.exportMenu}>
                <button className="aws-btn aws-btn-secondary">
                  Export zone
                  <svg viewBox="0 0 24 24" width="14" height="14" style={{ marginLeft: '4px' }}>
                    <path fill="currentColor" d="M7 10l5 5 5-5z"/>
                  </svg>
                </button>
                <div className={styles.exportDropdown}>
                  <button onClick={() => handleExportZone('bind')}>Export as BIND format</button>
                  <button onClick={() => handleExportZone('json')}>Export as JSON</button>
                </div>
              </div>
            </div>
          </div>

          <div className={styles.metadataGrid}>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Hosted zone ID</span>
              <span className={styles.metaVal}><code>{zone.id}</code></span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Record count</span>
              <span className={styles.metaVal}>{zone.record_count}</span>
            </div>
            <div className={styles.metaItem}>
              <span className={styles.metaLabel}>Description</span>
              <span className={styles.metaVal}>{zone.description || '-'}</span>
            </div>
            {zone.type === 'Private' && (
              <div className={styles.metaItem}>
                <span className={styles.metaLabel}>Associated VPC</span>
                <span className={styles.metaVal}><code>{zone.vpc_id} ({zone.vpc_region})</code></span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Toolbar / Filters */}
      <div className={styles.toolbar}>
        <div className={styles.filtersGroup}>
          <input
            type="text"
            placeholder="Search records by name or value"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="aws-input"
            style={{ maxWidth: '300px' }}
          />

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="aws-select"
            style={{ maxWidth: '140px' }}
          >
            <option value="">All Types</option>
            <option value="A">A</option>
            <option value="AAAA">AAAA</option>
            <option value="CNAME">CNAME</option>
            <option value="MX">MX</option>
            <option value="TXT">TXT</option>
            <option value="NS">NS</option>
            <option value="SOA">SOA</option>
            <option value="PTR">PTR</option>
            <option value="SRV">SRV</option>
            <option value="CAA">CAA</option>
          </select>
        </div>

        <div className={styles.actionButtons}>
          <button
            onClick={handleDeleteRecords}
            disabled={selectedRecordIds.length === 0}
            className="aws-btn aws-btn-danger"
          >
            Delete record
          </button>
          <button
            onClick={openCreatePanel}
            className="aws-btn aws-btn-primary"
          >
            Create record
          </button>
        </div>
      </div>

      {/* Records Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  checked={deletableRecords.length > 0 && selectedRecordIds.length === deletableRecords.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>Record name</th>
              <th>Type</th>
              <th>Routing policy</th>
              <th>Differentiator</th>
              <th>Alias</th>
              <th>TTL (Seconds)</th>
              <th>Value/Route traffic to</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={8} className={styles.loadingCell}>
                  <div className={styles.loadingSpinner}></div>
                  <span>Loading records...</span>
                </td>
              </tr>
            ) : records.length === 0 ? (
              <tr>
                <td colSpan={8} className={styles.emptyCell}>
                  No DNS records found matching criteria.
                </td>
              </tr>
            ) : (
              records.map((rec) => {
                const isSelected = selectedRecordIds.includes(rec.id);
                const isApexNsOrSoa = !!(zone && rec.name === zone.name && (rec.type === 'NS' || rec.type === 'SOA'));
                
                return (
                  <tr 
                    key={rec.id} 
                    className={`${isSelected ? styles.selectedRow : ''} ${!isApexNsOrSoa ? styles.clickableRow : ''}`}
                    onClick={() => {
                      if (!isApexNsOrSoa) openEditPanel(rec);
                    }}
                  >
                    <td onClick={(e) => e.stopPropagation()}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        disabled={isApexNsOrSoa}
                        onChange={() => toggleSelectRecord(rec.id, rec)}
                      />
                    </td>
                    <td className={styles.recordName}>{rec.name}</td>
                    <td><span className={styles.recordType}>{rec.type}</span></td>
                    <td>{rec.routing_policy}</td>
                    <td>
                      {rec.routing_policy === 'Weighted' ? `Weight: ${rec.weight} (ID: ${rec.set_id})` : '-'}
                    </td>
                    <td>
                      <span className={`${styles.aliasBadge} ${rec.alias ? styles.aliasYes : styles.aliasNo}`}>
                        {rec.alias ? 'Yes' : 'No'}
                      </span>
                    </td>
                    <td>{rec.alias ? '-' : rec.ttl}</td>
                    <td>
                      {rec.alias ? (
                        <div className={styles.aliasValue}>
                          <span className={styles.aliasValLabel}>Alias Target:</span>
                          <code>{rec.alias_target}</code>
                        </div>
                      ) : (
                        <pre className={styles.recordValue}>{rec.value}</pre>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Create/Edit Record Sliding Drawer */}
      {panelOpen && zone && (
        <div className={styles.drawerOverlay} onClick={closePanel}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <h2>{editingRecord ? 'Edit record' : 'Create record'}</h2>
              <button onClick={closePanel} className={styles.closeDrawerBtn}>
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleSaveRecord} className={styles.drawerForm}>
              <div className={styles.formSection}>
                
                {/* Name & Subdomain */}
                <div className={styles.formField}>
                  <label>Record name</label>
                  <div className={styles.nameInputWrapper}>
                    <input
                      type="text"
                      placeholder="www"
                      value={recSubdomain}
                      onChange={(e) => setRecSubdomain(e.target.value)}
                      className="aws-input"
                      style={{ textAlign: 'right' }}
                    />
                    <span className={styles.nameSuffix}>.{zone.name}</span>
                  </div>
                  <span className={styles.fieldHint}>
                    Subdomain of the hosted zone domain name. Leave blank for the apex domain ({zone.name}).
                  </span>
                </div>

                {/* Record Type */}
                <div className={styles.formField}>
                  <label>Record type</label>
                  <select
                    value={recType}
                    onChange={(e) => setRecType(e.target.value)}
                    className="aws-select"
                  >
                    <option value="A">A - Routes traffic to an IPv4 address</option>
                    <option value="AAAA">AAAA - Routes traffic to an IPv6 address</option>
                    <option value="CNAME">CNAME - Routes traffic to another domain name</option>
                    <option value="MX">MX - Routes traffic to a mail server</option>
                    <option value="TXT">TXT - Text record containing readable metadata</option>
                    <option value="NS">NS - Name servers for the zone</option>
                    <option value="PTR">PTR - Pointer record for reverse DNS</option>
                    <option value="SRV">SRV - Service locator details</option>
                    <option value="CAA">CAA - Certification Authority Authorization</option>
                  </select>
                </div>

                {/* Alias Toggle */}
                <div className={styles.formField}>
                  <div className={styles.toggleRow}>
                    <label>Alias</label>
                    <input
                      type="checkbox"
                      checked={recAlias}
                      onChange={(e) => setRecAlias(e.target.checked)}
                      className={styles.toggleSwitch}
                    />
                  </div>
                  <span className={styles.fieldHint}>
                    Select Yes if you want to route traffic to selected AWS resources (like ELBs, CloudFront, S3) or other records in this zone.
                  </span>
                </div>

                {/* Alias Value Target */}
                {recAlias ? (
                  <div className={styles.formField}>
                    <label>Route traffic to <span className={styles.required}>*</span></label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. alb-dns-name.us-east-1.elb.amazonaws.com"
                      value={recAliasTarget}
                      onChange={(e) => setRecAliasTarget(e.target.value)}
                      className="aws-input"
                    />
                    <span className={styles.fieldHint}>
                      Enter the domain name or load balancer DNS name to route traffic to.
                    </span>
                  </div>
                ) : (
                  <>
                    {/* Non-Alias TTL */}
                    <div className={styles.formField}>
                      <label>TTL (Seconds) <span className={styles.required}>*</span></label>
                      <input
                        type="number"
                        required
                        min={0}
                        value={recTtl}
                        onChange={(e) => setRecTtl(Number(e.target.value))}
                        className="aws-input"
                      />
                      <span className={styles.fieldHint}>
                        The resource record cache expiration time (default 300).
                      </span>
                    </div>

                    {/* Non-Alias Value textarea */}
                    <div className={styles.formField}>
                      <label>Value <span className={styles.required}>*</span></label>
                      <textarea
                        required
                        placeholder={
                          recType === 'A' ? '192.0.2.44\n192.0.2.45' :
                          recType === 'MX' ? '10 mail.example.com.' :
                          'Enter record values (one per line)'
                        }
                        value={recValue}
                        onChange={(e) => setRecValue(e.target.value)}
                        className="aws-textarea"
                        rows={4}
                      />
                      <span className={styles.fieldHint}>
                        Enter values (one per line). Format varies by record type.
                      </span>
                    </div>
                  </>
                )}

                {/* Routing Policy */}
                <div className={styles.formField} style={{ borderTop: '1px solid var(--aws-border)', paddingTop: '16px' }}>
                  <label>Routing policy</label>
                  <select
                    value={recRouting}
                    onChange={(e) => setRecRouting(e.target.value)}
                    className="aws-select"
                  >
                    <option value="Simple">Simple routing</option>
                    <option value="Weighted">Weighted routing</option>
                  </select>
                </div>

                {/* Weighted Routing inputs */}
                {recRouting === 'Weighted' && (
                  <div className={styles.weightedOptions}>
                    <div className={styles.formField}>
                      <label>Weight (0-255)</label>
                      <input
                        type="number"
                        min={0}
                        max={255}
                        value={recWeight}
                        onChange={(e) => setRecWeight(Number(e.target.value))}
                        className="aws-input"
                      />
                      <span className={styles.fieldHint}>
                        Determines the proportion of traffic routed to this record.
                      </span>
                    </div>
                    
                    <div className={styles.formField}>
                      <label>Record ID (Set ID) <span className={styles.required}>*</span></label>
                      <input
                        type="text"
                        required
                        placeholder="e.g. primary-server"
                        value={recSetId}
                        onChange={(e) => setRecSetId(e.target.value)}
                        className="aws-input"
                      />
                      <span className={styles.fieldHint}>
                        A unique identifier to distinguish this record from other weighted records with the same name.
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Footer buttons */}
              <div className={styles.drawerFooter}>
                <button
                  type="button"
                  onClick={closePanel}
                  className="aws-btn aws-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingRecord}
                  className="aws-btn aws-btn-primary"
                >
                  {savingRecord ? 'Saving...' : editingRecord ? 'Save changes' : 'Create record'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Import BIND File Modal */}
      {importModalOpen && zone && (
        <div className={styles.modalOverlay} onClick={() => setImportModalOpen(false)}>
          <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
            <div className={styles.modalHeader}>
              <h3>Import zone file</h3>
              <button onClick={() => setImportModalOpen(false)} className={styles.closeDrawerBtn}>
                <svg viewBox="0 0 24 24" width="18" height="18">
                  <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>

            <form onSubmit={handleImportBind} className={styles.modalForm}>
              <div className={styles.modalBody}>
                <p className={styles.modalInfo}>
                  Upload a BIND-compatible DNS zone file to import records into <strong>{zone.name}</strong>.
                </p>
                
                <div className={styles.alertBox}>
                  <strong>Note:</strong> SOA and apex NS records in the zone file will be skipped to avoid disrupting default AWS configurations. Existing custom records with identical subdomains and types may be skipped or merged.
                </div>

                <div className={styles.formField} style={{ marginTop: '16px' }}>
                  <label>Select BIND Zone file</label>
                  <input
                    type="file"
                    ref={fileInputRef}
                    accept=".txt,.zone,.cap,.conf,text/plain"
                    onChange={(e) => {
                      if (e.target.files && e.target.files.length > 0) {
                        setImportFile(e.target.files[0]);
                      }
                    }}
                    required
                    style={{ padding: '8px 0' }}
                  />
                </div>
              </div>

              <div className={styles.modalFooter}>
                <button
                  type="button"
                  onClick={() => setImportModalOpen(false)}
                  className="aws-btn aws-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={importing || !importFile}
                  className="aws-btn aws-btn-primary"
                >
                  {importing ? 'Importing...' : 'Import records'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
