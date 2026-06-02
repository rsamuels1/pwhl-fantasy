/**
 * Prisma client singleton for API routes.
 * 
 * Using a singleton prevents connection pool exhaustion in Next.js.
 * See: https://www.prisma.io/docs/orm/prisma-client/setup-and-configuration/databases/connection-pool
 */

import { PrismaClient } from "@prisma/client";

const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const prisma =
  globalForPrisma.prisma ||
  new PrismaClient({
    log:
      process.env.NODE_ENV === "development"
        ? ["query", "error", "warn"]
        : ["error"],
  });

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
