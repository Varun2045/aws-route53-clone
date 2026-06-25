'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { useApp } from '@/context/AppContext';
import styles from './page.module.css';

interface HostedZone {
  id: string;
  name: string;
  description: string | null;
  type: string;
  vpc_id: string | null;
  vpc_region: string | null;
  record_count: number;
  created_at: string;
}

export default function HostedZonesPage() {
  const { fetchApi, addToast } = useApp();
  
  // State
  const [zones, setZones] = useState<HostedZone[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedZoneIds, setSelectedZoneIds] = useState<string[]>([]);
  
  // Creation Drawer State
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [newZoneName, setNewZoneName] = useState('');
  const [newZoneDesc, setNewZoneDesc] = useState('');
  const [newZoneType, setNewZoneType] = useState('Public');
  const [newZoneVpcId, setNewZoneVpcId] = useState('vpc-0a1b2c3d4e5f6g7h8');
  const [newZoneVpcRegion, setNewZoneVpcRegion] = useState('us-east-1');
  const [creating, setCreating] = useState(false);

  // Pagination State
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage, setRowsPerPage] = useState(10);

  // Keyboard shortcut Esc to close drawer
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && drawerOpen) {
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [drawerOpen]);

  // Fetch zones
  const fetchZones = async () => {
    setLoading(true);
    try {
      const url = searchQuery.trim() 
        ? `/api/hosted-zones?query=${encodeURIComponent(searchQuery)}`
        : '/api/hosted-zones';
      
      const res = await fetchApi(url);
      if (res.ok) {
        const data = await res.json();
        setZones(data);
      } else {
        addToast('Failed to fetch hosted zones', 'error');
      }
    } catch (err) {
      addToast('Error loading hosted zones from API', 'error');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchZones();
    setSelectedZoneIds([]);
  }, [searchQuery]);

  // Handle select row
  const toggleSelectZone = (id: string) => {
    setSelectedZoneIds((prev) => 
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const toggleSelectAll = () => {
    if (selectedZoneIds.length === paginatedZones.length) {
      setSelectedZoneIds([]);
    } else {
      setSelectedZoneIds(paginatedZones.map((z) => z.id));
    }
  };

  // Create Zone
  const handleCreateZone = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newZoneName.trim()) {
      addToast('Domain name is required', 'error');
      return;
    }

    setCreating(true);
    try {
      const payload = {
        name: newZoneName.trim(),
        description: newZoneDesc.trim() || null,
        type: newZoneType,
        vpc_id: newZoneType === 'Private' ? newZoneVpcId.trim() : null,
        vpc_region: newZoneType === 'Private' ? newZoneVpcRegion.trim() : null
      };

      const res = await fetchApi('/api/hosted-zones', {
        method: 'POST',
        body: JSON.stringify(payload),
      });

      if (res.ok) {
        addToast(`Hosted zone ${newZoneName} created successfully.`, 'success');
        setNewZoneName('');
        setNewZoneDesc('');
        setNewZoneType('Public');
        setDrawerOpen(false);
        fetchZones();
      } else {
        const err = await res.json();
        addToast(err.detail || 'Failed to create hosted zone', 'error');
      }
    } catch (err) {
      addToast('API Error creating hosted zone', 'error');
    } finally {
      setCreating(false);
    }
  };

  // Delete Zone
  const handleDeleteZones = async () => {
    if (selectedZoneIds.length === 0) return;
    if (!confirm(`Are you sure you want to delete the ${selectedZoneIds.length} selected hosted zone(s)? This will delete all associated DNS records.`)) {
      return;
    }

    try {
      let failed = 0;
      for (const id of selectedZoneIds) {
        const res = await fetchApi(`/api/hosted-zones/${id}`, { method: 'DELETE' });
        if (!res.ok) failed++;
      }

      if (failed > 0) {
        addToast(`Deleted hosted zones. Failed to delete ${failed} zones.`, 'error');
      } else {
        addToast(`Successfully deleted ${selectedZoneIds.length} hosted zone(s).`, 'success');
      }
      setSelectedZoneIds([]);
      fetchZones();
    } catch (err) {
      addToast('API Error deleting hosted zones', 'error');
    }
  };

  // Filter & Pagination calculations
  const indexOfLastZone = currentPage * rowsPerPage;
  const indexOfFirstZone = indexOfLastZone - rowsPerPage;
  const paginatedZones = zones.slice(indexOfFirstZone, indexOfLastZone);
  const totalPages = Math.ceil(zones.length / rowsPerPage) || 1;

  return (
    <div className={styles.container}>
      {/* Top Header Section */}
      <div className={styles.pageHeader}>
        <div>
          <h1 className={styles.pageTitle}>Hosted zones</h1>
          <p className={styles.pageSubtitle}>
            A hosted zone is a container for records, which define how you want to route traffic for a domain.
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className={styles.toolbar}>
        <div className={styles.searchContainer}>
          <input
            type="text"
            placeholder="Search hosted zones (e.g. name, description)"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setCurrentPage(1);
            }}
            className="aws-input"
            style={{ maxWidth: '360px' }}
          />
        </div>
        <div className={styles.actionButtons}>
          <button
            onClick={handleDeleteZones}
            disabled={selectedZoneIds.length === 0}
            className="aws-btn aws-btn-danger"
          >
            Delete hosted zone
          </button>
          <button
            onClick={() => setDrawerOpen(true)}
            className="aws-btn aws-btn-primary"
          >
            Create hosted zone
          </button>
        </div>
      </div>

      {/* Main Table */}
      <div className={styles.tableWrapper}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th style={{ width: '40px' }}>
                <input
                  type="checkbox"
                  checked={paginatedZones.length > 0 && selectedZoneIds.length === paginatedZones.length}
                  onChange={toggleSelectAll}
                />
              </th>
              <th>Domain name</th>
              <th>Type</th>
              <th>Description</th>
              <th>Record count</th>
              <th>Hosted zone ID</th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className={styles.loadingCell}>
                  <div className={styles.loadingSpinner}></div>
                  <span>Loading hosted zones...</span>
                </td>
              </tr>
            ) : paginatedZones.length === 0 ? (
              <tr>
                <td colSpan={6} className={styles.emptyCell}>
                  No hosted zones found. Create a hosted zone to get started.
                </td>
              </tr>
            ) : (
              paginatedZones.map((zone) => {
                const isSelected = selectedZoneIds.includes(zone.id);
                return (
                  <tr 
                    key={zone.id} 
                    className={`${isSelected ? styles.selectedRow : ''}`}
                  >
                    <td>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelectZone(zone.id)}
                      />
                    </td>
                    <td>
                      <Link href={`/hosted-zones/${zone.id}`} className={styles.zoneLink}>
                        {zone.name}
                      </Link>
                    </td>
                    <td>
                      <span className={`aws-badge ${zone.type === 'Public' ? 'aws-badge-public' : 'aws-badge-private'}`}>
                        {zone.type}
                      </span>
                      {zone.type === 'Private' && zone.vpc_id && (
                        <div className={styles.vpcDetails}>
                          <code>{zone.vpc_id} ({zone.vpc_region})</code>
                        </div>
                      )}
                    </td>
                    <td className={styles.descCell}>{zone.description || '-'}</td>
                    <td>{zone.record_count}</td>
                    <td>
                      <code className={styles.zoneId}>{zone.id}</code>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination Footer */}
      <div className={styles.paginationFooter}>
        <div className={styles.paginationInfo}>
          Showing {zones.length > 0 ? indexOfFirstZone + 1 : 0} to {Math.min(indexOfLastZone, zones.length)} of {zones.length} hosted zones
        </div>
        <div className={styles.paginationControls}>
          <button 
            disabled={currentPage === 1 || loading}
            onClick={() => setCurrentPage((p) => p - 1)}
            className="aws-btn aws-btn-secondary"
            style={{ padding: '4px 10px', fontSize: '12px' }}
          >
            Prev
          </button>
          <span className={styles.pageIndicator}>
            Page {currentPage} of {totalPages}
          </span>
          <button 
            disabled={currentPage === totalPages || loading}
            onClick={() => setCurrentPage((p) => p + 1)}
            className="aws-btn aws-btn-secondary"
            style={{ padding: '4px 10px', fontSize: '12px' }}
          >
            Next
          </button>
        </div>
      </div>

      {/* Create Hosted Zone sliding drawer (Right overlay) */}
      {drawerOpen && (
        <div className={styles.drawerOverlay} onClick={() => setDrawerOpen(false)}>
          <div className={styles.drawer} onClick={(e) => e.stopPropagation()}>
            <div className={styles.drawerHeader}>
              <h2>Create hosted zone</h2>
              <button onClick={() => setDrawerOpen(false)} className={styles.closeDrawerBtn}>
                <svg viewBox="0 0 24 24" width="20" height="20">
                  <path fill="currentColor" d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                </svg>
              </button>
            </div>
            
            <form onSubmit={handleCreateZone} className={styles.drawerForm}>
              <div className={styles.formSection}>
                <h3>Hosted zone configuration</h3>
                <p className={styles.sectionSubtitle}>
                  Enter the domain name and options for your hosted zone.
                </p>

                <div className={styles.formField}>
                  <label>Domain name <span className={styles.required}>*</span></label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. example.com"
                    value={newZoneName}
                    onChange={(e) => setNewZoneName(e.target.value)}
                    className="aws-input"
                  />
                  <span className={styles.fieldHint}>
                    The domain name that you want to route traffic for.
                  </span>
                </div>

                <div className={styles.formField}>
                  <label>Description</label>
                  <textarea
                    placeholder="Optional description"
                    value={newZoneDesc}
                    onChange={(e) => setNewZoneDesc(e.target.value)}
                    className="aws-textarea"
                    rows={3}
                  />
                </div>

                <div className={styles.formField}>
                  <label>Type</label>
                  <select
                    value={newZoneType}
                    onChange={(e) => setNewZoneType(e.target.value)}
                    className="aws-select"
                  >
                    <option value="Public">Public hosted zone</option>
                    <option value="Private">Private hosted zone</option>
                  </select>
                  <span className={styles.fieldHint}>
                    Select Public if you want Route 53 to route traffic on the internet. Select Private if you want it to route traffic within one or more Amazon VPCs.
                  </span>
                </div>

                {newZoneType === 'Private' && (
                  <div className={styles.privateOptions}>
                    <h4>VPC Association</h4>
                    <p className={styles.sectionSubtitle}>
                      Private zones require association with a Virtual Private Cloud (VPC).
                    </p>

                    <div className={styles.formField}>
                      <label>VPC Region</label>
                      <select
                        value={newZoneVpcRegion}
                        onChange={(e) => setNewZoneVpcRegion(e.target.value)}
                        className="aws-select"
                      >
                        <option value="us-east-1">us-east-1 (N. Virginia)</option>
                        <option value="us-west-2">us-west-2 (Oregon)</option>
                        <option value="eu-west-1">eu-west-1 (Ireland)</option>
                        <option value="ap-southeast-1">ap-southeast-1 (Singapore)</option>
                      </select>
                    </div>

                    <div className={styles.formField}>
                      <label>VPC ID</label>
                      <input
                        type="text"
                        placeholder="e.g. vpc-0a1b2c3d4e5f6g7h8"
                        value={newZoneVpcId}
                        onChange={(e) => setNewZoneVpcId(e.target.value)}
                        className="aws-input"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className={styles.drawerFooter}>
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="aws-btn aws-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={creating}
                  className="aws-btn aws-btn-primary"
                >
                  {creating ? 'Creating...' : 'Create hosted zone'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
