const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  // Check if DB already has users — if yes, skip seeding
  const userCount = await prisma.user.count();
  if (userCount > 0) {
    console.log(`✅ Database already seeded (${userCount} users found). Skipping.`);
    return;
  }

  console.log('🌱 Empty database detected. Seeding initial data...');

  const passwordHash = await bcrypt.hash('admin123', 10);

  await prisma.user.create({
    data: { name: 'Sarah Connor', email: 'admin@cim.corp', role: 'ADMIN', passwordHash },
  });
  await prisma.user.create({
    data: { name: 'Alex Vance', email: 'manager@cim.corp', role: 'INCIDENT_MANAGER', passwordHash },
  });
  await prisma.user.create({
    data: { name: 'Executive Viewer', email: 'guest@cim.corp', role: 'GUEST', passwordHash },
  });

  console.log('✅ Users Created: admin@cim.corp / manager@cim.corp / guest@cim.corp (password: admin123)');

  await prisma.systemSetting.createMany({
    data: [
      { key: 'SERVICENOW_INSTANCE_URL', value: 'https://dev403781.service-now.com', encrypted: false },
      { key: 'SERVICENOW_USERNAME', value: 'admin', encrypted: false },
      { key: 'SERVICENOW_PASSWORD', value: 'VK0oo6l+YbZ=', encrypted: true },
      { key: 'TEAMS_TENANT_ID', value: process.env.AZURE_TENANT_ID || '00550e88-11f9-4a42-b775-d0274f01576e', encrypted: false },
      { key: 'TEAMS_CLIENT_ID', value: process.env.AZURE_CLIENT_ID || 'bcb10dc2-3ef1-41f3-aa41-2f1cef152a7a', encrypted: false },
      { key: 'TEAMS_CLIENT_SECRET', value: process.env.AZURE_CLIENT_SECRET || '', encrypted: true },
      { key: 'GEMINI_API_KEY', value: process.env.GEMINI_API_KEY || '', encrypted: false },
      { key: 'AI_MODEL', value: 'gemini-flash-lite-latest', encrypted: false },
    ],
  });

  console.log('✅ System Settings seeded (ServiceNow, Azure AD, AI model)');

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

  console.log('✅ Sites seeded');

  await prisma.assignmentGroup.createMany({
    data: [
      { name: 'Database', email: 'database@xetainteractives.com' },
      { name: 'Service Desk', email: 'servicedesk@xetainteractives.com' },
      { name: 'Application Development', email: 'appdev@xetainteractives.com' },
      { name: 'Database Administration', email: 'dba@xetainteractives.com' },
      { name: 'Global Network Operations', email: 'netops@xetainteractives.com' },
      { name: 'Identity & Access Engineering', email: 'iam@xetainteractives.com' },
    ],
  });

  console.log('✅ Assignment Groups seeded');

  await prisma.historicalIncident.createMany({
    data: [
      {
        number: 'HIST-INC-001',
        title: 'Database Connection Pool Exhaustion on MySQL SAN Cluster',
        category: 'Database / Hardware',
        rootCause: 'Max connection limit exceeded during unindexed query spike.',
        resolutionNotes: 'Increased max_connections to 2000, added composite index on user_id, and restarted connection pooler.',
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
        resolutionNotes: 'Updated Redis memory policy to volatile-lru, purged expired refreshToken keys, scaled to 6 replicas.',
        assignmentGroup: 'Identity & Access Engineering',
      },
    ],
  });

  console.log('✅ Historical incidents seeded for AI analysis');
  console.log('🚀 Database ready!');
}

main()
  .catch((e) => {
    console.error('Seed error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
