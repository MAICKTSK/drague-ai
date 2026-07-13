import { PrismaClient } from "@prisma/client";

// Une seule instance Prisma partagée dans toute l'application
export const prisma = new PrismaClient();
