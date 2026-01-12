// eslint-disable-next-line import/no-extraneous-dependencies
import { describe, test, expect, beforeAll } from 'vitest';
import { PrismaClient } from '@prisma/client';

describe('Database Connectivity', () => {
  let prisma: PrismaClient;

  beforeAll(() => {
    prisma = new PrismaClient({
      datasources: {
        db: {
          url: process.env.DATABASE_URL,
        },
      },
    });
  });

  test('should connect to the database and perform a basic query', async () => {
    try {
      // Attempt to connect to the database
      await prisma.$connect();

      // Perform a simple query to verify we can read from the database
      const result = await prisma.$queryRaw`SELECT 1 as test`;

      // Verify the query result
      expect(result).toEqual([{ test: 1 }]);
    } catch (error) {
      // If we get here, the database connection failed
      console.error('Database connection failed:', error);
      throw new Error(
        'Failed to connect to the database. Please check your database configuration and ensure the database is running.',
      );
    } finally {
      // Always disconnect from the database
      await prisma.$disconnect();
    }
  });
});
