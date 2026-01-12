import type { LoaderFunctionArgs } from 'react-router';
import { withAPISecureContext, getPrismaClient } from '@curvenote/scms-server';

export async function loader(args: LoaderFunctionArgs) {
  await withAPISecureContext(args);
  const { keyName } = args.params;
  const prisma = await getPrismaClient();
  const count = await prisma.work.count({ where: { key: keyName } });
  if (count === 0) return Response.json({ exists: false });
  return Response.json({ exists: true });
}
