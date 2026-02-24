/*
 * RadarScan — Live Data Explorer
 * ESPN games, news headlines, narrative tags detection
 * Design: Data-dense panels with colored borders, monospace data
 */
import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Radar,
  Newspaper,
  RefreshCw,
  Loader2,
  AlertTriangle,
  TrendingUp,
  Clock,
  ExternalLink,
  Flame,
  Shield,
  Zap,
} from "lucide-react";

interface NewsArticle {
  headline: string;
  description: string;
  published: string;
  link?: string;
  images?: { url: string }[];
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
  homeRecord?: string;
  awayRecord?: string;
  broadcast?: string;
  venue?: string;
  odds?: string;
}

// Narrative tags from espn_news.py
const NARRATIVE_TAGS: Record<string, { label: string; color: string; icon: typeof AlertTriangle }> = {
  injury: { label: "伤病恐慌", color: "text-red-400 bg-red-500/10 border-red-500/30", icon: AlertTriangle },
  trade: { label: "交易震荡", color: "text-amber-400 bg-amber-500/10 border-amber-500/30", icon: Zap },
  suspension: { label: "停赛", color: "text-red-400 bg-red-500/10 border-red-500/30", icon: Shield },
  streak: { label: "连胜/连败", color: "text-emerald-400 bg-emerald-500/10 border-emerald-500/30", icon: TrendingUp },
  comeback: { label: "逆转", color: "text-primary bg-primary/10 border-primary/30", icon: Flame },
  blowout: { label: "大比分", color: "text-amber-400 bg-amber-500/10 border-amber-500/30", icon: Flame },
};

function detectNarrativeTags(text: string): string[] {
  const lower = text.toLowerCase();
  const tags: string[] = [];
  if (/injur|hurt|out for|sidelined|miss|day-to-day|questionable|doubtful/.test(lower)) tags.push("injury");
  if (/trade|traded|deal|acquire|sign|waive|release|free agent/.test(lower)) tags.push("trade");
  if (/suspend|ban|fine|eject/.test(lower)) tags.push("suspension");
  if (/streak|consecutive|in a row|winning streak|losing streak/.test(lower)) tags.push("streak");
  if (/comeback|rally|erase|overcome|deficit/.test(lower)) tags.push("comeback");
  if (/blowout|rout|dominate|crush|destroy|blow out/.test(lower)) tags.push("blowout");
  return tags;
}

