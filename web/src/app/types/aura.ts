export type SentimentLabel = "pos" | "neg" | "neu";

export type ChatReply = {
  reply: string;
  sentiment: { score: number; label: SentimentLabel };
  urgent: boolean;
  conversation_id: string;
  message_id: string;
};

export type Bubble = {
  who: "you" | "bot";
  text: string;
  meta?: { sentiment?: SentimentLabel; urgent?: boolean };
};

export type FAQ = {
  id: string;
  question: string;
  answer: string;
  tags: string[];
};

export type Summary = {
  volume: number;
  sentiment_trend: { pos: number; neu: number; neg: number };
  top_issues: [string, number][];
  churn: { by_customer: { customer_id: string; risk: number }[] };
};
