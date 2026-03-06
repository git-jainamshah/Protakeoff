import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Seeding ProTakeOff demo data...');

  // Check if admin already exists
  const existing = await prisma.user.findUnique({ where: { email: 'admin@protakeoff.dev' } });
  if (existing) {
    console.log('✔  Demo admin already exists — skipping seed');
    return;
  }

  // Create company
  const company = await prisma.company.create({
    data: {
      name: 'ProTakeOff Demo',
      plan: 'enterprise',
      website: 'https://protakeoff.dev',
    },
  });

  // Create super admin
  const admin = await prisma.user.create({
    data: {
      name: 'ProTakeOff Admin',
      email: 'admin@protakeoff.dev',
      password: await bcrypt.hash('ProTakeOff@2026', 12),
      role: 'SUPER_ADMIN',
      companyId: company.id,
    },
  });

  // Create sample project
  const project = await prisma.project.create({
    data: {
      name: 'Downtown Office Complex',
      description: 'Sample project — 12-storey commercial office building',
      status: 'ACTIVE',
      address: '123 Main Street, Downtown',
      clientName: 'Acme Realty Group',
      companyId: company.id,
      createdById: admin.id,
    },
  });

  // Add admin as project member
  await prisma.projectMember.create({
    data: { projectId: project.id, userId: admin.id, role: 'ADMIN' },
  });

  console.log('');
  console.log('✔  Seeded successfully!');
  console.log('');
  console.log('   Demo Login Credentials:');
  console.log('   Email    : admin@protakeoff.dev');
  console.log('   Password : ProTakeOff@2026');
  console.log('   Role     : SUPER_ADMIN');
  console.log('');
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
