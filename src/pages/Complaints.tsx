import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Check, X } from 'lucide-react';
import { Complaint, ComplaintStatus } from '@/types/admin';
import { ConfirmDialog } from '@/components/ConfirmDialog';
import { cn } from '@/lib/utils';
import { db } from '@/lib/firebase';
import { collection, getDocs, updateDoc, doc, Timestamp, query, orderBy } from 'firebase/firestore';

export default function Complaints() {
  const [complaints, setComplaints] = useState<Complaint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selected, setSelected] = useState<Complaint | null>(null);
  const [action, setAction] = useState<'resolve' | 'reject' | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'complaints'), orderBy('createdAt', 'desc')));
      setComplaints(
        snap.docs.map((d) => {
          const data = d.data() as Record<string, unknown>;
          let createdAt = new Date().toISOString();
          if (data.createdAt && typeof (data.createdAt as { toDate?: () => Date }).toDate === 'function') {
            createdAt = (data.createdAt as { toDate: () => Date }).toDate().toISOString();
          } else if (typeof data.createdAt === 'string') {
            createdAt = data.createdAt;
          }
          return { id: d.id, ...data, createdAt } as Complaint;
        })
      );
    } catch (error) {
      console.error('Error loading complaints:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const pending = complaints.filter((c) => c.status === 'pending' || c.status === 'in_review');
  const resolved = complaints.filter((c) => c.status === 'resolved' || c.status === 'rejected');

  const confirmAction = async () => {
    if (!selected || !action) return;
    try {
      await updateDoc(doc(db, 'complaints', selected.id), {
        status: (action === 'resolve' ? 'resolved' : 'rejected') as ComplaintStatus,
        updatedAt: Timestamp.now(),
      });
      setSelected(null);
      setAction(null);
      await loadData();
    } catch (error) {
      console.error('Error updating complaint:', error);
    }
  };

  const formatDate = (dateString: string) =>
    new Date(dateString).toLocaleDateString('en-IN', {
      day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });

  if (isLoading) {
    return (
      <AdminLayout title="Complaints" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Complaint Management" subtitle="Review and resolve passenger complaints">
      <div className="space-y-8">
        <section>
          <h2 className="text-lg font-semibold mb-4">Pending ({pending.length})</h2>
          {pending.length === 0 ? (
            <div className="glass-card p-8 text-center text-muted-foreground">No pending complaints</div>
          ) : (
            <div className="grid gap-4">
              {pending.map((c) => (
                <div key={c.id} className="glass-card p-4 sm:p-6">
                  <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-semibold">{c.passengerName}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-secondary/30 text-foreground">{c.category}</span>
                      </div>
                      <p className="font-medium text-sm">{c.subject}</p>
                      <p className="text-sm text-muted-foreground mt-1">{c.description}</p>
                      <p className="text-xs text-muted-foreground mt-2">{formatDate(c.createdAt)}</p>
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={() => { setSelected(c); setAction('resolve'); }}>
                        <Check className="h-4 w-4 mr-1" /> Resolve
                      </Button>
                      <Button size="sm" variant="outline" onClick={() => { setSelected(c); setAction('reject'); }}>
                        <X className="h-4 w-4 mr-1" /> Reject
                      </Button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {resolved.length > 0 && (
          <section>
            <h2 className="text-lg font-semibold mb-4">Resolved ({resolved.length})</h2>
            <div className="glass-card overflow-x-auto">
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>Passenger</th>
                    <th className="hidden sm:table-cell">Subject</th>
                    <th>Status</th>
                    <th className="hidden sm:table-cell">Date</th>
                  </tr>
                </thead>
                <tbody>
                  {resolved.map((c) => (
                    <tr key={c.id}>
                      <td>{c.passengerName}</td>
                      <td className="hidden sm:table-cell truncate max-w-[200px]">{c.subject}</td>
                      <td>
                        <span className={cn('text-sm', c.status === 'resolved' ? 'text-success' : 'text-destructive')}>
                          {c.status}
                        </span>
                      </td>
                      <td className="hidden sm:table-cell text-sm text-muted-foreground">{formatDate(c.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
      </div>

      <ConfirmDialog
        open={!!selected && !!action}
        onOpenChange={() => { setSelected(null); setAction(null); }}
        title={action === 'resolve' ? 'Resolve Complaint' : 'Reject Complaint'}
        description={`Are you sure you want to ${action} this complaint from ${selected?.passengerName}?`}
        confirmLabel={action === 'resolve' ? 'Resolve' : 'Reject'}
        onConfirm={confirmAction}
      />
    </AdminLayout>
  );
}
