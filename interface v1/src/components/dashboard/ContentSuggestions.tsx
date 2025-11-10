import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Lightbulb, TrendingUp } from "lucide-react";

const suggestions = [
  {
    id: 1,
    title: "10 astuces pour booster votre productivité",
    trend: "Tendance",
    engagement: "Haut",
  },
  {
    id: 2,
    title: "Tutoriel complet : Débuter avec...",
    trend: "Populaire",
    engagement: "Moyen",
  },
  {
    id: 3,
    title: "Ma routine matinale pour réussir",
    trend: "Viral",
    engagement: "Très haut",
  },
];

export function ContentSuggestions() {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Lightbulb className="w-5 h-5 text-accent" />
          Suggestions de Contenu
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {suggestions.map((suggestion) => (
            <div
              key={suggestion.id}
              className="p-4 rounded-lg bg-gradient-card border border-border hover:border-primary/50 transition-colors"
            >
              <div className="flex items-start justify-between gap-2">
                <div className="flex-1">
                  <h4 className="font-medium mb-2">{suggestion.title}</h4>
                  <div className="flex gap-2">
                    <Badge variant="secondary" className="text-xs">
                      <TrendingUp className="w-3 h-3 mr-1" />
                      {suggestion.trend}
                    </Badge>
                    <Badge variant="outline" className="text-xs">
                      {suggestion.engagement}
                    </Badge>
                  </div>
                </div>
                <Button size="sm" variant="outline">
                  Créer
                </Button>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
