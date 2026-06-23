import { useState } from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";
import { UserPlus, Wallet, Trash2 } from "lucide-react";

export function UserSelector({ users, currentUserId, onUserChange, onUsersChange }) {
  const [open, setOpen] = useState(false);
  const [newName, setNewName] = useState("");
  const [loading, setLoading] = useState(false);

  const [rechargeOpen, setRechargeOpen] = useState(false);
  const [rechargeAmount, setRechargeAmount] = useState("");
  const [rechargeLoading, setRechargeLoading] = useState(false);

  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleteLoading, setDeleteLoading] = useState(false);

  const currentUser = users.find((u) => u.id === currentUserId);

  const handleCreateUser = async (e) => {
    e.preventDefault();
    if (!newName.trim()) {
      toast.error("请输入用户名");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/users", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: newName.trim() }),
      });

      if (res.status === 409) {
        toast.error("用户名已存在");
        return;
      }
      if (!res.ok) throw new Error("创建失败");

      const user = await res.json();
      toast.success(`用户 "${user.name}" 已创建，初始余额 ¥1000`);
      setNewName("");
      setOpen(false);
      onUsersChange();
      onUserChange(user.id);
    } catch {
      toast.error("创建用户失败");
    } finally {
      setLoading(false);
    }
  };

  const handleRecharge = async (e) => {
    e.preventDefault();
    if (!currentUserId || !rechargeAmount) {
      toast.error("请选择用户并输入金额");
      return;
    }

    const amount = Number(rechargeAmount);
    if (isNaN(amount) || amount === 0) {
      toast.error("请输入有效金额");
      return;
    }

    setRechargeLoading(true);
    try {
      const user = users.find((u) => u.id === currentUserId);
      if (!user) throw new Error("用户不存在");

      const newBalance = user.balance + amount;
      const res = await fetch("/api/users", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: currentUserId, balance: newBalance }),
      });

      if (!res.ok) throw new Error("充值失败");

      const updated = await res.json();
      toast.success(
        amount > 0
          ? `充值成功，当前余额: ¥${updated.balance.toFixed(2)}`
          : `扣款成功，当前余额: ¥${updated.balance.toFixed(2)}`
      );
      setRechargeAmount("");
      setRechargeOpen(false);
      onUsersChange();
    } catch {
      toast.error("操作失败");
    } finally {
      setRechargeLoading(false);
    }
  };

  const handleDeleteUser = async () => {
    if (!currentUserId) {
      toast.error("请先选择要删除的用户");
      return;
    }
    if (users.length <= 1) {
      toast.error("至少需要保留一个用户");
      setDeleteOpen(false);
      return;
    }

    setDeleteLoading(true);
    try {
      const res = await fetch(`/api/users/${currentUserId}`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error("删除失败");

      toast.success(`用户 "${currentUser?.name}" 及其投注记录已删除`);
      setDeleteOpen(false);
      onUserChange(null);
      onUsersChange();
    } catch {
      toast.error("删除用户失败");
    } finally {
      setDeleteLoading(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center gap-2">
        <select
          value={currentUserId ?? ""}
          onChange={(e) => {
            const val = e.target.value;
            onUserChange(val === "" ? null : Number(val));
          }}
          className="h-9 rounded-md border border-input bg-white px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring flex-1 min-w-0"
        >
          <option value="">全部用户</option>
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.name} (¥{u.balance.toFixed(0)})
            </option>
          ))}
        </select>

        <div className="md:hidden flex items-center gap-1 text-sm text-gray-600 bg-gray-100 px-2 py-1 rounded-md whitespace-nowrap">
          <Wallet className="h-3.5 w-3.5" />
          <span>¥{currentUser?.balance.toFixed(2) ?? "0.00"}</span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {currentUserId && (
          <Dialog open={rechargeOpen} onOpenChange={setRechargeOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1">
                <Wallet className="h-4 w-4" />
                <span className="hidden sm:inline">充值</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[360px] max-w-[92vw] rounded-lg">
              <DialogHeader>
                <DialogTitle>调整余额</DialogTitle>
              </DialogHeader>
              <form onSubmit={handleRecharge} className="space-y-4 pt-2">
                <div className="text-sm text-gray-500">
                  当前用户: <span className="font-medium text-gray-900">{currentUser?.name ?? "未选择"}</span>
                  <br />
                  当前余额: <span className="font-medium text-gray-900">¥{currentUser?.balance.toFixed(2) ?? "0.00"}</span>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="rechargeAmount">金额（正数为充值，负数为扣款）</Label>
                  <Input
                    id="rechargeAmount"
                    type="number"
                    step="0.01"
                    placeholder="如: 500 或 -200"
                    value={rechargeAmount}
                    onChange={(e) => setRechargeAmount(e.target.value)}
                    required
                  />
                </div>
                <Button type="submit" className="w-full" disabled={rechargeLoading}>
                  {rechargeLoading ? "处理中..." : "确认"}
                </Button>
              </form>
            </DialogContent>
          </Dialog>
        )}

        {currentUserId && (
          <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
            <DialogTrigger asChild>
              <Button variant="outline" size="sm" className="gap-1 text-red-600 border-red-200 hover:bg-red-50 hover:text-red-700">
                <Trash2 className="h-4 w-4" />
                <span className="hidden sm:inline">删除</span>
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[360px] max-w-[92vw] rounded-lg">
              <DialogHeader>
                <DialogTitle>确认删除用户</DialogTitle>
              </DialogHeader>
              <div className="space-y-4 pt-2">
                <p className="text-sm text-gray-600">
                  确定要删除用户 <span className="font-medium text-gray-900">"{currentUser?.name}"</span> 吗？
                </p>
                <p className="text-xs text-red-500">
                  此操作将同时删除该用户的所有投注记录，且不可恢复。
                </p>
                <div className="flex gap-2">
                  <Button variant="outline" className="flex-1" onClick={() => setDeleteOpen(false)} disabled={deleteLoading}>
                    取消
                  </Button>
                  <Button variant="destructive" className="flex-1" onClick={handleDeleteUser} disabled={deleteLoading}>
                    {deleteLoading ? "删除中..." : "确认删除"}
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
        )}

        <Dialog open={open} onOpenChange={setOpen}>
          <DialogTrigger asChild>
            <Button variant="outline" size="sm" className="gap-1">
              <UserPlus className="h-4 w-4" />
              <span className="hidden sm:inline">新增</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-[360px] max-w-[92vw] rounded-lg">
            <DialogHeader>
              <DialogTitle>新增用户</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleCreateUser} className="space-y-4 pt-2">
              <div className="space-y-2">
                <Label htmlFor="newUser">用户名</Label>
                <Input
                  id="newUser"
                  placeholder="输入用户名"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  required
                />
              </div>
              <div className="text-xs text-gray-500">
                新用户初始余额为 ¥1000
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading ? "创建中..." : "确认创建"}
              </Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
