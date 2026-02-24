/*
 * Dashboard — System Overview
 * Tactical Operations Dashboard: status cards, data source health, quick stats
 * Design: Asymmetric grid, colored left borders, pulse indicators
 */
import { useState, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Activity,
  Database,
  Newspaper,
  TrendingUp,
  RefreshCw,
  CheckCircle2,
  XCircle,
  AlertTriangle,
  Loader2,
  Zap,
  Globe,
  Bot,
  BarChart3,
  Clock,
  ArrowUpRight,
} from "lucide-react";

interface DataSourceStatus {
  name: string;
  status: "online" | "offline" | "checking" | "degraded";
  latency?: number;
  lastCheck?: string;
  detail?: string;
  icon: typeof Activity;
}

interface ESPNGame {
  id: string;
  name: string;
  status: string;
  homeTeam: string;
  awayTeam: string;
  homeScore?: string;
  awayScore?: string;
  startTime?: string;
  statusDetail?: string;
}

const HERO_BG = "https://private-us-east-1.manuscdn.com/sessionFile/k8eakjmvwYx2PoANdIvc2n/sandbox/WigDM6MM8okDamK0aRRPUO-img-1_1771928054000_na1fn_c2VhLWhlcm8tYmc.png?x-oss-process=image/resize,w_1920,h_1920/format,webp/quality,q_80&Expires=1798761600&Policy=eyJTdGF0ZW1lbnQiOlt7IlJlc291cmNlIjoiaHR0cHM6Ly9wcml2YXRlLXVzLWVhc3QtMS5tYW51c2Nkbi5jb20vc2Vzc2lvbkZpbGUvazhlYWtqbXZ3WXgyUG9BTmRJdmMybi9zYW5kYm94L1dpZ0RNNk1NOG9rRGFtSzBhUlJQVU8taW1nLTFfMTc3MTkyODA1NDAwMF9uYTFmbl9jMlZoTFdobGNtOHRZbWMucG5nP3gtb3NzLXByb2Nlc3M9aW1hZ2UvcmVzaXplLHdfMTkyMCxoXzE5MjAvZm9ybWF0LHdlYnAvcXVhbGl0eSxxXzgwIiwiQ29uZGl0aW9uIjp7IkRhdGVMZXNzVGhhbiI6eyJBV1M6RXBvY2hUaW1lIjoxNzk4NzYxNjAwfX19XX0_&Key-Pair-Id=K2HSFNDJXOU9YS&Signature=hAtWULKqOCSuJyZ6Z9IJ7LsII3M2NoCWm~z9ZGujd0zT~t2TMsGVO2l3OdOE5ZjQF~JibbfMGeeTHIEDAhxP7hX~RHNtxIFbAmQVkRnbXVcS4ubMaJliIbI9dYqOm-oLvbSwuc66lPBjnmhqBCjr0egHEImTp4bOjRC5ec8cDHvV1Lv6jlqhrgRW7zuuCwx2fUnvLYmOxz3l011hnUzs52C28mScbcVD7FFRvN4yuBGcK4IjwmFx55uzLYQ2oTSD7JySNypWFwrUekPznpkms6SNt7hKTj8i7zdXOgW3shmwf3oSnU84vMsLN6zNWKm~wUgyt6dPeIOvF4aJvyYV9w__";

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case "online":
      return <CheckCircle2 className="w-4 h-4 text-emerald-400" />;
    case "offline":
      return <XCircle className="w-4 h-4 text-red-400" />;
    case "degraded":
      return <AlertTriangle className="w-4 h-4 text-amber-400" />;
    case "checking":
      return <Loader2 className="w-4 h-4 text-primary animate-spin" />;
    default:
      return <Activity className="w-4 h-4 text-muted-foreground" />;
  }
}

