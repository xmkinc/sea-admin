/*
 * ActionsLog — GitHub Actions Run History
 * Shows workflow runs, status, and provides manual trigger info
 * Design: Timeline-style log entries with status indicators
 */
import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  ScrollText,
  ExternalLink,
  Clock,
  CheckCircle2,
  XCircle,
  Loader2,
  Play,
  GitBranch,
  Terminal,
  Copy,
  Check,
} from "lucide-react";
import { toast } from "sonner";

// Since GitHub Actions API requires auth token, we show the workflow config
// and provide quick links to GitHub
const WORKFLOW_INFO = {
  name: "V5.9.4 Emotion Arbitrage Radar",
  repo: "xmkinc/sports-emotion-arbitrage",
  file: ".github/workflows/radar_scan.yml",
  schedules: [
    { cron: "0 10 * * *", desc: "赛前扫描（美东下午场）", bj: "18:00" },
    { cron: "0 1 * * *", desc: "赛后复盘（美东晚场结束）", bj: "09:00" },
    { cron: "0 14 * * *", desc: "主力扫描（美东晚场赛前）", bj: "22:00" },
  ],
  envVars: [
    { name: "OPENROUTER_API_KEY", desc: "OpenRouter 主Key", masked: true },
    { name: "OPENROUTER_API_KEY_BACKUP", desc: "OpenRouter 备用Key", masked: true },
    { name: "ODDS_API_KEY", desc: "The Odds API", masked: true },
    { name: "TELEGRAM_BOT_TOKEN", desc: "Telegram Bot Token", masked: true },
    { name: "TELEGRAM_CHAT_ID", desc: "Telegram 推送目标", masked: true },
  ],
  steps: [
    { name: "Checkout", desc: "拉取最新代码" },
    { name: "Setup Python 3.11", desc: "安装Python环境" },
    { name: "Install dependencies", desc: "pip install -r requirements.txt" },
    { name: "Initialize data directory", desc: "mkdir -p data" },
    { name: "Download database artifact", desc: "恢复memory.db数据库" },
    { name: "Run V5.9.4 Radar", desc: "执行 radar_scan.py 主流程" },
    { name: "Upload database artifact", desc: "保存memory.db（90天）" },
  ],
};

function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = () => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    toast.success("已复制到剪贴板");
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button onClick={handleCopy} className="text-muted-foreground hover:text-foreground transition-colors">
      {copied ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
    </button>
  );
}

