const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting Clean Database Seeding (Zero Mock Incidents)...');

  // Clear existing records cleanly
  await prisma.incidentUpdate.deleteMany();
  await prisma.incidentSite.deleteMany();
  await prisma.incident.deleteMany();
  await prisma.auditLog.deleteMany();
  await prisma.systemSetting.deleteMany();
  await prisma.user.deleteMany();

  // Create Users
  const passwordHash = await bcrypt.hash('admin123', 10);

  const admin = await prisma.user.create({
    data: {
      name: 'Sarah Connor',
      email: 'admin@cim.corp',
      role: 'ADMIN',
      passwordHash,
    },
  });

  const manager = await prisma.user.create({
    data: {
      name: 'Alex Vance',
      email: 'manager@cim.corp',
      role: 'INCIDENT_MANAGER',
      passwordHash,
    },
  });

  const guest = await prisma.user.create({
    data: {
      name: 'Executive Viewer',
      email: 'guest@cim.corp',
      role: 'GUEST',
      passwordHash,
    },
  });

  console.log('✅ Users Created: Admin, Incident Manager, Guest');

  // Create System Settings with Live ServiceNow Instance Credentials
  await prisma.systemSetting.createMany({
    data: [
      { key: 'SERVICENOW_INSTANCE_URL', value: 'https://dev403781.service-now.com', encrypted: false },
      { key: 'SERVICENOW_USERNAME', value: 'admin', encrypted: false },
      { key: 'SERVICENOW_PASSWORD', value: 'VK0oo6l+YbZ=', encrypted: true },
      { key: 'TEAMS_WEBHOOK_URL', value: 'https://outlook.office.com/webhook/cim-incidents', encrypted: false },
      { key: 'AI_SUMMARY_MODEL', value: 'gpt-4o-mini', encrypted: false },
    ],
  });

  console.log('✅ System Settings Initialized with Live ServiceNow Credentials');

  // Create Base Sites (Healthy Status initially, no active outages until user adds/fetches incidents)
  await prisma.site.deleteMany();
  await prisma.site.createMany({
    data: [
      { name: 'Chicago Data Center', code: 'CHI-01', country: 'United States', city: 'Chicago', lat: 41.8781, lng: -87.6298, businessUnit: 'Cloud Operations', status: 'HEALTHY', usersImpacted: 0 },
      { name: 'London Financial Hub', code: 'LON-02', country: 'United Kingdom', city: 'London', lat: 51.5074, lng: -0.1278, businessUnit: 'EMEA Banking', status: 'HEALTHY', usersImpacted: 0 },
      { name: 'Tokyo Tech Gateway', code: 'TYO-03', country: 'Japan', city: 'Tokyo', lat: 35.6762, lng: 139.6503, businessUnit: 'APAC Operations', status: 'HEALTHY', usersImpacted: 0 },
      { name: 'New York Data Center', code: 'NYC-01', country: 'United States', city: 'New York', lat: 40.7128, lng: -74.006, businessUnit: 'Trading Systems', status: 'HEALTHY', usersImpacted: 0 },
      { name: 'Frankfurt Equinix Campus', code: 'FRA-01', country: 'Germany', city: 'Frankfurt', lat: 50.1109, lng: 8.6821, businessUnit: 'EU Gateway', status: 'HEALTHY', usersImpacted: 0 },
      { name: 'Singapore Tech Hub', code: 'SIN-01', country: 'Singapore', city: 'Singapore', lat: 1.3521, lng: 103.8198, businessUnit: 'APAC Engineering', status: 'HEALTHY', usersImpacted: 0 },
    ],
  });

  console.log('✅ Base Geographic Locations Initialized with HEALTHY status');

  // Add Initial Sample Historical Incidents for AI Solutions Knowledge Base (Source C)
  await prisma.historicalIncident.deleteMany();
  await prisma.historicalIncident.createMany({
    data: [
      {
        number: 'HIST-INC-001',
        title: 'Database Connection Pool Exhaustion on MySQL SAN Cluster',
        category: 'Database / Hardware',
        rootCause: 'Max connection limit exceeded during unindexed query spike.',
        resolutionNotes: 'Increased max_connections to 2000, added composite index on user_id, and restarted connection pooler poolboy service.',
        assignmentGroup: 'Database Administration',
      },
      {
        number: 'HIST-INC-002',
        title: 'BGP Route Flapping on Slough Core Edge Routers',
        category: 'Network / BGP',
        rootCause: 'Fiber optic degradation on primary trans-Atlantic line causing packet loss.',
        resolutionNotes: 'Rerouted BGP AS path through Frankfurt peer, replaced SFP+ transceiver on interface eth0/2.',
        assignmentGroup: 'Global Network Operations',
      },
      {
        number: 'HIST-INC-003',
        title: 'SSO OAuth Token Service Out-of-Memory Crash',
        category: 'Identity / Auth',
        rootCause: 'Redis token cache eviction policy set to noeviction.',
        resolutionNotes: 'Updated Redis memory policy to volatile-lru, purged expired refreshToken keys, scaled deployment to 6 replicas.',
        assignmentGroup: 'Identity & Access Engineering',
      },
    ],
  });

  console.log('✅ Historical Knowledge Base Seeded for AI Solutions Engine');
  console.log('🚀 Zero Mock Active Incidents! System ready for user ServiceNow imports.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
