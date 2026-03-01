/**
 * Login Page — SEA Admin 登录页
 * 设计风格：深色战术面板，与整体主题一致
 */

import { useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { toast } from "sonner";

export default function Login() {
  const { login } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username || !password) {
      toast.error("请输入账号和密码");
      return;
    }
    setLoading(true);
    try {
      const ok = await login(username, password);
      if (!ok) {
        toast.error("账号或密码错误");
      }
    } catch {
      toast.error("登录失败，请重试");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center"
      style={{ background: "oklch(0.10 0.015 250)" }}
    >
      {/* 背景网格纹理 */}
      <div
        className="absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            "linear-gradient(oklch(0.7 0.1 250) 1px, transparent 1px), linear-gradient(90deg, oklch(0.7 0.1 250) 1px, transparent 1px)",
          backgroundSize: "40px 40px",
        }}
      />

      <div className="relative z-10 w-full max-w-sm px-6">
        {/* Logo 区域 */}
        <div className="mb-8 text-center">
          <div
            className="inline-flex items-center gap-2 mb-3 px-3 py-1.5 rounded text-xs font-mono tracking-widest"
            style={{
              background: "oklch(0.17 0.015 250)",
              border: "1px solid oklch(0.28 0.04 250)",
              color: "oklch(0.65 0.15 250)",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full animate-pulse"
              style={{ background: "oklch(0.65 0.25 145)" }}
            />
            SEA SYSTEM
          </div>
          <h1
            className="text-2xl font-bold tracking-tight"
            style={{ color: "oklch(0.92 0.005 250)", fontFamily: "'DM Sans', sans-serif" }}
          >
            管理后台
          </h1>
          <p className="mt-1 text-sm" style={{ color: "oklch(0.55 0.01 250)" }}>
            Sports Emotion Arbitrage
          </p>
        </div>

        {/* 登录卡片 */}
        <div
          className="rounded-xl p-6"
          style={{
            background: "oklch(0.14 0.015 250)",
            border: "1px solid oklch(0.22 0.02 250)",
            boxShadow: "0 0 40px oklch(0.3 0.08 250 / 0.15)",
          }}
        >
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="username"
                className="text-xs font-mono tracking-wider uppercase"
                style={{ color: "oklch(0.55 0.01 250)" }}
              >
                账号
              </Label>
              <Input
                id="username"
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="username"
                autoComplete="username"
                disabled={loading}
                className="font-mono"
                style={{
                  background: "oklch(0.10 0.015 250)",
                  border: "1px solid oklch(0.25 0.02 250)",
                  color: "oklch(0.92 0.005 250)",
                }}
              />
            </div>

            <div className="space-y-1.5">
              <Label
                htmlFor="password"
                className="text-xs font-mono tracking-wider uppercase"
                style={{ color: "oklch(0.55 0.01 250)" }}
              >
                密码
              </Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                disabled={loading}
                className="font-mono"
                style={{
                  background: "oklch(0.10 0.015 250)",
                  border: "1px solid oklch(0.25 0.02 250)",
                  color: "oklch(0.92 0.005 250)",
                }}
              />
            </div>

            <Button
              type="submit"
              className="w-full font-mono tracking-wider mt-2"
              disabled={loading}
              style={{
                background: loading
                  ? "oklch(0.25 0.04 250)"
                  : "oklch(0.45 0.18 250)",
                color: "oklch(0.95 0.005 250)",
                border: "none",
              }}
            >
              {loading ? (
                <span className="flex items-center gap-2">
                  <span
                    className="w-3.5 h-3.5 rounded-full border-2 border-t-transparent animate-spin"
                    style={{ borderColor: "oklch(0.7 0.1 250)", borderTopColor: "transparent" }}
                  />
                  验证中...
                </span>
              ) : (
                "登 录"
              )}
            </Button>
          </form>
        </div>

        <p
          className="mt-6 text-center text-xs font-mono"
          style={{ color: "oklch(0.35 0.01 250)" }}
        >
          SEA v5.9.9 · NBA情绪套利系统
        </p>
      </div>
    </div>
  );
}
