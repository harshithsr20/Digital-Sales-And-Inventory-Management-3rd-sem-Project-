// Central Prisma Client instance used across routes and middleware
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

module.exports = prisma;

