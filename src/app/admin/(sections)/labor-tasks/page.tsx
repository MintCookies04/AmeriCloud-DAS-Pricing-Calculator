import { prisma } from '@/lib/db';
import { LaborTasksAdminClient } from './LaborTasksAdminClient';

export default async function LaborTasksAdminPage() {
  const tasks = await prisma.laborTask.findMany({ orderBy: [{ sheet: 'asc' }, { category: 'asc' }, { key: 'asc' }] });
  return <LaborTasksAdminClient rows={tasks} />;
}
