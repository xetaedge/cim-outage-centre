'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  MapPin, Search, Plus, X, Edit2, Trash2, ChevronDown, ChevronUp,
  Mail, Phone, AlertCircle, CheckCircle2, UserPlus, Loader2, Building2, Save, Map,
  Building
} from 'lucide-react';
import { useCimStore } from '@/store/useCimStore';

// --- Types ---
interface SupportPerson {
  id: string;
  siteId: string;
  name: string;
  mobile1: string;
  mobile2: string;
  email: string;
  priority: string;
  type: string;
}

interface Site {
  id: string;
  name: string;
  code: string;
  city: string;
  state: string;
  country: string;
  lat: number;
  lng: number;
  businessUnit: string;
  siteType: string;
  supportEmails: string;
  status: 'HEALTHY' | 'WARNING' | 'IMPACTED';
  _count?: { supportPersons: number };
  supportPersons?: SupportPerson[];
}

// --- Components ---
export default function SitesManagementPage() {
  const { currentRole, addToast } = useCimStore();
  const isAdmin = currentRole === 'ADMIN';

  // State
  const [sites, setSites] = useState<Site[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [cityFilter, setCityFilter] = useState('All');
  const [typeFilter, setTypeFilter] = useState('All');
  const [priorityFilter, setPriorityFilter] = useState('All');
  
  const [expandedSiteId, setExpandedSiteId] = useState<string | null>(null);
  const [isSiteFormOpen, setIsSiteFormOpen] = useState(false);
  const [editingSite, setEditingSite] = useState<Site | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Expanded site details state (to fetch support persons if not included)
  const [expandedSiteDetails, setExpandedSiteDetails] = useState<Site | null>(null);
  const [isLoadingDetails, setIsLoadingDetails] = useState(false);

  // Form states
  const [siteForm, setSiteForm] = useState({
    name: '', code: '', city: '', state: '', country: 'India',
    lat: 0, lng: 0, businessUnit: '', siteType: 'Corporate', supportEmails: ''
  });

  const [personFormOpenId, setPersonFormOpenId] = useState<string | null>(null);
  const [editingPersonId, setEditingPersonId] = useState<string | null>(null);
  const [personForm, setPersonForm] = useState({
    name: '', mobile1: '', mobile2: '', email: '', priority: 'Primary', type: 'IT'
  });

  const fetchSites = useCallback(async () => {
    try {
      setIsLoading(true);
      const res = await fetch('/api/sites');
      const data = await res.json();
      if (data.success) {
        setSites(data.sites || []);
      } else {
        addToast({ title: 'Error', message: 'Failed to fetch sites', type: 'error' });
      }
    } catch (error) {
      console.error(error);
      addToast({ title: 'Error', message: 'Failed to fetch sites', type: 'error' });
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchSites();
  }, [fetchSites]);

  // Derived state
  const cities = useMemo(() => {
    const unique = new Set(sites.map(s => s.city).filter(Boolean));
    return ['All', ...Array.from(unique)];
  }, [sites]);

  const filteredSites = useMemo(() => {
    return sites.filter(s => {
      const matchSearch = search ? 
        (s.name?.toLowerCase().includes(search.toLowerCase()) || 
         s.code?.toLowerCase().includes(search.toLowerCase()) || 
         s.city?.toLowerCase().includes(search.toLowerCase())) : true;
      const matchCity = cityFilter === 'All' ? true : s.city === cityFilter;
      const matchType = typeFilter === 'All' ? true : s.siteType === typeFilter;
      // We don't have deep filtering on support persons at this level unless returned by API.
      return matchSearch && matchCity && matchType;
    });
  }, [sites, search, cityFilter, typeFilter]);

  const stats = useMemo(() => {
    const total = sites.length;
    const byType = sites.reduce((acc, s) => {
      acc[s.siteType] = (acc[s.siteType] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const totalPersons = sites.reduce((acc, s) => acc + (s._count?.supportPersons || s.supportPersons?.length || 0), 0);
    return { total, byType, totalPersons };
  }, [sites]);

  // Handlers
  const handleSiteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      const url = editingSite ? `/api/sites/${editingSite.id}` : '/api/sites';
      const method = editingSite ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(siteForm)
      });
      const data = await res.json();
      if (data.success) {
        addToast({ title: 'Success', message: `Site ${editingSite ? 'updated' : 'created'} successfully`, type: 'update' });
        setIsSiteFormOpen(false);
        setEditingSite(null);
        fetchSites();
      } else {
        addToast({ title: 'Error', message: data.message || 'Failed to save site', type: 'error' });
      }
    } catch (error) {
      console.error(error);
      addToast({ title: 'Error', message: 'An error occurred while saving the site', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteSite = async (id: string) => {
    if (!isAdmin || !confirm('Are you sure you want to delete this site?')) return;
    try {
      const res = await fetch(`/api/sites/${id}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast({ title: 'Success', message: 'Site deleted', type: 'update' });
        fetchSites();
      } else {
        addToast({ title: 'Error', message: data.message || 'Failed to delete site', type: 'error' });
      }
    } catch (error) {
      addToast({ title: 'Error', message: 'Failed to delete site', type: 'error' });
    }
  };

  const handleExpandSite = async (site: Site) => {
    if (expandedSiteId === site.id) {
      setExpandedSiteId(null);
      setExpandedSiteDetails(null);
      return;
    }
    setExpandedSiteId(site.id);
    setIsLoadingDetails(true);
    try {
      const res = await fetch(`/api/sites/${site.id}`);
      const data = await res.json();
      if (data.success) {
        setExpandedSiteDetails(data.site);
      }
    } catch (error) {
      addToast({ title: 'Error', message: 'Failed to fetch site details', type: 'error' });
    } finally {
      setIsLoadingDetails(false);
    }
  };

  const handlePersonSubmit = async (siteId: string, e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setIsSaving(true);
    try {
      const url = editingPersonId ? `/api/sites/${siteId}/support-persons/${editingPersonId}` : `/api/sites/${siteId}/support-persons`;
      const method = editingPersonId ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(personForm)
      });
      const data = await res.json();
      if (data.success) {
        addToast({ title: 'Success', message: `Support person ${editingPersonId ? 'updated' : 'added'}`, type: 'update' });
        setPersonFormOpenId(null);
        setEditingPersonId(null);
        // Refresh site details
        handleExpandSite({ id: siteId } as Site);
        // Optionally fetch sites to update counts
        fetchSites();
      } else {
        addToast({ title: 'Error', message: data.message || 'Failed to save support person', type: 'error' });
      }
    } catch (error) {
      addToast({ title: 'Error', message: 'An error occurred', type: 'error' });
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeletePerson = async (siteId: string, personId: string) => {
    if (!isAdmin || !confirm('Delete support person?')) return;
    try {
      const res = await fetch(`/api/sites/${siteId}/support-persons/${personId}`, { method: 'DELETE' });
      const data = await res.json();
      if (data.success) {
        addToast({ title: 'Success', message: 'Support person deleted', type: 'update' });
        handleExpandSite({ id: siteId } as Site);
        fetchSites();
      } else {
        addToast({ title: 'Error', message: data.message || 'Failed to delete support person', type: 'error' });
      }
    } catch (error) {
      addToast({ title: 'Error', message: 'Failed to delete support person', type: 'error' });
    }
  };

  const openSiteForm = (site?: Site) => {
    if (site) {
      setEditingSite(site);
      setSiteForm({
        name: site.name || '', code: site.code || '', city: site.city || '', state: site.state || '', country: site.country || 'India',
        lat: site.lat || 0, lng: site.lng || 0, businessUnit: site.businessUnit || '', siteType: site.siteType || 'Corporate', supportEmails: site.supportEmails || ''
      });
    } else {
      setEditingSite(null);
      setSiteForm({
        name: '', code: '', city: '', state: '', country: 'India',
        lat: 0, lng: 0, businessUnit: '', siteType: 'Corporate', supportEmails: ''
      });
    }
    setIsSiteFormOpen(true);
  };

  const openPersonForm = (siteId: string, person?: SupportPerson) => {
    setPersonFormOpenId(siteId);
    if (person) {
      setEditingPersonId(person.id);
      setPersonForm({
        name: person.name || '', mobile1: person.mobile1 || '', mobile2: person.mobile2 || '',
        email: person.email || '', priority: person.priority || 'Primary', type: person.type || 'IT'
      });
    } else {
      setEditingPersonId(null);
      setPersonForm({
        name: '', mobile1: '', mobile2: '', email: '', priority: 'Primary', type: 'IT'
      });
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'HEALTHY': return 'text-emerald-400 border-emerald-400/20 bg-emerald-400/10';
      case 'WARNING': return 'text-yellow-400 border-yellow-400/20 bg-yellow-400/10';
      case 'IMPACTED': return 'text-red-400 border-red-400/20 bg-red-400/10';
      default: return 'text-slate-400 border-slate-700 bg-slate-800';
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-2">
            <MapPin className="w-6 h-6 text-blue-400" />
            Sites Management
          </h1>
          <p className="text-sm text-slate-400">Manage CIM locations, support contacts & notification channels</p>
        </div>
        {isAdmin && (
          <button 
            onClick={() => openSiteForm()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors"
          >
            <Plus className="w-4 h-4" />
            Add Site
          </button>
        )}
      </div>

      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass-card p-4 rounded-xl flex flex-col">
          <span className="text-xs text-slate-400 font-medium">Total Sites</span>
          <span className="text-2xl font-bold text-white">{stats.total}</span>
        </div>
        <div className="glass-card p-4 rounded-xl flex flex-col">
          <span className="text-xs text-slate-400 font-medium">Corporate</span>
          <span className="text-2xl font-bold text-white">{stats.byType['Corporate'] || 0}</span>
        </div>
        <div className="glass-card p-4 rounded-xl flex flex-col">
          <span className="text-xs text-slate-400 font-medium">Warehouse/Plant</span>
          <span className="text-2xl font-bold text-white">{(stats.byType['Warehouse'] || 0) + (stats.byType['Plant'] || 0)}</span>
        </div>
        <div className="glass-card p-4 rounded-xl flex flex-col">
          <span className="text-xs text-slate-400 font-medium">Support Persons</span>
          <span className="text-2xl font-bold text-white">{stats.totalPersons}</span>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="glass-card p-4 rounded-xl flex flex-wrap gap-4 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Search</label>
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input 
              type="text" 
              placeholder="Search name, code, city..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full bg-slate-800 border border-slate-700 rounded-lg pl-9 pr-3 py-2 text-xs text-white outline-none focus:border-blue-500 transition-colors"
            />
          </div>
        </div>
        <div className="w-full md:w-48">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">City</label>
          <select 
            value={cityFilter} onChange={(e) => setCityFilter(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
          >
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="w-full md:w-48">
          <label className="block text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-1">Type</label>
          <select 
            value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)}
            className="w-full bg-slate-800 border border-slate-700 rounded-lg px-3 py-2 text-xs text-white outline-none focus:border-blue-500"
          >
            {['All', 'Corporate', 'Warehouse', 'Plant', 'Other'].map(t => <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
        <button 
          onClick={() => { setSearch(''); setCityFilter('All'); setTypeFilter('All'); setPriorityFilter('All'); }}
          className="px-4 py-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors"
        >
          Clear Filters
        </button>
      </div>

      {/* Site Form (Inline) */}
      {isSiteFormOpen && isAdmin && (
        <div className="glass-card p-6 rounded-xl border border-blue-500/30 bg-slate-900/80">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-bold text-white flex items-center gap-2">
              <Building2 className="w-5 h-5 text-blue-400" />
              {editingSite ? 'Edit Site' : 'Add New Site'}
            </h2>
            <button onClick={() => setIsSiteFormOpen(false)} className="text-slate-400 hover:text-white">
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleSiteSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Name *</label>
              <input required type="text" value={siteForm.name} onChange={e => setSiteForm({...siteForm, name: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Code</label>
              <input type="text" placeholder="Auto-generated if empty" value={siteForm.code} onChange={e => setSiteForm({...siteForm, code: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Business Unit</label>
              <input type="text" value={siteForm.businessUnit} onChange={e => setSiteForm({...siteForm, businessUnit: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white" />
            </div>
            
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">City *</label>
              <input required type="text" value={siteForm.city} onChange={e => setSiteForm({...siteForm, city: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">State</label>
              <input type="text" value={siteForm.state} onChange={e => setSiteForm({...siteForm, state: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Country</label>
              <input type="text" value={siteForm.country} onChange={e => setSiteForm({...siteForm, country: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white" />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Site Type</label>
              <select value={siteForm.siteType} onChange={e => setSiteForm({...siteForm, siteType: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white">
                <option value="Corporate">Corporate</option>
                <option value="Warehouse">Warehouse</option>
                <option value="Plant">Plant</option>
                <option value="Other">Other</option>
              </select>
            </div>
            <div className="md:col-span-2">
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Support Emails (comma separated)</label>
              <input type="text" value={siteForm.supportEmails} onChange={e => setSiteForm({...siteForm, supportEmails: e.target.value})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white" placeholder="admin@site.com, it@site.com" />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Latitude</label>
              <input type="number" step="any" value={siteForm.lat} onChange={e => setSiteForm({...siteForm, lat: parseFloat(e.target.value) || 0})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white" />
            </div>
            <div>
              <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Longitude</label>
              <input type="number" step="any" value={siteForm.lng} onChange={e => setSiteForm({...siteForm, lng: parseFloat(e.target.value) || 0})} className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white" />
            </div>
            
            <div className="md:col-span-3 flex justify-end gap-3 mt-2">
              <button type="button" onClick={() => setIsSiteFormOpen(false)} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition-colors">
                Cancel
              </button>
              <button type="submit" disabled={isSaving} className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-bold transition-colors disabled:opacity-50">
                {isSaving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                {editingSite ? 'Update Site' : 'Save Site'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Grid */}
      {isLoading ? (
        <div className="flex justify-center items-center py-20">
          <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      ) : filteredSites.length === 0 ? (
        <div className="glass-card p-10 rounded-xl text-center flex flex-col items-center gap-3">
          <Building className="w-12 h-12 text-slate-600" />
          <h3 className="text-lg font-bold text-white">No sites found</h3>
          <p className="text-sm text-slate-400">Try adjusting your filters or add a new site.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredSites.map(site => (
            <div key={site.id} className="glass-card rounded-xl border border-slate-700 overflow-hidden flex flex-col transition-all hover:border-slate-600">
              {/* Card Header */}
              <div className="p-4 flex flex-col gap-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h3 className="font-bold text-white text-base leading-tight">{site.name}</h3>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="font-mono text-[10px] text-slate-400 bg-slate-800 px-1.5 py-0.5 rounded">{site.code}</span>
                      <span className={`px-2 py-0.5 text-[10px] font-bold rounded-full border ${getStatusColor(site.status || 'HEALTHY')}`}>
                        {site.status || 'HEALTHY'}
                      </span>
                    </div>
                  </div>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button onClick={(e) => { e.stopPropagation(); openSiteForm(site); }} className="p-1.5 text-slate-400 hover:text-blue-400 hover:bg-slate-800 rounded-lg transition-colors">
                        <Edit2 className="w-3.5 h-3.5" />
                      </button>
                      <button onClick={(e) => { e.stopPropagation(); handleDeleteSite(site.id); }} className="p-1.5 text-slate-400 hover:text-red-400 hover:bg-slate-800 rounded-lg transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )}
                </div>

                <div className="text-xs text-slate-300 mt-2 flex flex-col gap-1.5">
                  <div className="flex items-center gap-2">
                    <Map className="w-3.5 h-3.5 text-slate-500" />
                    <span>{[site.city, site.state, site.country].filter(Boolean).join(', ')}</span>
                  </div>
                  {(site.businessUnit || site.siteType) && (
                    <div className="flex items-center gap-2">
                      <Building2 className="w-3.5 h-3.5 text-slate-500" />
                      <span className="bg-slate-800 px-2 py-0.5 rounded-full text-[10px]">{site.siteType}</span>
                      <span className="text-slate-400">{site.businessUnit}</span>
                    </div>
                  )}
                  {site.supportEmails && (
                    <div className="flex items-start gap-2">
                      <Mail className="w-3.5 h-3.5 text-slate-500 mt-0.5" />
                      <span className="text-slate-400 truncate flex-1" title={site.supportEmails}>{site.supportEmails}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Expand Toggle */}
              <div 
                onClick={() => handleExpandSite(site)}
                className="px-4 py-2.5 bg-slate-800/50 hover:bg-slate-800 cursor-pointer border-t border-slate-700 flex justify-between items-center transition-colors"
              >
                <div className="flex items-center gap-2">
                  <UserPlus className="w-3.5 h-3.5 text-slate-400" />
                  <span className="text-xs font-medium text-slate-300">
                    Support Persons <span className="bg-slate-700 text-slate-300 px-1.5 py-0.5 rounded-full text-[10px] ml-1">{site._count?.supportPersons || site.supportPersons?.length || 0}</span>
                  </span>
                </div>
                {expandedSiteId === site.id ? <ChevronUp className="w-4 h-4 text-slate-400" /> : <ChevronDown className="w-4 h-4 text-slate-400" />}
              </div>

              {/* Expanded Content */}
              {expandedSiteId === site.id && (
                <div className="p-4 bg-slate-900/50 border-t border-slate-700">
                  {isLoadingDetails ? (
                    <div className="flex justify-center py-4"><Loader2 className="w-5 h-5 text-slate-400 animate-spin" /></div>
                  ) : (
                    <div className="space-y-4">
                      {isAdmin && (
                        <button 
                          onClick={() => openPersonForm(site.id)}
                          className="w-full flex items-center justify-center gap-2 py-2 border border-dashed border-slate-600 hover:border-blue-500 hover:text-blue-400 text-slate-400 rounded-lg text-xs font-medium transition-colors"
                        >
                          <Plus className="w-3.5 h-3.5" /> Add Support Person
                        </button>
                      )}

                      {/* Person Form */}
                      {personFormOpenId === site.id && isAdmin && (
                        <form onSubmit={(e) => handlePersonSubmit(site.id, e)} className="bg-slate-800 border border-slate-700 p-3 rounded-lg space-y-3">
                          <div className="flex justify-between items-center mb-1">
                            <span className="text-xs font-bold text-white">{editingPersonId ? 'Edit Person' : 'New Support Person'}</span>
                            <button type="button" onClick={() => setPersonFormOpenId(null)} className="text-slate-400 hover:text-white"><X className="w-4 h-4" /></button>
                          </div>
                          <div className="grid grid-cols-2 gap-3">
                            <div className="col-span-2">
                              <input required type="text" placeholder="Name *" value={personForm.name} onChange={e => setPersonForm({...personForm, name: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-xs text-white" />
                            </div>
                            <input type="text" placeholder="Mobile 1" value={personForm.mobile1} onChange={e => setPersonForm({...personForm, mobile1: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-xs text-white" />
                            <input type="text" placeholder="Mobile 2" value={personForm.mobile2} onChange={e => setPersonForm({...personForm, mobile2: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-xs text-white" />
                            <input type="email" placeholder="Email" value={personForm.email} onChange={e => setPersonForm({...personForm, email: e.target.value})} className="col-span-2 w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-xs text-white" />
                            <select value={personForm.priority} onChange={e => setPersonForm({...personForm, priority: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-xs text-white">
                              <option>Primary</option>
                              <option>Secondary</option>
                            </select>
                            <select value={personForm.type} onChange={e => setPersonForm({...personForm, type: e.target.value})} className="w-full bg-slate-900 border border-slate-700 rounded-md p-2 text-xs text-white">
                              <option>IT</option>
                              <option>Management</option>
                              <option>Facilities</option>
                              <option>Other</option>
                            </select>
                          </div>
                          <div className="flex justify-end pt-1">
                            <button type="submit" disabled={isSaving} className="bg-blue-600 hover:bg-blue-500 text-white px-3 py-1.5 rounded-md text-xs font-bold transition-colors flex items-center gap-1">
                              {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                            </button>
                          </div>
                        </form>
                      )}

                      {/* Persons List */}
                      <div className="space-y-2">
                        {expandedSiteDetails?.supportPersons?.length === 0 && !personFormOpenId && (
                          <div className="text-center text-xs text-slate-500 py-2">No support persons added.</div>
                        )}
                        {expandedSiteDetails?.supportPersons?.map(person => (
                          <div key={person.id} className="bg-slate-800/80 border border-slate-700/50 p-2.5 rounded-lg flex items-start justify-between group">
                            <div className="space-y-1 w-full">
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-bold text-white">{person.name}</span>
                                  <span className={`text-[9px] px-1.5 py-0.5 rounded-full border font-medium ${person.priority === 'Primary' ? 'bg-blue-900/30 text-blue-400 border-blue-500/30' : 'bg-slate-700 text-slate-300 border-slate-600'}`}>{person.priority}</span>
                                  <span className="text-[9px] px-1.5 py-0.5 rounded-full border bg-slate-800 text-slate-400 border-slate-600">{person.type}</span>
                                </div>
                                {isAdmin && (
                                  <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button onClick={() => openPersonForm(site.id, person)} className="p-1 text-slate-400 hover:text-blue-400 hover:bg-slate-700 rounded"><Edit2 className="w-3 h-3" /></button>
                                    <button onClick={() => handleDeletePerson(site.id, person.id)} className="p-1 text-slate-400 hover:text-red-400 hover:bg-slate-700 rounded"><Trash2 className="w-3 h-3" /></button>
                                  </div>
                                )}
                              </div>
                              <div className="flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-slate-400">
                                {person.email && (
                                  <div className="flex items-center gap-1"><Mail className="w-3 h-3" /> {person.email}</div>
                                )}
                                {person.mobile1 && (
                                  <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {person.mobile1}</div>
                                )}
                                {person.mobile2 && (
                                  <div className="flex items-center gap-1"><Phone className="w-3 h-3" /> {person.mobile2}</div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
