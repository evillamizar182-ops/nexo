import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { hashPassword } from '../utils/auth';

const prisma = new PrismaClient();

const WEAK_PASSWORDS = ['admin123', 'nexo2026', 'password', '123456', 'changeme'];

async function main() {
  console.log('🌱 Seeding database...');

  // 1. Create Admin User — credentials come from the environment, never hardcoded.
  const adminEmail = process.env.ADMIN_EMAIL;
  const adminPassword = process.env.ADMIN_PASSWORD;

  if (!adminEmail || !adminPassword) {
    console.error(
      '❌ ADMIN_EMAIL and ADMIN_PASSWORD must be set before seeding.\n' +
        '   Generate a strong password with:\n' +
        '   node -e "console.log(require(\'crypto\').randomBytes(12).toString(\'base64url\'))"'
    );
    process.exit(1);
  }
  if (adminPassword.length < 12 || WEAK_PASSWORDS.includes(adminPassword.toLowerCase())) {
    console.error('❌ ADMIN_PASSWORD is too weak (min 12 chars, not a known default).');
    process.exit(1);
  }

  const hashedPassword = await hashPassword(adminPassword);

  const admin = await prisma.user.upsert({
    where: { email: adminEmail },
    update: {},
    create: {
      email: adminEmail,
      password: hashedPassword,
      name: 'Administrador Nexo',
      role: 'ADMIN',
    },
  });
  console.log(`✅ User created: ${admin.email}`);

  // 2. Create Business Config
  const business = await prisma.businessConfig.upsert({
    where: { id: 'singleton' },
    update: {},
    create: {
      id: 'singleton',
      name: 'Nexo Barbershop',
      config: JSON.stringify({
        ubicacion: 'Calle 123, Bogotá, Colombia',
        horario: { apertura: '08:00', cierre: '20:00' },
        barberos: [
          { nombre: 'Alex', activo: true },
          { nombre: 'Juan', activo: true },
          { nombre: 'Pedro', activo: true }
        ],
        servicios: {
          '1': { nombre: 'Corte de Cabello', precio: 25000, duracion_min: 30 },
          '2': { nombre: 'Barba', precio: 15000, duracion_min: 20 },
          '3': { nombre: 'Corte y Barba', precio: 35000, duracion_min: 50 }
        },
        tono: [
          'Sé muy amable y profesional.',
          'Usa un tono ejecutivo.',
          'Si el cliente duda, ofrece el servicio de Corte y Barba como la mejor opción.'
        ]
      })
    }
  });
  console.log(`✅ Business config created: ${business.name}`);

  // 3. Create Staff Members (for the tools to work)
  const staffNames = ['Alex', 'Juan', 'Pedro'];
  for (const name of staffNames) {
    await prisma.staffMember.upsert({
      where: { id: name.toLowerCase() },
      update: { name, isActive: true, role: 'BARBERO' },
      create: { id: name.toLowerCase(), name, isActive: true, role: 'BARBERO' }
    });
  }
  console.log(`✅ Staff members created: ${staffNames.join(', ')}`);

  // 4. Create Services
  const services = [
    { name: 'Corte de Cabello', price: 25000, durationMin: 30 },
    { name: 'Barba', price: 15000, durationMin: 20 },
    { name: 'Corte y Barba', price: 35000, durationMin: 50 }
  ];
  for (const s of services) {
    await prisma.service.create({
      data: { ...s, isActive: true }
    });
  }
  console.log('✅ Services created');

  // 5. Create Products
  const products = [
    { name: 'Pomada Mate', price: 45000, stock: 15 },
    { name: 'Aceite para Barba', price: 35000, stock: 8 },
    { name: 'Cera Brillante', price: 40000, stock: 0 }
  ];
  for (const p of products) {
    await prisma.product.create({
      data: { ...p, isActive: true }
    });
  }
  console.log('✅ Products created');


  console.log('🚀 Seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
