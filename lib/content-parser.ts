/**
 * Notion API 블록을 마크다운으로 변환
 */

// Notion API 타입 (필요한 부분만 정의)
interface RichText {
  type: string;
  plain_text: string;
  annotations: {
    bold: boolean;
    italic: boolean;
    strikethrough: boolean;
    underline: boolean;
    code: boolean;
    color: string;
  };
  href: string | null;
}

interface NotionBlock {
  type: string;
  has_children: boolean;
  [key: string]: any;
}

/** rich_text 배열을 마크다운 문자열로 변환 */
function richTextToMarkdown(richTexts: RichText[]): string {
  return richTexts
    .map((rt) => {
      let text = rt.plain_text;
      if (!text) return "";
      if (rt.href) text = `[${text}](${rt.href})`;
      if (rt.annotations.code) text = `\`${text}\``;
      if (rt.annotations.bold) text = `**${text}**`;
      if (rt.annotations.italic) text = `*${text}*`;
      if (rt.annotations.strikethrough) text = `~~${text}~~`;
      return text;
    })
    .join("");
}

/** 단일 블록을 마크다운 라인으로 변환 */
function blockToMarkdown(block: NotionBlock, indent: number = 0): string {
  const prefix = "  ".repeat(indent);
  const content = block[block.type];

  if (!content) return "";

  switch (block.type) {
    case "paragraph": {
      const text = richTextToMarkdown(content.rich_text || []);
      return text ? `${prefix}${text}` : "";
    }

    case "heading_1": {
      const text = richTextToMarkdown(content.rich_text || []);
      return `## ${text}`;
    }

    case "heading_2": {
      const text = richTextToMarkdown(content.rich_text || []);
      return `### ${text}`;
    }

    case "heading_3": {
      const text = richTextToMarkdown(content.rich_text || []);
      return `#### ${text}`;
    }

    case "bulleted_list_item": {
      const text = richTextToMarkdown(content.rich_text || []);
      return `${prefix}- ${text}`;
    }

    case "numbered_list_item": {
      const text = richTextToMarkdown(content.rich_text || []);
      return `${prefix}1. ${text}`;
    }

    case "quote": {
      const text = richTextToMarkdown(content.rich_text || []);
      return `${prefix}> ${text}`;
    }

    case "code": {
      const text = richTextToMarkdown(content.rich_text || []);
      const lang = content.language || "";
      return `\`\`\`${lang}\n${text}\n\`\`\``;
    }

    case "divider":
      return "---";

    case "image": {
      const url =
        content.type === "external"
          ? content.external?.url
          : content.file?.url;
      const caption = content.caption?.length
        ? richTextToMarkdown(content.caption)
        : "";
      return url ? `![${caption}](${url})` : "";
    }

    case "callout": {
      const icon = content.icon?.emoji || "";
      const text = richTextToMarkdown(content.rich_text || []);
      return `> ${icon} ${text}`;
    }

    case "toggle": {
      const text = richTextToMarkdown(content.rich_text || []);
      return `<details>\n<summary>${text}</summary>\n</details>`;
    }

    case "to_do": {
      const text = richTextToMarkdown(content.rich_text || []);
      const checked = content.checked ? "x" : " ";
      return `${prefix}- [${checked}] ${text}`;
    }

    case "bookmark": {
      const url = content.url || "";
      const caption = content.caption?.length
        ? richTextToMarkdown(content.caption)
        : url;
      return `[${caption}](${url})`;
    }

    case "child_page":
    case "child_database":
      return ""; // 하위 페이지는 별도 처리

    default:
      return "";
  }
}

/** Notion 블록 배열을 마크다운 문자열로 변환 */
export function blocksToMarkdown(blocks: NotionBlock[], indent: number = 0): string {
  const lines: string[] = [];

  for (const block of blocks) {
    const line = blockToMarkdown(block, indent);
    if (line !== "") {
      lines.push(line);
    }
  }

  return lines.join("\n\n");
}

/** 마크다운에서 빈 줄 정리 */
export function cleanMarkdown(md: string): string {
  return md
    .replace(/\n{3,}/g, "\n\n") // 3줄 이상 공백 → 2줄
    .trim();
}

/** 마크다운에서 태그 추출 (볼드 키워드 기반) */
export function extractKeywords(blocks: NotionBlock[]): string[] {
  const keywords = new Set<string>();

  for (const block of blocks) {
    const content = block[block.type];
    if (!content?.rich_text) continue;

    for (const rt of content.rich_text as RichText[]) {
      if (rt.annotations.bold && rt.plain_text.length <= 20) {
        keywords.add(rt.plain_text.trim());
      }
    }
  }

  return Array.from(keywords);
}

// CLI 테스트
if (require.main === module) {
  const testBlocks: NotionBlock[] = [
    {
      type: "numbered_list_item",
      has_children: false,
      numbered_list_item: {
        rich_text: [
          {
            type: "text",
            plain_text: "OS는 여러 가지 프로그램을 프로세스라고 하는 단위로 실행",
            annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: "default" },
            href: null,
          },
        ],
      },
    },
    {
      type: "quote",
      has_children: false,
      quote: {
        rich_text: [
          {
            type: "text",
            plain_text: "다중 태스킹 시스템에서 운영체제는 적절한 응답 시간을 보장해야하기 때문에 가장 좋은 방법은 ",
            annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: "default" },
            href: null,
          },
          {
            type: "text",
            plain_text: "가상 메모리",
            annotations: { bold: true, italic: false, strikethrough: false, underline: false, code: false, color: "yellow_background" },
            href: null,
          },
          {
            type: "text",
            plain_text: "이다.",
            annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: "default" },
            href: null,
          },
        ],
      },
    },
    {
      type: "paragraph",
      has_children: false,
      paragraph: { rich_text: [] },
    },
    {
      type: "heading_2",
      has_children: false,
      heading_2: {
        rich_text: [
          {
            type: "text",
            plain_text: "멀티프로세싱",
            annotations: { bold: false, italic: false, strikethrough: false, underline: false, code: false, color: "default" },
            href: null,
          },
        ],
      },
    },
  ];

  const md = blocksToMarkdown(testBlocks);
  console.log("=== 변환된 마크다운 ===");
  console.log(cleanMarkdown(md));
  console.log("\n=== 추출된 키워드 ===");
  console.log(extractKeywords(testBlocks));
}