export default function ActionsLog() {
  return (
    <div className="p-6 space-y-6">
      {/* Page Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-foreground flex items-center gap-2">
            <ScrollText className="w-5 h-5 text-primary" />
            运行日志
          </h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            GitHub Actions 工作流配置与运行状态
          </p>
        </div>
        <a
          href={`https://github.com/${WORKFLOW_INFO.repo}/actions`}
          target="_blank"
          rel="noopener noreferrer"
        >
          <Button variant="outline" size="sm" className="border-primary/30 text-primary hover:bg-primary/10">
            <ExternalLink className="w-3.5 h-3.5 mr-1.5" />
            GitHub Actions
          </Button>
        </a>
      </div>

      {/* Workflow Overview */}
      <Card className="data-card bg-card">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <GitBranch className="w-4 h-4 text-primary" />
            工作流配置
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">工作流名称</div>
              <div className="font-mono text-sm text-foreground">{WORKFLOW_INFO.name}</div>
            </div>
            <div className="space-y-2">
              <div className="text-xs text-muted-foreground">仓库</div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-sm text-foreground">{WORKFLOW_INFO.repo}</span>
                <a
                  href={`https://github.com/${WORKFLOW_INFO.repo}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary hover:text-primary/80"
                >
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            </div>
          </div>

          {/* Manual trigger command */}
          <div className="bg-muted/50 rounded-lg p-3 space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs text-muted-foreground flex items-center gap-1.5">
                <Terminal className="w-3 h-3" />
                手动触发命令
              </span>
              <CopyButton text={`gh workflow run radar_scan.yml --repo ${WORKFLOW_INFO.repo}`} />
            </div>
            <code className="block text-xs font-mono text-primary bg-background/50 rounded px-3 py-2">
              gh workflow run radar_scan.yml --repo {WORKFLOW_INFO.repo}
            </code>
          </div>
        </CardContent>
      </Card>

      {/* Schedule */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <Clock className="w-4 h-4 text-amber-400" />
            定时调度
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-2">
            {WORKFLOW_INFO.schedules.map((s) => (
              <div key={s.cron} className="flex items-center justify-between bg-muted/30 rounded-lg px-3 py-2.5">
                <div className="flex items-center gap-3">
                  <code className="font-mono text-xs text-primary bg-primary/10 px-2 py-0.5 rounded">{s.cron}</code>
                  <span className="text-sm text-foreground">{s.desc}</span>
                </div>
                <Badge variant="outline" className="font-mono text-[10px] border-muted-foreground/30">
                  北京 {s.bj}
                </Badge>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Pipeline Steps */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <Play className="w-4 h-4 text-emerald-400" />
            执行流水线
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-0">
            {WORKFLOW_INFO.steps.map((step, i) => (
              <div key={i} className="flex items-start gap-3 relative">
                {/* Timeline line */}
                {i < WORKFLOW_INFO.steps.length - 1 && (
                  <div className="absolute left-[11px] top-6 w-px h-full bg-border" />
                )}
                {/* Step dot */}
                <div className="w-6 h-6 rounded-full bg-muted flex items-center justify-center shrink-0 z-10 mt-0.5">
                  <span className="text-[10px] font-mono text-muted-foreground">{i + 1}</span>
                </div>
                {/* Step content */}
                <div className="pb-4 flex-1">
                  <div className="text-sm font-medium text-foreground">{step.name}</div>
                  <div className="text-xs text-muted-foreground">{step.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Environment Variables */}
      <Card className="bg-card border-border">
        <CardHeader className="pb-3 pt-4 px-4">
          <CardTitle className="text-sm font-medium text-foreground flex items-center gap-2">
            <Terminal className="w-4 h-4 text-primary" />
            环境变量 (GitHub Secrets)
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          <div className="space-y-1.5">
            {WORKFLOW_INFO.envVars.map((v) => (
              <div key={v.name} className="flex items-center justify-between bg-muted/30 rounded px-3 py-2">
                <code className="font-mono text-xs text-foreground">{v.name}</code>
                <div className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground">{v.desc}</span>
                  <Badge variant="outline" className="font-mono text-[10px] border-emerald-500/30 text-emerald-400">
                    已配置
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Quick Links */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[
          {
            title: "查看运行历史",
            desc: "GitHub Actions 所有运行记录",
            href: `https://github.com/${WORKFLOW_INFO.repo}/actions`,
            icon: ScrollText,
          },
          {
            title: "查看工作流文件",
            desc: "radar_scan.yml 配置文件",
            href: `https://github.com/${WORKFLOW_INFO.repo}/blob/main/${WORKFLOW_INFO.file}`,
            icon: GitBranch,
          },
          {
            title: "查看仓库",
            desc: "sports-emotion-arbitrage",
            href: `https://github.com/${WORKFLOW_INFO.repo}`,
            icon: Terminal,
          },
        ].map((link) => {
          const Icon = link.icon;
          return (
            <a
              key={link.title}
              href={link.href}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
              <Card className="bg-card border-border hover:border-primary/30 transition-colors h-full">
                <CardContent className="p-4">
                  <div className="flex items-start gap-3">
                    <div className="w-8 h-8 rounded-md bg-primary/10 flex items-center justify-center shrink-0">
                      <Icon className="w-4 h-4 text-primary" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-foreground flex items-center gap-1.5">
                        {link.title}
                        <ExternalLink className="w-3 h-3 text-muted-foreground" />
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5">{link.desc}</div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            </a>
          );
        })}
      </div>
    </div>
  );
}
