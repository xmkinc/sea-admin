/*
 * Reviews — 决策复盘
 * 展示来自 Turso 的历史决策记录（decisions 表），支持结果筛选和 ROI 统计
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  BookOpen,
  RefreshCw,
  Loader2,
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  XCircle,
  Clock,
  BarChart3,
} from "lucide-react";

interface Review {
  id: number;
  prey_event_id: string;
  team: string;
  opponent: string;
  game_date: string;
  direction: string | null;
  bet_type: string | null;
  spread: number | null;
  result: string | null;
  created_at: string;
  settled_at: string | null;
}

interface RoiEntry {
  bet_type: string;
  total: number;
  wins: number;
  losses: number;
  pushes: number;
}

function ResultBadge({ result }: { result: string | null }) {
  if (!result)
    return (
      <Badge variant="outline" className="font-mono text-[10px] text-muted-foreground border-muted-foreground/30">
        <Clock className="w-3 h-3 mr-1" /> 待结算
      </Badge>
    );
  if (result === "win" || result === "half_win")
    return (
      <Badge className="bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-mono text-[10px]">
        <CheckCircle2 className="w-3 h-3 mr-1" /> {result === "half_win" ? "半胜" : "胜"}
      </Badge>
    );
  if (result === "loss" || result === "half_loss")
    return (
      <Badge className="bg-red-500/15 text-red-400 border border-red-500/30 font-mono text-[10px]">
        <XCircle className="w-3 h-3 mr-1" /> {result === "half_loss" ? "半负" : "负"}
      </Badge>
    );
  if (result === "push")
    return (
      <Badge variant="outline" className="font-mono text-[10px]">
        <Minus className="w-3 h-3 mr-1" /> 平局
      </Badge>
    );
  return <Badge variant="outline" className="font-mono text-[10px]">{result}</Badge>;
}

function DirectionIcon({ direction }: { direction: string | null }) {
  const d = direction?.toUpperCase();
  if (d === "LONG") return <TrendingUp className="w-4 h-4 text-emerald-400" />;
  if (d === "SHORT") return <TrendingDown className="w-4 h-4 text-red-400" />;
  return <Minus className="w-4 h-4 text-muted-foreground" />;
}

export default function Reviews() {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [roi, setRoi] = useState<RoiEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "win" | "loss" | "push" | "pending">("all");
  const [limit, setLimit] = useState(50);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [reviewsResp, roiResp] = await Promise.all([
        fetch(`/api/reviews?limit=${limit}`),
        fetch("/api/reviews/roi"),
      ]);
      if (!reviewsResp.ok) throw new Error(`HTTP ${reviewsResp.status}`);
      const reviewsData = await reviewsResp.json();
      setReviews(reviewsData.reviews || []);
      if (roiResp.ok) {
        const roiData = await roiResp.json();
        setRoi(roiData.roi_by_type || []);
      }
    } catch (err) {
      setError(String(err));
    } finally {
      setLoading(false);
    }
  }, [limit]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const filtered = reviews.filter((r) => {
    if (filter === "win") return r.result === "win" || r.result === "half_win";
    if (filter === "loss") return r.result === "loss" || r.result === "half_loss";
    if (filter === "push") return r.result === "push";
    if (filter === "pending") return r.result === null;
    return true;
  });

  const totalSettled = reviews.filter((r) => r.result !== null).length;
  const totalWins = reviews.filter((r) => r.result === "win" || r.result === "half_win").length;
  const winRate = totalSettled > 0 ? Math.round((totalWins / totalSettled) * 1000) / 10 : null;

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-primary" />
            决策复盘
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            来自 Turso 的历史决策记录 · 共 {reviews.length} 条
          </p>
        </div>
        <Button
          variant="ghost"
          size="sm"
          onClick={fetchData}
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
          { label: "决策总数", value: reviews.length, color: "text-foreground" },
          { label: "胜", value: totalWins, color: "text-emerald-400" },
          { label: "负", value: reviews.filter((r) => r.result === "loss" || r.result === "half_loss").length, color: "text-red-400" },
          { label: "胜率", value: winRate != null ? `${winRate}%` : "—", color: "text-primary" },
        ].map((stat) => (
          <Card key={stat.label} className="data-card">
            <CardContent className="p-3">
              <p className="text-xs text-muted-foreground">{stat.label}</p>
              <p className={`text-xl font-bold font-mono mt-0.5 ${stat.color}`}>{stat.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ROI by Bet Type */}
      {roi.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <BarChart3 className="w-4 h-4 text-primary" />
              按投注类型 ROI
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-2">
              {roi.map((r) => {
                const settled = r.wins + r.losses + r.pushes;
                const wr = settled > 0 ? Math.round((r.wins / settled) * 1000) / 10 : 0;
                return (
                  <div key={r.bet_type} className="flex items-center justify-between text-sm">
                    <span className="font-mono text-muted-foreground">{r.bet_type || "未知"}</span>
                    <div className="flex items-center gap-3">
                      <span className="text-xs text-muted-foreground">{r.total} 场</span>
                      <span className="text-xs text-emerald-400">{r.wins}胜</span>
                      <span className="text-xs text-red-400">{r.losses}负</span>
                      <span className="font-mono text-sm font-semibold text-primary">{wr}%</span>
                    </div>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 flex-wrap">
        {(["all", "win", "loss", "push", "pending"] as const).map((f) => (
          <Button
            key={f}
            variant={filter === f ? "default" : "outline"}
            size="sm"
            className="h-7 text-xs font-mono"
            onClick={() => setFilter(f)}
          >
            {f === "all" ? "全部" : f === "win" ? "胜" : f === "loss" ? "负" : f === "push" ? "平局" : "待结算"}
          </Button>
        ))}
        <span className="text-xs text-muted-foreground ml-2 font-mono">{filtered.length} 条</span>
      </div>

      {/* Review List */}
      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">加载中...</span>
        </div>
      ) : error ? (
        <Card className="border-red-500/30">
          <CardContent className="p-6 text-center">
            <p className="text-red-400 text-sm font-mono">{error}</p>
            <p className="text-xs text-muted-foreground mt-1">请确认后端服务已启动（/api/reviews）</p>
          </CardContent>
        </Card>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-8 text-center text-muted-foreground text-sm">
            暂无决策记录
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((review) => (
            <Card key={review.id} className="bg-card border-border hover:border-primary/30 transition-colors">
              <CardContent className="p-3">
                <div className="flex items-center justify-between gap-4">
                  <div className="flex items-center gap-3 flex-1 min-w-0">
                    <div className="shrink-0">
                      <DirectionIcon direction={review.direction} />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-foreground truncate">{review.team}</span>
                        <span className="text-xs text-muted-foreground">vs</span>
                        <span className="text-sm text-muted-foreground truncate">{review.opponent}</span>
                      </div>
                      <div className="flex items-center gap-2 mt-0.5">
                        <span className="text-[11px] text-muted-foreground font-mono">
                          {review.game_date ? new Date(review.game_date).toLocaleDateString("zh-CN") : "—"}
                        </span>
                        {review.bet_type && (
                          <span className="text-[10px] font-mono text-muted-foreground/70">{review.bet_type}</span>
                        )}
                        {review.spread != null && (
                          <span className="text-[10px] font-mono text-muted-foreground/70">
                            {review.spread > 0 ? `+${review.spread}` : review.spread}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="shrink-0">
                    <ResultBadge result={review.result} />
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Load More */}
      {reviews.length >= limit && (
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