function StatusBadge({ status }: { status: string }) {
  const variants: Record<string, string> = {
    online: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    offline: "bg-red-500/15 text-red-400 border-red-500/30",
    degraded: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    checking: "bg-primary/15 text-primary border-primary/30",
  };
  const labels: Record<string, string> = {
    online: "在线",
    offline: "离线",
    degraded: "降级",
    checking: "检测中",
  };
  return (
    <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono border ${variants[status] || ""}`}>
      <span className={`w-1.5 h-1.5 rounded-full ${status === "online" ? "bg-emerald-400 status-pulse" : status === "offline" ? "bg-red-400" : status === "degraded" ? "bg-amber-400 status-pulse" : "bg-primary animate-spin"}`} />
      {labels[status] || status}
    </span>
  );
}

export default function Dashboard() {
  const [dataSources, setDataSources] = useState<DataSourceStatus[]>([
    { name: "ESPN NBA API", status: "checking", icon: Globe, detail: "赛程+新闻" },
    { name: "ESPN News", status: "checking", icon: Newspaper, detail: "新闻引擎" },
    { name: "Odds API", status: "checking", icon: TrendingUp, detail: "盘口数据" },
    { name: "OpenRouter", status: "checking", icon: Zap, detail: "AI模型网关" },
    { name: "Telegram Bot", status: "checking", icon: Bot, detail: "推送通道" },
  ]);
  const [games, setGames] = useState<ESPNGame[]>([]);
  const [refreshing, setRefreshing] = useState(false);
  const [lastRefresh, setLastRefresh] = useState<Date | null>(null);

  const checkDataSources = useCallback(async () => {
    setRefreshing(true);
    const newSources: DataSourceStatus[] = dataSources.map((s) => ({ ...s, status: "checking" as const }));
    setDataSources([...newSources]);

    // Check ESPN NBA API
    try {
      const start = Date.now();
      const resp = await fetch("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard");
      const latency = Date.now() - start;
      if (resp.ok) {
        const data = await resp.json();
        const eventCount = data?.events?.length || 0;
        const gamesData: ESPNGame[] = (data?.events || []).map((e: any) => {
          const comp = e.competitions?.[0];
          const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
          const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
          return {
            id: e.id,
            name: e.name || "",
            status: e.status?.type?.name || "",
            homeTeam: home?.team?.displayName || "",
            awayTeam: away?.team?.displayName || "",
            homeScore: home?.score,
            awayScore: away?.score,
            startTime: e.date,
            statusDetail: e.status?.type?.detail || "",
          };
        });
        setGames(gamesData);
        newSources[0] = { ...newSources[0], status: "online", latency, detail: `${eventCount} 场比赛`, lastCheck: new Date().toISOString() };
      } else {
        newSources[0] = { ...newSources[0], status: "offline", detail: `HTTP ${resp.status}`, lastCheck: new Date().toISOString() };
      }
    } catch {
      newSources[0] = { ...newSources[0], status: "offline", detail: "连接失败", lastCheck: new Date().toISOString() };
    }

    // Check ESPN News
    try {
      const start = Date.now();
      const resp = await fetch("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=5");
      const latency = Date.now() - start;
      if (resp.ok) {
        const data = await resp.json();
        const articleCount = data?.articles?.length || 0;
        newSources[1] = { ...newSources[1], status: "online", latency, detail: `${articleCount} 条新闻`, lastCheck: new Date().toISOString() };
      } else {
        newSources[1] = { ...newSources[1], status: "offline", detail: `HTTP ${resp.status}`, lastCheck: new Date().toISOString() };
      }
    } catch {
      newSources[1] = { ...newSources[1], status: "offline", detail: "连接失败", lastCheck: new Date().toISOString() };
    }

    // Check Odds API (just connectivity, no key needed for check)
    try {
      const start = Date.now();
      const resp = await fetch("https://api.the-odds-api.com/v4/sports/?apiKey=DEMO");
      const latency = Date.now() - start;
      if (resp.ok || resp.status === 401) {
        // 401 means API is reachable but key invalid — that's fine for connectivity check
        newSources[2] = { ...newSources[2], status: resp.ok ? "online" : "degraded", latency, detail: resp.ok ? "API可达" : "需要有效Key", lastCheck: new Date().toISOString() };
      } else {
        newSources[2] = { ...newSources[2], status: "offline", detail: `HTTP ${resp.status}`, lastCheck: new Date().toISOString() };
      }
    } catch {
      newSources[2] = { ...newSources[2], status: "offline", detail: "连接失败", lastCheck: new Date().toISOString() };
    }

    // Check OpenRouter
    try {
      const start = Date.now();
      const resp = await fetch("https://openrouter.ai/api/v1/models", { method: "GET" });
      const latency = Date.now() - start;
      newSources[3] = { ...newSources[3], status: resp.ok ? "online" : "degraded", latency, detail: resp.ok ? "模型网关正常" : `HTTP ${resp.status}`, lastCheck: new Date().toISOString() };
    } catch {
      newSources[3] = { ...newSources[3], status: "offline", detail: "连接失败", lastCheck: new Date().toISOString() };
    }

    // Check Telegram API
    try {
      const start = Date.now();
      const resp = await fetch("https://api.telegram.org/", { method: "GET" });
      const latency = Date.now() - start;
      newSources[4] = { ...newSources[4], status: resp.ok || resp.status === 404 ? "online" : "degraded", latency, detail: "API可达", lastCheck: new Date().toISOString() };
    } catch {
      newSources[4] = { ...newSources[4], status: "offline", detail: "连接失败（可能被墙）", lastCheck: new Date().toISOString() };
    }

    setDataSources(newSources);
    setRefreshing(false);
    setLastRefresh(new Date());
  }, []);

  useEffect(() => {
    checkDataSources();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onlineCount = dataSources.filter((s) => s.status === "online").length;
  const totalCount = dataSources.length;
  const upcomingGames = games.filter((g) => g.status === "STATUS_SCHEDULED");
  const liveGames = games.filter((g) => g.status === "STATUS_IN_PROGRESS");
  const completedGames = games.filter((g) => g.status === "STATUS_FINAL");

  return (
    <div className="p-6 space-y-6">
      {/* Hero Banner */}
      <div className="relative rounded-xl overflow-hidden h-40">
        <div
          className="absolute inset-0 bg-cover bg-center opacity-30"
          style={{ backgroundImage: `url(${HERO_BG})` }}
        />
        <div className="absolute inset-0 bg-gradient-to-r from-background via-background/80 to-transparent" />
        <div className="relative z-10 h-full flex items-center px-6">
          <div>
            <h1 className="text-2xl font-bold text-foreground tracking-tight">
              Sports Emotion Arbitrage
            </h1>
            <p className="text-sm text-muted-foreground mt-1">
              NBA情绪套利雷达系统 — 战术作战面板
            </p>
            <div className="flex items-center gap-3 mt-3">
              <Badge variant="outline" className="font-mono text-xs border-primary/40 text-primary">
                V5.9
              </Badge>
              <Badge variant="outline" className="font-mono text-xs border-emerald-500/40 text-emerald-400">
                ESPN + Perplexity + Claude
              </Badge>
              <Badge variant="outline" className="font-mono text-xs border-amber-500/40 text-amber-400">
                GitHub Actions 定时任务
              </Badge>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Stats Row */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="data-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">数据源状态</p>
                <p className="text-2xl font-bold font-mono mt-1">
                  <span className="text-emerald-400">{onlineCount}</span>
                  <span className="text-muted-foreground text-lg">/{totalCount}</span>
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Database className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="data-card">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">今日比赛</p>
                <p className="text-2xl font-bold font-mono mt-1">
                  <span className="text-foreground">{games.length}</span>
                  <span className="text-muted-foreground text-lg"> 场</span>
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center">
                <BarChart3 className="w-5 h-5 text-primary" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="data-card data-card-warning">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">进行中</p>
                <p className="text-2xl font-bold font-mono mt-1">
                  <span className={liveGames.length > 0 ? "text-amber-400" : "text-muted-foreground"}>{liveGames.length}</span>
                  <span className="text-muted-foreground text-lg"> 场</span>
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-amber-500/10 flex items-center justify-center">
                <Activity className={`w-5 h-5 text-amber-400 ${liveGames.length > 0 ? "status-pulse" : ""}`} />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="data-card data-card-success">
          <CardContent className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-muted-foreground">即将开赛</p>
                <p className="text-2xl font-bold font-mono mt-1">
                  <span className="text-emerald-400">{upcomingGames.length}</span>
                  <span className="text-muted-foreground text-lg"> 场</span>
                </p>
              </div>
              <div className="w-10 h-10 rounded-lg bg-emerald-500/10 flex items-center justify-center">
                <Clock className="w-5 h-5 text-emerald-400" />
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Data Sources Health + Today's Games */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* Data Sources — takes 2 cols */}
        <div className="lg:col-span-2 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">数据源健康检查</h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={checkDataSources}
              disabled={refreshing}
              className="h-7 text-xs text-muted-foreground hover:text-foreground"
            >
              <RefreshCw className={`w-3 h-3 mr-1 ${refreshing ? "animate-spin" : ""}`} />
              刷新
            </Button>
          </div>

          <div className="space-y-2">
            {dataSources.map((source) => {
              const Icon = source.icon;
              return (
                <Card key={source.name} className="bg-card border-border">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-md bg-muted flex items-center justify-center">
                          <Icon className="w-4 h-4 text-muted-foreground" />
                        </div>
                        <div>
                          <div className="text-sm font-medium text-foreground">{source.name}</div>
                          <div className="text-xs text-muted-foreground font-mono">{source.detail}</div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {source.latency !== undefined && (
                          <span className="text-xs font-mono text-muted-foreground">{source.latency}ms</span>
                        )}
                        <StatusBadge status={source.status} />
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {lastRefresh && (
            <p className="text-xs text-muted-foreground font-mono">
              上次检查: {lastRefresh.toLocaleTimeString("zh-CN", { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
            </p>
          )}
        </div>

        {/* Today's Games — takes 3 cols */}
        <div className="lg:col-span-3 space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-semibold text-foreground">今日 NBA 赛程</h2>
            <span className="text-xs text-muted-foreground font-mono">
              ESPN Scoreboard
            </span>
          </div>

          {games.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center">
                <div className="text-muted-foreground text-sm">
                  {refreshing ? (
                    <div className="flex items-center justify-center gap-2">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      加载中...
                    </div>
                  ) : (
                    "今日暂无比赛安排"
                  )}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {games.map((game) => (
                <Card key={game.id} className="bg-card border-border hover:border-primary/30 transition-colors">
                  <CardContent className="p-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="text-sm font-medium text-foreground truncate">{game.awayTeam}</span>
                            {game.awayScore && (
                              <span className="font-mono text-sm font-bold text-foreground">{game.awayScore}</span>
                            )}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className="text-xs text-muted-foreground">@</span>
                            <span className="text-sm font-medium text-foreground truncate">{game.homeTeam}</span>
                            {game.homeScore && (
                              <span className="font-mono text-sm font-bold text-foreground">{game.homeScore}</span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="text-right shrink-0 ml-4">
                        {game.status === "STATUS_SCHEDULED" ? (
                          <Badge variant="outline" className="font-mono text-[10px] border-primary/30 text-primary">
                            {game.startTime
                              ? new Date(game.startTime).toLocaleTimeString("zh-CN", {
                                  timeZone: "Asia/Shanghai",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "待定"}
                          </Badge>
                        ) : game.status === "STATUS_IN_PROGRESS" ? (
                          <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono text-[10px]">
                            <Activity className="w-3 h-3 mr-1 status-pulse" />
                            进行中
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="font-mono text-[10px] border-muted-foreground/30 text-muted-foreground">
                            已结束
                          </Badge>
                        )}
                        <div className="text-[10px] text-muted-foreground mt-1 font-mono">
                          {game.statusDetail}
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* System Architecture Quick Info */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <Card className="data-card bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <Zap className="w-4 h-4 text-primary" />
              数据采集层
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>ESPN Scoreboard</span>
                <span className="font-mono text-emerald-400">免费</span>
              </div>
              <div className="flex justify-between">
                <span>ESPN News Engine</span>
                <span className="font-mono text-emerald-400">免费</span>
              </div>
              <div className="flex justify-between">
                <span>Odds API</span>
                <span className="font-mono text-amber-400">配额制</span>
              </div>
              <div className="flex justify-between">
                <span>Action Network</span>
                <span className="font-mono text-amber-400">爬虫</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="data-card bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <Activity className="w-4 h-4 text-amber-400" />
              分析引擎层
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Perplexity sonar-pro-search</span>
                <span className="font-mono text-primary">舆论</span>
              </div>
              <div className="flex justify-between">
                <span>Claude Opus 4.6</span>
                <span className="font-mono text-primary">情绪</span>
              </div>
              <div className="flex justify-between">
                <span>规则引擎 V6</span>
                <span className="font-mono text-emerald-400">宪法</span>
              </div>
              <div className="flex justify-between">
                <span>近因效应引擎</span>
                <span className="font-mono text-emerald-400">时序</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card className="data-card bg-card">
          <CardHeader className="pb-2 pt-4 px-4">
            <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-emerald-400" />
              输出层
            </CardTitle>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="space-y-1.5 text-xs text-muted-foreground">
              <div className="flex justify-between">
                <span>Telegram 推送</span>
                <span className="font-mono text-emerald-400">主通道</span>
              </div>
              <div className="flex justify-between">
                <span>SQLite 记忆库</span>
                <span className="font-mono text-primary">持久化</span>
              </div>
              <div className="flex justify-between">
                <span>置信度评分</span>
                <span className="font-mono text-primary">8维度</span>
              </div>
              <div className="flex justify-between">
                <span>GitHub Actions</span>
                <span className="font-mono text-amber-400">定时</span>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Cron Schedule */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-primary" />
            定时任务调度
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            {[
              { cron: "0 10 * * *", utc: "UTC 10:00", bj: "北京 18:00", desc: "赛前扫描（美东下午场）" },
              { cron: "0 1 * * *", utc: "UTC 01:00", bj: "北京 09:00", desc: "赛后复盘（美东晚场结束）" },
              { cron: "0 14 * * *", utc: "UTC 14:00", bj: "北京 22:00", desc: "主力扫描（美东晚场赛前）" },
            ].map((schedule) => (
              <div key={schedule.cron} className="bg-muted/50 rounded-lg p-3">
                <div className="font-mono text-xs text-primary">{schedule.cron}</div>
                <div className="text-sm text-foreground mt-1">{schedule.desc}</div>
                <div className="text-xs text-muted-foreground mt-0.5">
                  {schedule.utc} → {schedule.bj}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