export default function RadarScan() {
  const [games, setGames] = useState<ESPNGame[]>([]);
  const [news, setNews] = useState<NewsArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [newsLoading, setNewsLoading] = useState(true);

  const fetchGames = async () => {
    setLoading(true);
    try {
      const resp = await fetch("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/scoreboard");
      if (resp.ok) {
        const data = await resp.json();
        const gamesData: ESPNGame[] = (data?.events || []).map((e: any) => {
          const comp = e.competitions?.[0];
          const home = comp?.competitors?.find((c: any) => c.homeAway === "home");
          const away = comp?.competitors?.find((c: any) => c.homeAway === "away");
          const odds = comp?.odds?.[0];
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
            homeRecord: home?.records?.[0]?.summary || "",
            awayRecord: away?.records?.[0]?.summary || "",
            broadcast: comp?.broadcasts?.[0]?.names?.[0] || "",
            venue: comp?.venue?.fullName || "",
            odds: odds ? `${odds.details} | O/U ${odds.overUnder}` : "",
          };
        });
        setGames(gamesData);
      }
    } catch (err) {
      console.error("Failed to fetch games:", err);
    }
    setLoading(false);
  };

  const fetchNews = async () => {
    setNewsLoading(true);
    try {
      const resp = await fetch("https://site.api.espn.com/apis/site/v2/sports/basketball/nba/news?limit=20");
      if (resp.ok) {
        const data = await resp.json();
        setNews(
          (data?.articles || []).map((a: any) => ({
            headline: a.headline || "",
            description: a.description || "",
            published: a.published || "",
            link: a.links?.web?.href || a.links?.api?.news?.href || "",
            images: a.images || [],
          }))
        );
      }
    } catch (err) {
      console.error("Failed to fetch news:", err);
    }
    setNewsLoading(false);
  };

  useEffect(() => {
    fetchGames();
    fetchNews();
  }, []);

  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <Radar className="w-5 h-5 text-primary" />
            雷达扫描
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            实时数据探索 — ESPN赛程 + 新闻事件 + 叙事标签检测
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={() => { fetchGames(); fetchNews(); }}
          className="border-primary/30 text-primary hover:bg-primary/10"
        >
          <RefreshCw className="w-3.5 h-3.5 mr-1.5" />
          刷新数据
        </Button>
      </div>

      <Tabs defaultValue="games" className="space-y-4">
        <TabsList className="bg-muted/50 border border-border">
          <TabsTrigger value="games" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            赛程 ({games.length})
          </TabsTrigger>
          <TabsTrigger value="news" className="data-[state=active]:bg-primary/15 data-[state=active]:text-primary">
            新闻 ({news.length})
          </TabsTrigger>
        </TabsList>

        {/* Games Tab */}
        <TabsContent value="games" className="space-y-3">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">加载赛程数据...</span>
            </div>
          ) : games.length === 0 ? (
            <Card className="bg-card border-border">
              <CardContent className="p-8 text-center text-muted-foreground">
                今日暂无比赛安排（可能是休赛日）
              </CardContent>
            </Card>
          ) : (
            games.map((game) => (
              <Card key={game.id} className="bg-card border-border hover:border-primary/20 transition-colors">
                <CardContent className="p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1 space-y-2">
                      {/* Teams */}
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <span className="text-base font-semibold text-foreground">{game.awayTeam}</span>
                          {game.awayRecord && (
                            <span className="text-xs font-mono text-muted-foreground">({game.awayRecord})</span>
                          )}
                          {game.awayScore && (
                            <span className="font-mono text-lg font-bold text-foreground ml-auto">{game.awayScore}</span>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="text-xs text-muted-foreground">@</span>
                          <span className="text-base font-semibold text-foreground">{game.homeTeam}</span>
                          {game.homeRecord && (
                            <span className="text-xs font-mono text-muted-foreground">({game.homeRecord})</span>
                          )}
                          {game.homeScore && (
                            <span className="font-mono text-lg font-bold text-foreground ml-auto">{game.homeScore}</span>
                          )}
                        </div>
                      </div>

                      {/* Meta info */}
                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                        {game.venue && <span>{game.venue}</span>}
                        {game.broadcast && (
                          <>
                            <span className="text-border">|</span>
                            <span>{game.broadcast}</span>
                          </>
                        )}
                        {game.odds && (
                          <>
                            <span className="text-border">|</span>
                            <span className="font-mono text-primary">{game.odds}</span>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Status */}
                    <div className="text-right shrink-0">
                      {game.status === "STATUS_SCHEDULED" ? (
                        <div>
                          <Badge variant="outline" className="font-mono text-xs border-primary/30 text-primary">
                            {game.startTime
                              ? new Date(game.startTime).toLocaleTimeString("zh-CN", {
                                  timeZone: "Asia/Shanghai",
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })
                              : "TBD"}
                          </Badge>
                          <div className="text-[10px] text-muted-foreground mt-1">北京时间</div>
                        </div>
                      ) : game.status === "STATUS_IN_PROGRESS" ? (
                        <Badge className="bg-amber-500/15 text-amber-400 border border-amber-500/30 font-mono text-xs">
                          进行中
                        </Badge>
                      ) : (
                        <Badge variant="outline" className="font-mono text-xs border-muted-foreground/30 text-muted-foreground">
                          {game.statusDetail || "已结束"}
                        </Badge>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>

        {/* News Tab */}
        <TabsContent value="news" className="space-y-3">
          {newsLoading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
              <span className="ml-2 text-sm text-muted-foreground">加载新闻数据...</span>
            </div>
          ) : (
            news.map((article, i) => {
              const tags = detectNarrativeTags(article.headline + " " + article.description);
              return (
                <Card
                  key={i}
                  className={`bg-card border-border ${tags.length > 0 ? "border-l-2 border-l-amber-500" : ""}`}
                >
                  <CardContent className="p-4">
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <h3 className="text-sm font-semibold text-foreground leading-snug">{article.headline}</h3>
                        {article.link && (
                          <a
                            href={article.link}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="shrink-0 text-muted-foreground hover:text-primary transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                      </div>
                      {article.description && (
                        <p className="text-xs text-muted-foreground line-clamp-2">{article.description}</p>
                      )}
                      <div className="flex items-center gap-2 flex-wrap">
                        {tags.map((tag) => {
                          const tagInfo = NARRATIVE_TAGS[tag];
                          if (!tagInfo) return null;
                          const Icon = tagInfo.icon;
                          return (
                            <span
                              key={tag}
                              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono border ${tagInfo.color}`}
                            >
                              <Icon className="w-3 h-3" />
                              {tagInfo.label}
                            </span>
                          );
                        })}
                        {article.published && (
                          <span className="text-[10px] text-muted-foreground font-mono ml-auto">
                            {new Date(article.published).toLocaleString("zh-CN", {
                              timeZone: "Asia/Shanghai",
                              month: "2-digit",
                              day: "2-digit",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
