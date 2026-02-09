interface Props {
  status: string;
  size?: 'sm' | 'md';
}

const STATUS_MAP: Record<string, string> = {
  PREPARED: 'badge-yellow',
  BUILDING: 'badge-yellow',
  CONFIRMED: 'badge-green',
  REFUSED: 'badge-neutral',
  FAILED: 'badge-red',
  EXPIRED: 'badge-neutral',
  PENDING: 'badge-yellow',
  SUCCESS: 'badge-green',
};

export default function StatusBadge({ status, size = 'sm' }: Props) {
  const cls = STATUS_MAP[status] || 'badge-neutral';
  return (
    <span className={`${cls} ${size === 'sm' ? 'text-[10px] px-2' : ''}`}>
      {status}
    </span>
  );
}
