import { useEffect, useState } from 'react';
import { AdminLayout } from '@/components/layout/AdminLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Plus } from 'lucide-react';
import { db } from '@/lib/firebase';
import { collection, getDocs, addDoc, updateDoc, doc, Timestamp, query, orderBy } from 'firebase/firestore';
import { Announcement } from '@/types/admin';
import { toast } from 'sonner';

export default function Announcements() {
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [title, setTitle] = useState('');
  const [message, setMessage] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const snap = await getDocs(query(collection(db, 'announcements'), orderBy('createdAt', 'desc')));
      setAnnouncements(
        snap.docs.map((d) => {
          const data = d.data();
          let createdAt = new Date().toISOString();
          if (data.createdAt?.toDate) createdAt = data.createdAt.toDate().toISOString();
          return { id: d.id, ...data, createdAt } as Announcement;
        })
      );
    } catch {
      setAnnouncements([]);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleCreate = async () => {
    if (!title.trim() || !message.trim()) {
      toast.error('Title and message are required');
      return;
    }
    try {
      await addDoc(collection(db, 'announcements'), {
        title: title.trim(),
        message: message.trim(),
        priority: 'normal',
        active: true,
        createdAt: Timestamp.now(),
      });
      setTitle('');
      setMessage('');
      toast.success('Announcement published');
      await loadData();
    } catch {
      toast.error('Failed to publish announcement');
    }
  };

  const toggleActive = async (a: Announcement) => {
    try {
      await updateDoc(doc(db, 'announcements', a.id), { active: !a.active });
      await loadData();
    } catch {
      toast.error('Failed to update announcement');
    }
  };

  if (isLoading) {
    return (
      <AdminLayout title="Announcements" subtitle="Loading...">
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
        </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout title="Announcements" subtitle="Service alerts and public notices">
      <div className="glass-card p-4 sm:p-6 mb-6">
        <h3 className="font-semibold mb-4">New Announcement</h3>
        <div className="space-y-4">
          <div>
            <Label htmlFor="title">Title</Label>
            <Input id="title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Service update" />
          </div>
          <div>
            <Label htmlFor="message">Message</Label>
            <Textarea id="message" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Announcement details..." rows={3} />
          </div>
          <Button onClick={handleCreate}>
            <Plus className="h-4 w-4 mr-2" /> Publish
          </Button>
        </div>
      </div>

      <div className="grid gap-4">
        {announcements.length === 0 ? (
          <div className="glass-card p-8 text-center text-muted-foreground">No announcements yet</div>
        ) : (
          announcements.map((a) => (
            <div key={a.id} className="glass-card p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{a.title}</p>
                <p className="text-sm text-muted-foreground mt-1">{a.message}</p>
              </div>
              <Button size="sm" variant={a.active ? 'outline' : 'default'} onClick={() => toggleActive(a)}>
                {a.active ? 'Deactivate' : 'Activate'}
              </Button>
            </div>
          ))
        )}
      </div>
    </AdminLayout>
  );
}
