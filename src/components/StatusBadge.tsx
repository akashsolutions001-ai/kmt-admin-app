import { cn } from '@/lib/utils';

type StatusType = 'active' | 'inactive' | 'running' | 'idle' | 'reached' | 'current' | 'pending';

interface StatusBadgeProps {
  status: StatusType;
  label?: string;
  showDot?: boolean;
}

const statusConfig: Record<StatusType, { label: string; className: string }> = {
  active: { label: 'Active', className: 'status-active' },
  inactive: { label: 'Inactive', className: 'status-inactive' },
  running: { label: 'Running', className: 'status-running' },
  idle: { label: 'Idle', className: 'status-idle' },
  reached: { label: 'Reached', className: 'status-reached' },
  current: { label: 'Current', className: 'status-current' },
  pending: { label: 'Pending', className: 'status-pending' },
};

const dotColors: Record<StatusType, string> = {
  active: 'bg-success',
  inactive: 'bg-muted-foreground',
  running: 'bg-success',
  idle: 'bg-muted-foreground',
  reached: 'bg-success',
  current: 'bg-primary',
  pending: 'bg-muted-foreground',
};

export function StatusBadge({ status, label, showDot = true }: StatusBadgeProps) {
  const config = statusConfig[status];

  return (
    <span className={cn('status-badge', config.className)}>
      {showDot && (
        <span className={cn('w-2 h-2 rounded-full', dotColors[status])} />
      )}
      {label || config.label}
    </span>
  );
}
