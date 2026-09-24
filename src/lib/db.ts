import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['query'] : [],
    adapter: new PrismaPg({
      connectionString: withLibpqCompat(process.env.DATABASE_URL ?? ''),
      maxUses: 1,
    }),
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db

function withLibpqCompat(url: string): string {
  if (!url || url.includes('uselibpqcompat')) return url
  return `${url}${url.includes('?') ? '&' : '?'}uselibpqcompat=true`
}
