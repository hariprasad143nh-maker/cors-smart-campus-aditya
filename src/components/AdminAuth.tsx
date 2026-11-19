import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Shield, LogIn, LogOut, Plus, Trash2, UserPlus } from 'lucide-react';
import { loginAdmin, logoutAdmin, getAdminEmails, saveAdminEmails, createAdminAccount } from '@/lib/admin-auth';
import type { User } from 'firebase/auth';

interface AdminLoginProps {
  user: User | null;
  isAdmin: boolean;
  onLogin: () => void;
  onLogout: () => void;
}

export function AdminLoginButton({ user, isAdmin, onLogin, onLogout }: AdminLoginProps) {
  const [open, setOpen] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await loginAdmin(email, password);
      setOpen(false);
      setEmail('');
      setPassword('');
      onLogin();
    } catch (e: any) {
      setError(e.message || 'Login failed');
    }
    setLoading(false);
  };

  const handleLogout = async () => {
    await logoutAdmin();
    onLogout();
  };

  if (user && isAdmin) {
    return (
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground hidden sm:inline">{user.email}</span>
        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={handleLogout}>
          <LogOut className="w-3 h-3 mr-1" /> Logout
        </Button>
      </div>
    );
  }

  return (
    <>
      <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => setOpen(true)}>
        <Shield className="w-3 h-3 mr-1" /> Admin
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Admin Login</DialogTitle>
            <DialogDescription>Sign in with your admin email to access editor features.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <Input value={email} onChange={e => setEmail(e.target.value)} placeholder="Admin email" type="email" />
            <Input value={password} onChange={e => setPassword(e.target.value)} placeholder="Password" type="password"
              onKeyDown={e => { if (e.key === 'Enter') handleLogin(); }} />
            {error && <p className="text-xs text-destructive">{error}</p>}
          </div>
          <DialogFooter>
            <Button onClick={handleLogin} disabled={loading || !email || !password}>
              <LogIn className="w-4 h-4 mr-1" /> {loading ? 'Signing in...' : 'Sign In'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

interface AdminManagerProps {
  isAdmin: boolean;
  user: User | null;
}

export function AdminManager({ isAdmin, user }: AdminManagerProps) {
  const [open, setOpen] = useState(false);
  const [emails, setEmails] = useState<string[]>([]);
  const [newEmail, setNewEmail] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');

  useEffect(() => {
    if (open) {
      getAdminEmails().then(setEmails);
      setError('');
      setInfo('');
      setCurrentPassword('');
      setNewEmail('');
    }
  }, [open]);

  const handleAdd = async () => {
    setError('');
    setInfo('');
    const email = newEmail.trim().toLowerCase();
    if (!email || emails.includes(email)) return;
    if (!user?.email) {
      setError('You must be signed in as admin.');
      return;
    }
    if (!currentPassword) {
      setError('Enter your password to authorize creating the new admin.');
      return;
    }
    setSaving(true);
    try {
      // Create Firebase Auth account with the same password as the current admin.
      await createAdminAccount(user.email, currentPassword, email);
      // Persist the email in the admin list.
      const updated = [...emails, email];
      await saveAdminEmails(updated);
      setEmails(updated);
      setNewEmail('');
      setCurrentPassword('');
      setInfo(`Admin account created for ${email} with your password.`);
    } catch (e: any) {
      const msg = e?.code === 'auth/email-already-in-use'
        ? 'An account with this email already exists in Firebase Auth. Just adding email to admin list.'
        : e?.message || 'Failed to create admin account';
      // If the auth account already exists, still grant admin rights.
      if (e?.code === 'auth/email-already-in-use') {
        const updated = [...emails, email];
        await saveAdminEmails(updated);
        setEmails(updated);
        setNewEmail('');
        setInfo(msg);
      } else {
        setError(msg);
      }
    }
    setSaving(false);
  };

  const handleRemove = async (email: string) => {
    const updated = emails.filter(e => e !== email);
    setSaving(true);
    await saveAdminEmails(updated);
    setEmails(updated);
    setSaving(false);
  };

  if (!isAdmin) return null;

  return (
    <>
      <Button size="sm" variant="ghost" className="h-7 text-xs" onClick={() => setOpen(true)}>
        <UserPlus className="w-3 h-3 mr-1" /> Manage Admins
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Manage Admin Emails</DialogTitle>
            <DialogDescription>
              New admins are created with the same password you enter below.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2 max-h-48 overflow-y-auto">
            {emails.map(e => (
              <div key={e} className="flex items-center justify-between text-sm p-2 rounded bg-muted/50">
                <span>{e}</span>
                <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleRemove(e)}>
                  <Trash2 className="w-3 h-3" />
                </Button>
              </div>
            ))}
            {emails.length === 0 && <p className="text-xs text-muted-foreground">No admin emails configured.</p>}
          </div>
          <div className="space-y-2">
            <Input
              value={newEmail}
              onChange={e => setNewEmail(e.target.value)}
              placeholder="new-admin@example.com"
              type="email"
              className="text-sm"
            />
            <Input
              value={currentPassword}
              onChange={e => setCurrentPassword(e.target.value)}
              placeholder="Your current admin password"
              type="password"
              className="text-sm"
              onKeyDown={e => { if (e.key === 'Enter') handleAdd(); }}
            />
            {error && <p className="text-xs text-destructive">{error}</p>}
            {info && <p className="text-xs text-primary">{info}</p>}
            <Button size="sm" onClick={handleAdd} disabled={saving || !newEmail || !currentPassword} className="w-full">
              <Plus className="w-3 h-3 mr-1" /> {saving ? 'Creating...' : 'Create Admin Account'}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
