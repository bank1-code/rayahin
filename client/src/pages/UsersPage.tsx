/*
 * Design: Calm Luxury - إدارة المستخدمين
 * مربوط بقاعدة البيانات عبر tRPC localAuth
 */
import DashboardLayout from "@/components/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { trpc } from "@/lib/trpc";
import { Edit, Eye, EyeOff, Loader2, Plus, ShieldCheck, Trash2, User, KeyRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

export default function UsersPage() {
  const utils = trpc.useUtils();
  const { data: users = [], isLoading } = trpc.localAuth.listUsers.useQuery();

  const createMut = trpc.localAuth.createUser.useMutation({
    onSuccess: () => {
      utils.localAuth.listUsers.invalidate();
      toast.success("تم إضافة المستخدم بنجاح");
    },
    onError: (e) => toast.error(e.message),
  });

  const updateMut = trpc.localAuth.updateUser.useMutation({
    onSuccess: () => {
      utils.localAuth.listUsers.invalidate();
      toast.success("تم تعديل المستخدم بنجاح");
    },
    onError: (e) => toast.error(e.message),
  });

  const deleteMut = trpc.localAuth.deleteUser.useMutation({
    onSuccess: () => {
      utils.localAuth.listUsers.invalidate();
      toast.success("تم حذف المستخدم بنجاح");
    },
    onError: (e) => toast.error(e.message),
  });

  const [showAdd, setShowAdd] = useState(false);
  const [showEdit, setShowEdit] = useState(false);
  const [editUser, setEditUser] = useState<any>(null);
  const [showPassword, setShowPassword] = useState(false);

  // حقول الإضافة
  const [newName, setNewName] = useState("");
  const [newUsername, setNewUsername] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [newRole, setNewRole] = useState<"user" | "admin">("user");

  // حقول التعديل
  const [editName, setEditName] = useState("");
  const [editRole, setEditRole] = useState<"user" | "admin">("user");
  const [editPassword, setEditPassword] = useState("");

  const handleAdd = () => {
    if (!newName.trim()) { toast.error("يرجى إدخال الاسم"); return; }
    if (!newUsername.trim()) { toast.error("يرجى إدخال اسم المستخدم"); return; }
    if (!newPassword.trim() || newPassword.length < 4) { toast.error("كلمة المرور يجب أن تكون 4 أحرف على الأقل"); return; }
    createMut.mutate(
      { name: newName.trim(), username: newUsername.trim(), password: newPassword, role: newRole },
      { onSuccess: () => { setShowAdd(false); setNewName(""); setNewUsername(""); setNewPassword(""); setNewRole("user"); } }
    );
  };

  const handleEdit = () => {
    if (!editUser) return;
    const data: any = { id: editUser.id };
    if (editName.trim() && editName !== editUser.name) data.name = editName.trim();
    if (editRole !== editUser.role) data.role = editRole;
    if (editPassword.trim()) data.password = editPassword;
    updateMut.mutate(data, { onSuccess: () => { setShowEdit(false); setEditUser(null); setEditPassword(""); } });
  };

  const openEdit = (user: any) => {
    setEditUser(user);
    setEditName(user.name || "");
    setEditRole(user.role);
    setEditPassword("");
    setShowEdit(true);
  };

  const handleDelete = (user: any) => {
    if (confirm(`هل أنت متأكد من حذف المستخدم "${user.name || user.username}"؟`)) {
      deleteMut.mutate({ id: user.id });
    }
  };

  const getRoleLabel = (role: string) => role === "admin" ? "مسؤول النظام" : "مستخدم";
  const getRoleStyle = (role: string) => role === "admin" ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground";

  return (
    <DashboardLayout
      title="إدارة المستخدمين"
      subtitle="إدارة حسابات وصلاحيات المستخدمين"
      actions={
        <div className="flex items-center gap-2 w-full justify-end">
          <Button size="sm" className="h-8 text-xs gap-1.5" onClick={() => setShowAdd(true)}>
            <Plus className="w-3.5 h-3.5" />
            إضافة مستخدم
          </Button>
        </div>
      }
    >
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
        </div>
      ) : users.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <User className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm">لا يوجد مستخدمين محليين بعد</p>
          <p className="text-xs mt-1">اضغط "إضافة مستخدم" لإنشاء حساب جديد</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((user) => (
            <div key={user.id} className="bg-card rounded-xl border border-border p-5 shadow-[0_1px_3px_rgba(0,0,0,0.04),0_4px_12px_rgba(0,0,0,0.03)] hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-11 h-11 rounded-xl bg-primary/10 flex items-center justify-center">
                    <User className="w-5 h-5 text-primary" />
                  </div>
                  <div>
                    <h3 className="text-sm font-bold text-foreground">{user.name || "بدون اسم"}</h3>
                    <p className="text-[11px] text-muted-foreground font-mono">@{user.username}</p>
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openEdit(user)} className="w-7 h-7 rounded-md hover:bg-muted flex items-center justify-center transition-colors">
                    <Edit className="w-3.5 h-3.5 text-muted-foreground" />
                  </button>
                  <button onClick={() => handleDelete(user)} className="w-7 h-7 rounded-md hover:bg-red-50 flex items-center justify-center transition-colors">
                    <Trash2 className="w-3.5 h-3.5 text-red-400" />
                  </button>
                </div>
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-3.5 h-3.5 text-muted-foreground" />
                  <span className="text-xs text-muted-foreground">الدور:</span>
                  <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full ${getRoleStyle(user.role)}`}>
                    {getRoleLabel(user.role)}
                  </span>
                </div>
                {user.lastSignedIn && (
                  <p className="text-[11px] text-muted-foreground">
                    آخر دخول: {new Date(user.lastSignedIn).toLocaleString("ar-SA")}
                  </p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Add User Dialog */}
      <Dialog open={showAdd} onOpenChange={setShowAdd}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">إضافة مستخدم جديد</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">الاسم الكامل <span className="text-red-500">*</span></label>
              <input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="أدخل الاسم"
                className="w-full h-10 px-3 rounded-lg bg-muted/40 border border-border text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">اسم المستخدم <span className="text-red-500">*</span></label>
              <input type="text" value={newUsername} onChange={(e) => setNewUsername(e.target.value)} placeholder="أدخل اسم المستخدم"
                className="w-full h-10 px-3 rounded-lg bg-muted/40 border border-border text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">كلمة المرور <span className="text-red-500">*</span></label>
              <div className="relative">
                <input type={showPassword ? "text" : "password"} value={newPassword} onChange={(e) => setNewPassword(e.target.value)} placeholder="أدخل كلمة المرور (4 أحرف على الأقل)"
                  className="w-full h-10 px-3 pl-10 rounded-lg bg-muted/40 border border-border text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
                <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">الدور</label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as "user" | "admin")}>
                <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">مسؤول النظام</SelectItem>
                  <SelectItem value="user">مستخدم</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowAdd(false)}>إلغاء</Button>
              <Button onClick={handleAdd} disabled={createMut.isPending}>
                {createMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ المستخدم"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit User Dialog */}
      <Dialog open={showEdit} onOpenChange={setShowEdit}>
        <DialogContent className="max-w-lg" dir="rtl">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold">تعديل المستخدم</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">الاسم الكامل</label>
              <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} placeholder="أدخل الاسم"
                className="w-full h-10 px-3 rounded-lg bg-muted/40 border border-border text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground">الدور</label>
              <Select value={editRole} onValueChange={(v) => setEditRole(v as "user" | "admin")}>
                <SelectTrigger className="h-10 text-sm"><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin">مسؤول النظام</SelectItem>
                  <SelectItem value="user">مستخدم</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-foreground flex items-center gap-1.5">
                <KeyRound className="w-3.5 h-3.5" /> تغيير كلمة المرور <span className="text-muted-foreground font-normal">(اختياري)</span>
              </label>
              <input type="password" value={editPassword} onChange={(e) => setEditPassword(e.target.value)} placeholder="اتركه فارغاً للإبقاء على كلمة المرور الحالية"
                className="w-full h-10 px-3 rounded-lg bg-muted/40 border border-border text-sm placeholder:text-muted-foreground/50 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary/40 transition-all" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={() => setShowEdit(false)}>إلغاء</Button>
              <Button onClick={handleEdit} disabled={updateMut.isPending}>
                {updateMut.isPending ? <Loader2 className="w-4 h-4 animate-spin" /> : "حفظ التعديلات"}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </DashboardLayout>
  );
}
