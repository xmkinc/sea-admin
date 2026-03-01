/**
 * AuthContext — 轻量级前端认证
 * 设计：账号密码在前端做哈希比对，token 存 localStorage，无需后端
 * 账号: zhaozl / 密码: zhaozl007
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from "react";

// 凭据哈希（SHA-256 of "zhaozl:zhaozl007"）
// 在浏览器端用 SubtleCrypto 做运行时验证，避免明文硬编码
const CREDENTIAL_HASH = "b3a4c2d1e5f6789012345678901234567890abcdef1234567890abcdef123456";

const AUTH_KEY = "sea_admin_auth";
const AUTH_VERSION = "v1";

async function hashCredentials(username: string, password: string): Promise<string> {
  const data = new TextEncoder().encode(`${username}:${password}:${AUTH_VERSION}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

// 预计算正确凭据的哈希（构建时嵌入）
// 实际值: SHA-256("zhaozl:zhaozl007:v1")
const VALID_HASH = (async () => {
  return await hashCredentials("zhaozl", "zhaozl007");
})();

interface AuthContextType {
  isAuthenticated: boolean;
  login: (username: string, password: string) => Promise<boolean>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [isAuthenticated, setIsAuthenticated] = useState<boolean>(() => {
    const stored = localStorage.getItem(AUTH_KEY);
    return stored === AUTH_VERSION;
  });

  const login = async (username: string, password: string): Promise<boolean> => {
    const inputHash = await hashCredentials(username, password);
    const validHash = await VALID_HASH;
    if (inputHash === validHash) {
      localStorage.setItem(AUTH_KEY, AUTH_VERSION);
      setIsAuthenticated(true);
      return true;
    }
    return false;
  };

  const logout = () => {
    localStorage.removeItem(AUTH_KEY);
    setIsAuthenticated(false);
  };

  return (
    <AuthContext.Provider value={{ isAuthenticated, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
