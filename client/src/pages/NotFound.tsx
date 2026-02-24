import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { AlertCircle, Home } from "lucide-react";
import { useLocation } from "wouter";

export default function NotFound() {
  const [, setLocation] = useLocation();

  return (
    <div className="min-h-full w-full flex items-center justify-center p-8">
      <Card className="w-full max-w-md bg-card border-border">
        <CardContent className="pt-8 pb-8 text-center">
          <div className="flex justify-center mb-6">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center">
              <AlertCircle className="h-8 w-8 text-destructive" />
            </div>
          </div>

          <h1 className="text-4xl font-bold text-foreground font-mono mb-2">404</h1>

          <h2 className="text-lg font-semibold text-foreground mb-3">
            页面未找到
          </h2>

          <p className="text-sm text-muted-foreground mb-6">
            请求的页面不存在或已被移除。
          </p>

          <Button
            onClick={() => setLocation("/")}
            variant="outline"
            className="border-primary/30 text-primary hover:bg-primary/10"
          >
            <Home className="w-4 h-4 mr-2" />
            返回 Dashboard
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
