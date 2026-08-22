'use client';

import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  X,
  Search,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  Globe,
  Radio,
  Sparkles,
  Database,
  ShieldAlert,
  MapPin,
  Plus,
  Building,
} from 'lucide-react';
import { useCimStore } from '@/store/useCimStore';

interface SiteItem {
  id: string;
  name: string;
  code: string;
  city: string;
  businessUnit?: string;
}

const PREDEFINED_CITIES = [
  { city: 'Chicago', country: 'United States', lat: 41.8781, lng: -87.6298 },
  { city: 'London', country: 'United Kingdom', lat: 51.5074, lng: -0.1278 },
  { city: 'Tokyo', country: 'Japan', lat: 35.6762, lng: 139.6503 },
  { city: 'New York', country: 'United States', lat: 40.7128, lng: -74.006 },
  { city: 'Frankfurt', country: 'Germany', lat: 50.1109, lng: 8.6821 },
  { city: 'Singapore', country: 'Singapore', lat: 1.3521, lng: 103.8198 },
  { city: 'Sydney', country: 'Australia', lat: -33.8688, lng: 151.2093 },
  { city: 'São Paulo', country: 'Brazil', lat: -23.5505, lng: -46.6333 },
  { city: 'Mumbai', country: 'India', lat: 19.076, lng: 72.8777 },
  { city: 'Toronto', country: 'Canada', lat: 43.6532, lng: -79.3832 },
  { city: 'Paris', country: 'France', lat: 48.8566, lng: 2.3522 },
  { city: 'Hong Kong', country: 'China', lat: 22.3193, lng: 114.1694 },
  { city: 'Dubai', country: 'United Arab Emirates', lat: 25.2048, lng: 55.2708 },
  { city: 'San Francisco', country: 'United States', lat: 37.7749, lng: -122.4194 },
  { city: 'Amsterdam', country: 'Netherlands', lat: 52.3676, lng: 4.9041 },
];

const LOCATION_SUGGESTIONS = [
  { name: 'Slough Interconnect Carrier Facility', city: 'London', bu: 'Plant' },
  { name: 'Chicago Primary Cloud Data Center', city: 'Chicago', bu: 'Corporate Office' },
  { name: 'London Slough Edge Router Hub', city: 'London', bu: 'Plant' },
  { name: 'Tokyo Core Financial Gateway', city: 'Tokyo', bu: 'Corporate Office' },
  { name: 'New York Equinix Trading Exchange', city: 'New York', bu: 'Corporate Office' },
  { name: 'Frankfurt Main Data Campus', city: 'Frankfurt', bu: 'Plant' },
  { name: 'Singapore Jurong Tech Facility', city: 'Singapore', bu: 'Warehouse' },
  { name: 'Sydney Global Exchange Hub', city: 'Sydney', bu: 'Others' },
  { name: 'São Paulo Regional Operations', city: 'São Paulo', bu: 'Corporate Office' },
  { name: 'Mumbai Cloud Interconnect', city: 'Mumbai', bu: 'Plant' },
  { name: 'Toronto Logistics Data Center', city: 'Toronto', bu: 'Warehouse' },
  { name: 'Paris Central Server Farm', city: 'Paris', bu: 'Corporate Office' },
  { name: 'Hong Kong Fiber Gateway', city: 'Hong Kong', bu: 'Others' },
  { name: 'Dubai Enterprise Hub', city: 'Dubai', bu: 'Corporate Office' },
  { name: 'San Francisco Silicon Hub', city: 'San Francisco', bu: 'Corporate Office' },
];

