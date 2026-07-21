import Link from 'next/link';

export function MoveToButton({ href, label }: { href: string; label: string }) {
  return (
    <Link
      href={href}
      className="inline-block bg-red hover:bg-red-700 text-white font-display font-semibold px-6 py-3 rounded transition-colors"
    >
      {label}
    </Link>
  );
}
