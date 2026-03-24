/**
 * Velog 발행 클라이언트
 * Velog 비공식 GraphQL API를 직접 호출하여 블로그 발행
 */

import https from "https";
import { FormattedTitle } from "./title-formatter";
import { ThumbnailResult } from "./thumbnail-manager";
import { loadConfig } from "./config";

const VELOG_GRAPHQL_URL = "https://v2.velog.io/graphql";

export interface PublishPayload {
  title: string;
  body: string;
  tags: string[];
  url_slug: string;
  is_private: boolean;
  series_id?: string;
}

export interface PublishInput {
  formattedTitle: FormattedTitle;
  markdownBody: string;
  thumbnail: ThumbnailResult;
  extraTags?: string[];
  seriesId?: string;
  isPrivate?: boolean;
}

export interface PublishResult {
  id: string;
  title: string;
  url_slug: string;
  url: string;
}

/** 썸네일 이미지를 본문 상단에 삽입 */
function prependThumbnail(body: string, thumbnail: ThumbnailResult): string {
  if (thumbnail.source === "placeholder") {
    return body;
  }
  return `![thumbnail](${thumbnail.url})\n\n${body}`;
}

/** 태그 정제: 중복 제거, 공백 트림, 빈 문자열 제거 */
function cleanTags(tags: string[]): string[] {
  const seen = new Set<string>();
  return tags
    .map((t) => t.trim())
    .filter((t) => {
      if (!t || seen.has(t.toLowerCase())) return false;
      seen.add(t.toLowerCase());
      return true;
    });
}

/** 발행용 페이로드 생성 */
export function buildPublishPayload(input: PublishInput): PublishPayload {
  const { formattedTitle, markdownBody, thumbnail, extraTags, seriesId, isPrivate } = input;

  let body = prependThumbnail(markdownBody, thumbnail);

  const allTags = [...formattedTitle.tags, ...(extraTags || [])];

  return {
    title: formattedTitle.title,
    body,
    tags: cleanTags(allTags),
    url_slug: formattedTitle.slug,
    is_private: isPrivate ?? false,
    ...(seriesId ? { series_id: seriesId } : {}),
  };
}

/** Velog GraphQL API로 글 발행 */
export async function publishToVelog(payload: PublishPayload): Promise<PublishResult> {
  const config = loadConfig();

  const query = `
    mutation WritePost(
      $title: String
      $body: String
      $tags: [String]
      $is_markdown: Boolean
      $is_temp: Boolean
      $is_private: Boolean
      $url_slug: String
      $thumbnail: String
      $meta: JSON
      $series_id: ID
      $token: String
    ) {
      writePost(
        title: $title
        body: $body
        tags: $tags
        is_markdown: $is_markdown
        is_temp: $is_temp
        is_private: $is_private
        url_slug: $url_slug
        thumbnail: $thumbnail
        meta: $meta
        series_id: $series_id
        token: $token
      ) {
        id
        url_slug
        user {
          id
          username
        }
      }
    }
  `;

  const variables = {
    title: payload.title,
    body: payload.body,
    tags: payload.tags,
    is_markdown: true,
    is_temp: false,
    is_private: payload.is_private,
    url_slug: payload.url_slug,
    thumbnail: null,
    meta: {},
    series_id: payload.series_id || null,
    token: null,
  };

  const requestBody = JSON.stringify({
    operationName: "WritePost",
    query,
    variables,
  });

  const responseData = await httpPost(VELOG_GRAPHQL_URL, requestBody, {
    "Content-Type": "application/json",
    Cookie: `access_token=${config.velogAccessToken}`,
  });

  const parsed = JSON.parse(responseData);

  if (parsed.errors) {
    throw new Error(`Velog API 에러: ${JSON.stringify(parsed.errors)}`);
  }

  const post = parsed.data.writePost;
  const username = post.user?.username || config.velogUsername;

  return {
    id: post.id,
    title: post.title,
    url_slug: post.url_slug,
    url: `https://velog.io/@${username}/${post.url_slug}`,
  };
}

/** HTTPS POST 헬퍼 */
function httpPost(
  url: string,
  body: string,
  headers: Record<string, string>
): Promise<string> {
  return new Promise((resolve, reject) => {
    const parsed = new URL(url);
    const options = {
      hostname: parsed.hostname,
      path: parsed.pathname + parsed.search,
      method: "POST",
      headers: {
        ...headers,
        "Content-Length": Buffer.byteLength(body, "utf-8").toString(),
      },
    };

    const req = https.request(options, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (chunk) => chunks.push(chunk));
      res.on("end", () => resolve(Buffer.concat(chunks).toString("utf-8")));
    });

    req.on("error", reject);
    req.setTimeout(30000, () => {
      req.destroy(new Error("Velog API 요청 타임아웃 (30초)"));
    });
    req.write(body, "utf-8");
    req.end();
  });
}

// CLI 테스트
if (require.main === module) {
  const args = process.argv.slice(2);

  if (args[0] === "publish") {
    // 테스트 발행: npx ts-node lib/velog-client.ts publish
    const testPayload: PublishPayload = {
      title: "테스트 글",
      body: "테스트 본문입니다.",
      tags: ["test"],
      url_slug: "test-post",
      is_private: true,
    };

    publishToVelog(testPayload)
      .then((result) => {
        console.log("발행 성공:", result);
      })
      .catch((err) => {
        console.error("발행 실패:", err.message);
      });
  } else {
    // 페이로드 생성 테스트
    const payload = buildPublishPayload({
      formattedTitle: {
        title: "[운영체제] 1장 : 서론",
        slug: "운영체제-1장-서론",
        tags: ["운영체제", "서론"],
      },
      markdownBody: "## 운영체제란?\n\n운영체제는 컴퓨터 하드웨어를 관리하는 소프트웨어입니다.",
      thumbnail: { url: "https://example.com/thumb.png", localPath: null, cached: false, source: "placeholder", needsPush: false },
      extraTags: ["CS"],
    });

    console.log("=== 발행 페이로드 ===");
    console.log(JSON.stringify(payload, null, 2));
  }
}
