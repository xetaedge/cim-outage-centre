'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { Globe, MapPin, Sparkles, Layers } from 'lucide-react';
import { useCimStore } from '@/store/useCimStore';

interface IncidentInfo {
  id: string;
  number: string;
  priority: string;
  status: string;
  assignmentGroup: string;
  summary: string;
  shortDescription: string;
}

interface SiteMapData {
  id: string;
  name: string;
  code: string;
  country: string;
  city: string;
  lat: number;
  lng: number;
  businessUnit: string;
  status: string; // HEALTHY, WARNING, IMPACTED
  usersImpacted: number;
  incidents: IncidentInfo[];
}

// Leaflet map component with dynamic loading for SSR safety
const MapComponent = dynamic(
  () =>
    import('react-leaflet').then((mod) => {
      const { MapContainer, TileLayer, Marker, Popup } = mod;
      const L = require('leaflet');

      const createCustomIcon = (status: string) => {
        let className = 'marker-pulse-green';
        if (status === 'IMPACTED') className = 'marker-pulse-red';
        else if (status === 'WARNING') className = 'marker-pulse-orange';

        return L.divIcon({
          className: 'custom-map-icon',
          html: `<div class="${className}"></div>`,
          iconSize: [18, 18],
          iconAnchor: [9, 9],
        });
      };

      const IncidentPopupItem = ({ inc }: { inc: IncidentInfo }) => {
        const [isExpanded, setIsExpanded] = useState(false);
        const MAX_LENGTH = 100;
        const needsExpansion = inc.summary.length > MAX_LENGTH;
        const displaySummary = isExpanded || !needsExpansion ? inc.summary : inc.summary.slice(0, MAX_LENGTH) + '...';

        return (
          <div className="bg-slate-900/80 p-2 rounded-xl border border-slate-800 space-y-1.5 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="font-mono font-bold text-yellow-400 text-[11px]">
                {inc.number} ({inc.priority})
              </span>
              <span className="text-[9px] bg-slate-800 px-1.5 py-0.5 rounded text-blue-300 font-medium truncate max-w-[130px]">
                {inc.assignmentGroup}
              </span>
            </div>
            
            {inc.shortDescription && (
              <p className="text-[11px] text-white font-semibold leading-tight">
                {inc.shortDescription}
              </p>
            )}

            {/* AI Summary Box */}
            <div className="bg-blue-950/40 p-2 rounded-lg border border-blue-800/50 space-y-1">
              <div className="flex items-center space-x-1 text-[9px] font-bold text-yellow-400 uppercase tracking-wider">
                <Sparkles className="w-2.5 h-2.5 text-yellow-400 animate-pulse flex-shrink-0" />
                <span>AI Briefing (Plain English)</span>
              </div>
              <p className="text-[10px] text-slate-200 leading-snug italic">
                "{displaySummary}"
              </p>
              {needsExpansion && (
                <button
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="text-[9px] font-bold text-blue-400 hover:text-blue-300 focus:outline-none"
                >
                  {isExpanded ? 'Show Less' : 'Read More'}
                </button>
              )}
            </div>

            <Link
              href={`/incidents/${inc.id}`}
              className="block w-full py-1 text-center bg-accent/80 hover:bg-accent text-white font-bold rounded-md text-[11px] transition-colors shadow-sm"
            >
              Open Details
            </Link>
          </div>
        );
      };

      const Component = ({ sites, mapTheme = 'dark' }: { sites: SiteMapData[]; mapTheme?: string }) => {
        return (
          <MapContainer
            center={[25, 10]}
            zoom={2}
            scrollWheelZoom={false}
            className="w-full h-full min-h-[360px] rounded-xl z-0"
          >
            {mapTheme === 'satellite' ? (
              <TileLayer
                attribution='&copy; <a href="https://www.esri.com/">Esri</a>, Maxar, Earthstar Geographics'
                url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
                maxZoom={18}
              />
            ) : mapTheme === 'osm' ? (
              <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
              />
            ) : (
              <>
                {/* Esri World Dark Gray Base Map — 100% Free & No API Key Required */}
                <TileLayer
                  attribution='&copy; <a href="https://www.esri.com/">Esri</a> &mdash; Esri, DeLorme, NAVTEQ'
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Base/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={16}
                />
                {/* Boundaries & Labels Reference Layer */}
                <TileLayer
                  url="https://server.arcgisonline.com/ArcGIS/rest/services/Canvas/World_Dark_Gray_Reference/MapServer/tile/{z}/{y}/{x}"
                  maxZoom={16}
                />
              </>
            )}

            {sites.map((site) => (
              <Marker
                key={site.id}
                position={[site.lat, site.lng]}
                icon={createCustomIcon(site.status)}
              >
                <Popup className="leaflet-popup-dark">
                  <div className="p-2.5 min-w-[280px] max-w-[340px] text-xs space-y-2.5">
                    {/* Popup Header */}
                    <div className="flex items-center justify-between border-b border-slate-700 pb-2 gap-2">
                      <h4 className="font-bold text-white text-[13px] flex items-start gap-1.5 leading-snug break-words">
                        <MapPin className="w-3.5 h-3.5 text-accent flex-shrink-0 mt-0.5" />
                        <span>{site.name}</span>
                      </h4>
                      <span
                        className={`px-2 py-0.5 text-[10px] font-bold rounded-full border flex-shrink-0 ${
                          site.status === 'IMPACTED'
                            ? 'bg-red-500/20 text-red-400 border-red-500/40 animate-pulse'
                            : site.status === 'WARNING'
                            ? 'bg-orange-500/20 text-orange-400 border-orange-500/40'
                            : 'bg-emerald-500/20 text-emerald-400 border-emerald-500/40'
                        }`}
                      >
                        {site.incidents.length} {site.incidents.length === 1 ? 'Incident' : 'Incidents'}
                      </span>
                    </div>

                    {/* List of ALL Incidents at this Location */}
                    <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                      {site.incidents.map((inc) => (
                        <IncidentPopupItem key={inc.id} inc={inc} />
                      ))}
                    </div>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>
        );
      };
      return Component;
    }),
  { ssr: false }
);

export const OutageMap: React.FC = () => {
  const { refreshTrigger } = useCimStore();
  const [activeOutageSites, setActiveOutageSites] = useState<SiteMapData[]>([]);
  const [mapTheme, setMapTheme] = useState<'dark' | 'satellite' | 'osm'>('dark');

  const fetchActiveOutageLocations = async () => {
    try {
      const res = await fetch('/api/incidents');
      const data = await res.json();

      if (data.success && data.incidents) {
        // Filter ONLY unclosed incidents (status != CLOSED)
        const unclosedIncidents = data.incidents.filter((i: any) => i.status !== 'CLOSED');

        const locationMap = new Map<string, SiteMapData>();

        unclosedIncidents.forEach((inc: any) => {
          if (inc.sites) {
            inc.sites.forEach((siteRel: any) => {
              const s = siteRel.site;
              if (s) {
                const lat = typeof s.lat === 'number' ? s.lat : 41.8781;
                const lng = typeof s.lng === 'number' ? s.lng : -87.6298;
                const coordKey = `${lat.toFixed(4)}_${lng.toFixed(4)}`;

                // Cumulative AI summary synthesis from updates history
                const updatesSummary = inc.updates && inc.updates.length > 0
                  ? `Collaborated Updates (${inc.updates.length}): ${inc.updates.map((u: any) => u.comment).join(' | ')}`
                  : inc.aiCurrentStatusSummary || inc.issueSummary || 'Active incident undergoing investigation';

                const incInfo: IncidentInfo = {
                  id: inc.id,
                  number: inc.number,
                  priority: inc.priority,
                  status: inc.status,
                  assignmentGroup: inc.assignmentGroup || 'Global Support',
                  summary: inc.aiCurrentStatusSummary || updatesSummary,
                  shortDescription: inc.shortDescription || 'No description provided',
                };

                if (!locationMap.has(coordKey)) {
                  locationMap.set(coordKey, {
                    id: s.id,
                    name: s.name,
                    code: s.code,
                    country: s.country || 'Global',
                    city: s.city || 'Global Hub',
                    lat,
                    lng,
                    businessUnit: s.businessUnit || 'Operations',
                    status: inc.priority === 'P1' ? 'IMPACTED' : 'WARNING',
                    usersImpacted: s.usersImpacted || 12400,
                    incidents: [incInfo],
                  });
                } else {
                  const existing = locationMap.get(coordKey)!;
                  if (!existing.incidents.some((i) => i.id === inc.id)) {
                    existing.incidents.push(incInfo);
                  }
                  if (inc.priority === 'P1') {
                    existing.status = 'IMPACTED';
                  }
                  existing.usersImpacted = (existing.usersImpacted || 0) + (s.usersImpacted || 0);
                  if (!existing.name.includes(s.name)) {
                    existing.name += ` / ${s.name}`;
                  }
                }
              }
            });
          }
        });

        setActiveOutageSites(Array.from(locationMap.values()));
      }
    } catch (e) {
      console.error('Failed to load active outage locations for map:', e);
    }
  };

  useEffect(() => {
    fetchActiveOutageLocations();
  }, [refreshTrigger]);

  const totalIncidentsTagged = activeOutageSites.reduce((acc, s) => acc + s.incidents.length, 0);

  return (
    <div className="glass-card p-5 border border-slate-800 space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 rounded-xl bg-blue-500/10 text-blue-400 border border-blue-500/30">
            <Globe className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-bold text-white flex items-center gap-2">
              Global Active Outages Map
              <span className="px-2 py-0.5 text-[10px] bg-yellow-400/20 text-yellow-300 border border-yellow-400/30 rounded-full flex items-center gap-1 font-semibold">
                <Sparkles className="w-3 h-3 text-yellow-400" />
                Cumulative AI Briefings
              </span>
            </h2>
            <p className="text-xs text-secondaryText">
              Displays ONLY active unclosed incident locations with cumulative updates synthesis
            </p>
          </div>
        </div>

        {/* Layer Switcher & Legend */}
        <div className="flex items-center space-x-3 text-xs font-semibold flex-wrap gap-y-2">
          {/* Layer Selector */}
          <div className="flex items-center bg-slate-900 border border-slate-700/60 rounded-lg p-0.5 space-x-0.5">
            <button
              onClick={() => setMapTheme('dark')}
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                mapTheme === 'dark' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Dark Ops
            </button>
            <button
              onClick={() => setMapTheme('satellite')}
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                mapTheme === 'satellite' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Satellite
            </button>
            <button
              onClick={() => setMapTheme('osm')}
              className={`px-2 py-1 rounded-md text-[11px] font-bold transition-all ${
                mapTheme === 'osm' ? 'bg-blue-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'
              }`}
            >
              Street
            </button>
          </div>

          <div className="hidden md:block h-4 w-px bg-slate-700/60" />

          {/* Legend */}
          <div className="hidden sm:flex items-center space-x-3">
            <div className="flex items-center space-x-1.5">
              <span className="w-2.5 h-2.5 rounded-full bg-orange-400" />
              <span className="text-slate-300">P2 Warning</span>
            </div>

            <div className="flex items-center space-x-1.5">
              <span className="w-3 h-3 rounded-full bg-red-500 animate-pulse" />
              <span className="text-red-400">P1 Critical</span>
            </div>
          </div>
        </div>
      </div>

      {/* Map Container */}
      <div className="h-[380px] w-full rounded-xl overflow-hidden border border-slate-800 relative shadow-2xl">
        {activeOutageSites.length === 0 ? (
          <div className="w-full h-full flex flex-col items-center justify-center bg-slate-900/90 text-center space-y-2 p-6">
            <Globe className="w-10 h-10 text-emerald-400" />
            <h3 className="text-sm font-bold text-white">No Active Unclosed Outages</h3>
            <p className="text-xs text-slate-400 max-w-sm">
              All ongoing incidents have been resolved or closed. Map displays active unclosed outage pins dynamically when incidents are published.
            </p>
          </div>
        ) : (
          <MapComponent sites={activeOutageSites} mapTheme={mapTheme} />
        )}
      </div>
    </div>
  );
};
