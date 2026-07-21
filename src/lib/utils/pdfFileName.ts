// src/lib/utils/pdfFileName.ts
export function pdfFileName(client: string, project: string): string {
  const trimmedClient = client.trim();
  const trimmedProject = project.trim();
  if (trimmedClient && trimmedProject) {
    return `${trimmedClient}-${trimmedProject}-Estimate.pdf`;
  }
  const date = new Date().toISOString().slice(0, 10);
  return `Estimate-${date}.pdf`;
}