export const FetchIncidentModal: React.FC = () => {
  const { isFetchModalOpen, setFetchModalOpen, triggerRefresh, addToast } = useCimStore();

  const [incidentNumberInput, setIncidentNumberInput] = useState('INC0010001');
  const [loadingFetch, setLoadingFetch] = useState(false);
  const [loadingPublish, setLoadingPublish] = useState(false);

  // ServiceNow fetched data
  const [fetchedData, setFetchedData] = useState<any>(null);
  const [fetchError, setFetchError] = useState<string | null>(null);

  // Master Sites list for multi-select
  const [availableSites, setAvailableSites] = useState<SiteItem[]>([]);
  const [selectedSiteIds, setSelectedSiteIds] = useState<string[]>([]);
  const [issueSummaryInput, setIssueSummaryInput] = useState('');
  const [teamsBridgeInput, setTeamsBridgeInput] = useState('');

  // Custom Location Creator Form state
  const [showAddCustomLocation, setShowAddCustomLocation] = useState(false);
  const [customSiteName, setCustomSiteName] = useState('');
  const [locationType, setLocationType] = useState('Corporate Office');
  const [addingSite, setAddingSite] = useState(false);

  const loadSites = async () => {
    try {
      const res = await fetch('/api/sites');
      const data = await res.json();
      if (data.success && data.sites) {
        setAvailableSites(data.sites);
      }
    } catch (e) {
      console.error('Failed to load sites:', e);
    }
  };

  useEffect(() => {
    if (isFetchModalOpen) {
      loadSites();
    }
  }, [isFetchModalOpen]);


  const handleFetchFromServiceNow = async () => {
    if (!incidentNumberInput.trim()) return;
    setLoadingFetch(true);
    setFetchError(null);
    setFetchedData(null);

    try {
      const res = await fetch('/api/servicenow/fetch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ incidentNumber: incidentNumberInput }),
      });

      const data = await res.json();
      if (data.success && data.incident) {
        setFetchedData(data.incident);
        setIssueSummaryInput(
          data.incident.issueSummary ||
            `ServiceNow Incident ${data.incident.number}: ${data.incident.shortDescription}`
        );
        setTeamsBridgeInput('');
        addToast({
          title: '✅ ServiceNow Record Ingested',
          message: `Retrieved live attributes for ${data.incident.number}`,
          type: 'update',
        });
      } else {
        setFetchError(data.error || 'Failed to fetch from ServiceNow');
      }
    } catch (err: any) {
      setFetchError(err.message || 'ServiceNow API network error');
    } finally {
      setLoadingFetch(false);
    }
  };

  const handleCreateCustomLocation = async () => {
    if (!customSiteName.trim()) {
      alert('Please enter a Location (City, State/Country).');
      return;
    }

    setAddingSite(true);

    let lat = 0;
    let lng = 0;
    let country = 'Global';
    let city = customSiteName.trim();

    try {
      // Use free Nominatim Geocoding API to resolve the exact map coordinates
      const geoRes = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(city)}`);
      const geoData = await geoRes.json();
      if (geoData && geoData.length > 0) {
        lat = parseFloat(geoData[0].lat);
        lng = parseFloat(geoData[0].lon);
        
        // Try to parse out the country if possible from display_name
        const parts = geoData[0].display_name.split(',');
        if (parts.length > 1) {
          country = parts[parts.length - 1].trim();
          city = parts[0].trim();
        }
      }
    } catch (geoErr) {
      console.warn('Geocoding failed, using defaults.', geoErr);
    }

    try {
      const res = await fetch('/api/sites', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `${customSiteName.trim()} ${locationType}`,
          city: city,
          country: country,
          lat: lat,
          lng: lng,
          businessUnit: locationType,
        }),
      });

      const data = await res.json();
      if (data.success && data.site) {
        addToast({
          title: '📍 Custom Location Created',
          message: `Created location ${data.site.name} in ${data.site.city}.`,
          type: 'update',
        });

        setAvailableSites((prev) => [...prev, data.site]);
        setSelectedSiteIds((prev) => [...prev, data.site.id]);
        setCustomSiteName('');
        setShowAddCustomLocation(false);
      }
    } catch (err) {
      alert('Failed to add custom location');
    } finally {
      setAddingSite(false);
    }
  };

  const handleToggleSite = (siteId: string) => {
    if (selectedSiteIds.includes(siteId)) {
      setSelectedSiteIds(selectedSiteIds.filter((id) => id !== siteId));
    } else {
      setSelectedSiteIds([...selectedSiteIds, siteId]);
    }
  };

  const handlePublishIncident = async () => {
    if (!fetchedData) return;
    if (selectedSiteIds.length === 0) {
      alert('Please select at least one affected location for this incident.');
      return;
    }

    setLoadingPublish(true);

    try {
      const res = await fetch('/api/incidents', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          number: fetchedData.number,
          shortDescription: fetchedData.shortDescription,
          description: fetchedData.description,
          priority: fetchedData.priority,
          status: 'INVESTIGATING',
          assignmentGroup: fetchedData.assignmentGroup,
          assignedTo: fetchedData.assignedTo,
          cmdbCi: fetchedData.cmdbCi,
          businessService: fetchedData.businessService,
          cti: fetchedData.cti,
          issueSummary: issueSummaryInput,
          teamsBridgeLink: teamsBridgeInput,
          affectedSiteIds: selectedSiteIds,
        }),
      });

      const data = await res.json();
      if (data.success) {
        addToast({
          title: '🚀 Incident Published to Command Center',
          message: `Incident ${fetchedData.number} published with ${selectedSiteIds.length} location(s) on map.`,
          type: 'p1',
        });
        triggerRefresh();
        setFetchModalOpen(false);
        setFetchedData(null);
        setSelectedSiteIds([]);
      } else {
        alert(data.error || 'Failed to publish incident');
      }
    } catch (err: any) {
      alert(err.message || 'Failed to publish incident');
    } finally {
      setLoadingPublish(false);
    }
  };

  if (!isFetchModalOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-md overflow-y-auto">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="glass-modal w-full max-w-3xl rounded-2xl border border-slate-700/80 shadow-2xl p-6 relative max-h-[90vh] flex flex-col"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-4 border-b border-slate-800">
            <div className="flex items-center space-x-3">
              <div className="p-2.5 rounded-xl bg-accent/20 border border-accent/40 text-blue-400">
                <Database className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-lg font-bold text-white">Import Live ServiceNow Incident</h2>
                <p className="text-xs text-secondaryText">
                  Query live ServiceNow REST API (dev403781) & map affected locations
                </p>
              </div>
            </div>

            <button
              onClick={() => setFetchModalOpen(false)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="py-4 space-y-5 overflow-y-auto flex-1 pr-1">
            {/* Step 1: ServiceNow Fetch Input */}
            <div className="bg-slate-900/70 p-4 rounded-xl border border-slate-800 space-y-3">
              <label className="block text-xs font-bold text-slate-300 uppercase tracking-wider">
                Enter ServiceNow Incident Number
              </label>

              <div className="flex gap-2">
                <input
                  type="text"
                  placeholder="e.g. INC0010001, INC0000060, INC0000013"
                  value={incidentNumberInput}
                  onChange={(e) => setIncidentNumberInput(e.target.value)}
                  className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-sm text-white font-mono placeholder-slate-500 focus:outline-none focus:border-accent"
                />
                <button
                  onClick={handleFetchFromServiceNow}
                  disabled={loadingFetch}
                  className="px-5 py-2 bg-gradient-to-r from-accent to-blue-600 hover:from-blue-600 hover:to-accent text-white text-xs font-bold rounded-xl shadow-glowBlue transition-all flex items-center space-x-2 disabled:opacity-50"
                >
                  {loadingFetch ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <Search className="w-4 h-4" />
                  )}
                  <span>Fetch Record</span>
                </button>
              </div>

              {fetchError && (
                <div className="p-3 bg-red-500/10 border border-red-500/30 rounded-xl text-xs text-red-400 flex items-center space-x-2">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  <span>{fetchError}</span>
                </div>
              )}
            </div>

            {/* Step 2: Auto-populated Live ServiceNow Record */}
            {fetchedData && (
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-xs text-emerald-400 flex items-center justify-between">
                  <span className="flex items-center gap-2 font-semibold">
                    <CheckCircle2 className="w-4 h-4" />
                    Fetched Live ServiceNow Attributes
                  </span>
                  <span className="font-mono text-[10px] bg-emerald-500/20 px-2 py-0.5 rounded">
                    dev403781 Synchronized
                  </span>
                </div>

                {/* ServiceNow Attributes Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 bg-slate-900/80 p-4 rounded-xl border border-slate-800 text-xs">
                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">
                      Incident #
                    </span>
                    <p className="font-mono font-bold text-white">{fetchedData.number}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">
                      Priority
                    </span>
                    <p className="font-bold text-red-400">{fetchedData.priority}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">State</span>
                    <p className="font-medium text-blue-400">{fetchedData.state}</p>
                  </div>

                  <div className="col-span-2 sm:col-span-3">
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">
                      Short Description
                    </span>
                    <p className="font-medium text-white">{fetchedData.shortDescription}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">
                      Assignment Group
                    </span>
                    <p className="text-slate-300">{fetchedData.assignmentGroup}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">
                      Assigned To
                    </span>
                    <p className="text-slate-300">{fetchedData.assignedTo}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">
                      Configuration Item
                    </span>
                    <p className="text-slate-300 font-mono text-[11px]">{fetchedData.cmdbCi}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">
                      Business Service
                    </span>
                    <p className="text-slate-300">{fetchedData.businessService}</p>
                  </div>

                  <div>
                    <span className="text-[10px] font-semibold text-slate-400 uppercase">CTI</span>
                    <p className="text-slate-300 text-[11px]">{fetchedData.cti}</p>
                  </div>
                </div>

                {/* Step 3: Location Assignment Prompt & Custom Location Creator */}
                <div className="p-4 bg-blue-950/40 border border-blue-800/60 rounded-xl space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center space-x-2 text-xs font-bold text-blue-300 uppercase tracking-wider">
                      <MapPin className="w-4 h-4 text-red-400 animate-pulse" />
                      <span>Assign Affected Location(s) for Outage Map</span>
                    </div>

                    <button
                      type="button"
                      onClick={() => setShowAddCustomLocation(!showAddCustomLocation)}
                      className="px-2.5 py-1 bg-blue-500/20 hover:bg-blue-500/30 text-blue-300 border border-blue-500/40 rounded-lg text-xs font-semibold flex items-center space-x-1 transition-colors"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Custom Location</span>
                    </button>
                  </div>

                  {/* Add Custom Location Form Drawer with Autocomplete Suggestions */}
                  {showAddCustomLocation && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="p-3.5 bg-slate-900 border border-slate-800 rounded-xl space-y-3 text-xs relative"
                    >
                      <span className="font-bold text-white flex items-center gap-1.5">
                        <Building className="w-4 h-4 text-blue-400" />
                        Create Custom Facility/Site Location (With Autocomplete Suggestions)
                      </span>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 relative">
                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1 font-semibold">
                            1. Location (City, State/Country)
                          </label>
                          <input
                            type="text"
                            placeholder="Type e.g. Revel, France..."
                            value={customSiteName}
                            onChange={(e) => setCustomSiteName(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-accent"
                          />
                        </div>

                        <div>
                          <label className="block text-[10px] text-slate-400 mb-1 font-semibold">
                            2. Type (Plant / Corporate Office / Warehouse / Others)
                          </label>
                          <select
                            value={locationType}
                            onChange={(e) => setLocationType(e.target.value)}
                            className="w-full bg-slate-800 border border-slate-700 rounded-lg p-2 text-xs text-white focus:outline-none focus:border-accent"
                          >
                            <option value="Plant">Plant</option>
                            <option value="Corporate Office">Corporate Office</option>
                            <option value="Warehouse">Warehouse</option>
                            <option value="Others">Others</option>
                          </select>
                        </div>
                      </div>

                      <div className="flex justify-end space-x-2 pt-1">
                        <button
                          type="button"
                          onClick={() => setShowAddCustomLocation(false)}
                          className="px-3 py-1 bg-slate-800 text-slate-400 rounded-md text-[11px]"
                        >
                          Cancel
                        </button>
                        <button
                          type="button"
                          onClick={handleCreateCustomLocation}
                          disabled={addingSite}
                          className="px-3 py-1 bg-accent text-white rounded-md text-[11px] font-bold flex items-center space-x-1 shadow-glowBlue"
                        >
                          {addingSite && <Loader2 className="w-3 h-3 animate-spin" />}
                          <span>Save Location & Tag</span>
                        </button>
                      </div>
                    </motion.div>
                  )}

                  {/* Locations Checkbox Grid */}
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1 max-h-48 overflow-y-auto pr-1">
                    {availableSites.map((site) => {
                      const isSelected = selectedSiteIds.includes(site.id);
                      return (
                        <button
                          type="button"
                          key={site.id}
                          onClick={() => handleToggleSite(site.id)}
                          className={`p-2.5 rounded-xl border text-left text-xs transition-all flex items-center justify-between ${
                            isSelected
                              ? 'bg-red-500/20 border-red-500/50 text-red-300 font-bold shadow-glowRed'
                              : 'bg-slate-900 border-slate-800 text-slate-400 hover:border-slate-700'
                          }`}
                        >
                          <div>
                            <p className="truncate font-semibold">{site.name}</p>
                            <span className="text-[10px] opacity-70">{site.city}</span>
                          </div>
                          {isSelected && <CheckCircle2 className="w-4 h-4 text-red-400 flex-shrink-0" />}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Additional Briefing & Bridge */}
                <div className="space-y-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1">
                      Issue Summary & Briefing
                    </label>
                    <textarea
                      rows={2}
                      value={issueSummaryInput}
                      onChange={(e) => setIssueSummaryInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl p-3 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-accent"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-300 mb-1 flex items-center gap-1.5">
                      <Radio className="w-3.5 h-3.5 text-purple-400" />
                      Microsoft Teams Command Bridge URL
                    </label>
                    <input
                      type="text"
                      value={teamsBridgeInput}
                      onChange={(e) => setTeamsBridgeInput(e.target.value)}
                      placeholder="Auto-generated via Graph API upon adding incident..."
                      className="w-full bg-slate-900 border border-slate-800 rounded-xl px-4 py-2 text-xs text-purple-300 font-mono focus:outline-none focus:border-purple-500"
                    />
                  </div>
                </div>
              </motion.div>
            )}
          </div>

          {/* Footer Actions */}
          <div className="pt-4 border-t border-slate-800 flex items-center justify-end space-x-3">
            <button
              onClick={() => setFetchModalOpen(false)}
              className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold rounded-xl transition-colors"
            >
              Cancel
            </button>

            {fetchedData && (
              <button
                onClick={handlePublishIncident}
                disabled={loadingPublish}
                className="px-6 py-2 bg-gradient-to-r from-red-600 to-accent hover:from-red-500 hover:to-blue-500 text-white text-xs font-bold rounded-xl shadow-glowRed transition-all flex items-center space-x-2 disabled:opacity-50"
              >
                {loadingPublish ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <ShieldAlert className="w-4 h-4" />
                )}
                <span>Publish to Command Center & Map</span>
              </button>
            )}
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
