import { prisma } from '@/lib/db';
import { MaterialsAdminClient } from './MaterialsAdminClient';

export default async function MaterialsAdminPage() {
  const materials = await prisma.materialItem.findMany({ orderBy: { key: 'asc' } });
  return <MaterialsAdminClient rows={materials} />;
}
