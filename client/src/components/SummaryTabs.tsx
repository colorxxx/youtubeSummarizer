import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Streamdown } from "streamdown";

interface SummaryTabsProps {
  summary: string;
  detailedSummary: string | null;
  className?: string;
}

export function SummaryTabs({ summary, detailedSummary, className }: SummaryTabsProps) {
  return (
    <Tabs defaultValue="brief" className={className ?? "w-full"}>
      <TabsList className="grid w-full grid-cols-2">
        <TabsTrigger value="brief">간단 요약</TabsTrigger>
        <TabsTrigger value="detailed">상세 요약</TabsTrigger>
      </TabsList>
      <TabsContent value="brief" className="mt-4">
        <div className="prose prose-sm max-w-none">
          <Streamdown>{summary}</Streamdown>
        </div>
      </TabsContent>
      <TabsContent value="detailed" className="mt-4">
        <div className="prose prose-sm max-w-none">
          <Streamdown>{detailedSummary || summary}</Streamdown>
        </div>
      </TabsContent>
    </Tabs>
  );
}
