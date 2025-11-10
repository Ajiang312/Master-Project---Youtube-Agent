import { DashboardLayout } from "@/components/DashboardLayout";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { AIChat } from "@/components/dashboard/AIChat";
import { ContentSuggestions } from "@/components/dashboard/ContentSuggestions";
import { Eye, Users, ThumbsUp, Clock } from "lucide-react";

const Index = () => {
  return (
    <DashboardLayout>
      <div className="space-y-6 animate-in fade-in duration-500">
        <div>
          <h1 className="text-3xl font-bold bg-gradient-primary bg-clip-text text-transparent">
            Tableau de bord
          </h1>
          <p className="text-muted-foreground mt-1">
            Gérez votre contenu YouTube avec l'IA
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatsCard
            title="Vues totales"
            value="1.2M"
            change="+12.5% ce mois"
            changeType="positive"
            icon={Eye}
          />
          <StatsCard
            title="Abonnés"
            value="45.2K"
            change="+2.3K ce mois"
            changeType="positive"
            icon={Users}
          />
          <StatsCard
            title="Engagement"
            value="8.5%"
            change="+0.5% ce mois"
            changeType="positive"
            icon={ThumbsUp}
          />
          <StatsCard
            title="Temps de visionnage"
            value="2.5K h"
            change="-2.1% ce mois"
            changeType="negative"
            icon={Clock}
          />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-[500px]">
            <AIChat />
          </div>
          <div className="lg:col-span-1">
            <ContentSuggestions />
          </div>
        </div>
      </div>
    </DashboardLayout>
  );
};

export default Index;
