export type ExportMessage = {
  role: string;
  content: string;
  model: string | null;
  createdAt: Date;
};

function headingText(value: string): string {
  return value.replace(/[\r\n]+/g, " ").trim().replace(/([\\`*_{}\[\]()#+.!|>])/g, "\\$1") || "Conversation";
}

export function conversationMarkdown(title: string, createdAt: Date, messages: ExportMessage[]): string {
  const sections = [
    `# ${headingText(title)}`,
    `Exported from AqizaAI · ${createdAt.toISOString()}`,
    "",
    ...messages.flatMap((message) => {
      const speaker = message.role === "user" ? "You" : "AqizaAI";
      const modelLabel = message.model ? ` · ${message.model.replace(/[\r\n]/g, " ")}` : "";
      return [`## ${speaker}${modelLabel}`, "", message.content, ""];
    }),
  ];
  return `${sections.join("\n").trimEnd()}\n`;
}

export function conversationExportFilename(title: string): string {
  const slug = title.normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 72)
    .toLowerCase();
  return `${slug || "aqizaai-conversation"}.md`;
}
