/*
 * Signals — 信号列表
 * 展示来自 Turso 的历史置信度信号，支持筛选和分页
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Zap,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  XCircle,
  Clock,
} from "lucide-react";

interface Signal {
  id: number;
  prey_event_id: string;
  team: string;
  opponent: string;
  game_date: string;
  direction: string | null;
  confidence_score: number | null;
  signal_level: string | null;
  emotion_tag: string | null;
  model_used: string | null;
  was_correct: number | null;
  settled_at: string | null;
  created_at: string;
}

function DirectionBadge({ direction }: { direction: string | null }) {
  if (!direction) return <span className="text-muted-foreground text-xs">—</span>;
  const d = direction.toUpperCase();
  if (d === "LONG")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono text-[10px] gap-1">
        <TrendingUp className="w-3 h-3" /> LONG
      </Badge>
    );
  if (d === "SHORT")
    return (
      <Badge className="bg-red-500/15 text-red-400 border border-red-500/30 font-mono text-[10px] gap-1">
        <TrendingDown className="w-3 h-3" /> SHORT
      </Badge>
    );
  return (
    <Badge variant="outline" className="font-mono text-[10px]">
      <Minus className="w-3 h-3 mr-1" /> {direction}
    </Badge>
  );
}

function SignalLevelBadge({ level }: { level: string | null }) {
  if (!level) return <span className="text-muted-foreground text-xs">—</span>;
  const l = level.toUpperCase();
  if (l === "HIGH")
    return <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono text-[10px]">HIGH</Badge>;
  if (l === "MEDIUM")
    return <Badge className="bg-primary/15 text-primary border border-primary/30 font-mono text-[10px]">MED</Badge>;
  return <Badge variant="outline" className="font-mono text-[10px]">{level}</Badge>;
}

function CorrectBadge({ wasCorrect }: { wasCorrect: number | null }) {
  if (wasCorrect === null)
    return (
      <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground border-muted-foreground/30">
        <Clock className="w-3 h-3 mr-1" /> 待结算
      </Badge>
    );
  if (wasCorrect === 1)
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono text-[10px]">
        <CheckCircle2 className="w-3 h-3 mr-1" /> 正确
      </Badge>
    );
  return (
    <Badge className="bg-red-500/15 text-red-400 border border-red-500/30 font-mono text-[10px]">
      <XCircle className="w-3 h-3 mr-1" /> 错误
    </Badge>
  );
}

export default function Signals() {
  const [signals, setSignals] = useState<Signal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "HIGH" | "LONG" | "SHORT" | "settled" | "pending">("all");
  const [limit, setLimit] = useState(50);

  const fetchSignals = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const resp = await fetch(`/api/signals?limit=${limit}`);
      if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
      const data = await resp.json();
      setSignals(data.signals || []);
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchSignals();
  }, [fetchSignals]);

  const filtered = signals.filter((s) => {
    if (filter === "HIGH") return s.signal_level?.toUpperCase() === "HIGH";
    if (filter === "LONG") return s.direction?.toUpperCase() === "LONG";
    if (filter === "SHORT") return s.direction?.toUpperCase() === "SHORT";
    if (filter === "settled") return s.was_correct !== null;
    if (filter === "pending") return s.was_correct === null;
    return true;
  });

  const stats = {
    total: signals.length,
    high: signals.filter((s) => s.signal_level?.toUpperCase() === "HIGH").length,
    settled: signals.filter((s) => s.was_correct !== null).length,
    correct: signals.filter((s) => s.was_correct === 1).length,
  };

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Zap className="w-5 h-5 text-primary" />
            信号记录
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            来自 Turso 的历史置信度信号 · 共 {stats.total} 条
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchSignals}
          disabled={loading}
          className="h-8 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className={`w-3 h-3 mr-1 ${loading ? "animate-spin" : ""}`} />
          刷新
        </Button>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[
          { label: "信号总数", value: stats.total, color: "text-foreground" },
          { label: "高置信信号", value: stats.high, color: "text-amber-400" },
          { label: "已结算", value: stats.settled, color: "text-primary" },
          {
            label: "胜率",
            value: stats.settled > 0 ? `${Math.round((stats.correct / stats.settled) * 1000) / 10}%` : "—",
            color: "text-emerald-400",
          },
        ].map((stat) => (
          <Card key={stat.label} className="data-card">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`text-xl font-bold font-mono mt-0.5 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "HIGH", "LONG", "SHORT", "settled", "pending"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs font-mono"
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "全部" : f === "settled" ? "已结算" : f === "pending" ? "待结算" : f}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground ml-2 font-mono">{filtered.length} 条</span>
      </div>

      {/* Signal List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
        </div>
      ) : error ? (
        <Card className="border-red-500/30">
          <CardContent className="p-6 text-center">
            <p className="text-red-400 text-sm font-mono">{error}</p>
            <p className="text-xs text-muted-foreground mt-1">请确认后端服务已启动（/api/signals）</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            暂无信号记录
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((signal) => (
            <Card key={signal.id} className="bg-card border-border hover:border-primary/30 transition-colors">
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="shrink-0">
                      <DirectionBadge direction={signal.direction} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">{signal.team}</span>
                        <span className="text-xs text-muted-foreground">vs</span>
                        <span className="text-sm text-muted-foreground truncate">{signal.opponent}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {signal.game_date ? new Date(signal.game_date).toLocaleDateString("zh-CN") : "—"}
                        </span>
                        {signal.emotion_tag && (
                          <span className="text-[10px] text-muted-foreground/70 font-mono truncate max-w-[120px]">
                            {signal.emotion_tag}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <SignalLevelBadge level={signal.signal_level} />
                    {signal.confidence_score != null && (
                      <span className="text-xs font-mono text-muted-foreground">
                        {typeof signal.confidence_score === "number" ? signal.confidence_score.toFixed(1) : signal.confidence_score}
                      </span>
                    )}
                    <CorrectBadge wasCorrect={signal.was_correct} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Load More */}
      {signals.length >= limit && (
        <div className="text-center">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setLimit((l) => l + 50)}
            className="text-xs font-mono"
          >
            加载更多（当前 {limit} 条）
          </Button>
        </div>
      )}
    </div>
  );
}
