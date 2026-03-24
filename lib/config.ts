import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "..", ".env") });

export interface Config {
  velogAccessToken: string;
  velogUsername: string;
  notionToken?: string;
  geminiApiKey?: string;
}

function getRequiredEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`필수 환경변수 ${name}이(가) 설정되지 않았습니다. .env 파일을 확인하세요.`);
  }
  return value;
}

export function loadConfig(): Config {
  return {
    velogAccessToken: getRequiredEnv("VELOG_ACCESS_TOKEN"),
    velogUsername: getRequiredEnv("VELOG_USERNAME"),
    notionToken: process.env.NOTION_TOKEN,
    geminiApiKey: process.env.GEMINI_API_KEY,
  };
}

// CLI 직접 실행 시 검증 테스트
if (require.main === module) {
  try {
    const config = loadConfig();
    console.log("✅ 환경변수 로딩 성공");
    console.log(`  VELOG_USERNAME: ${config.velogUsername}`);
    console.log(`  VELOG_ACCESS_TOKEN: ${config.velogAccessToken.slice(0, 20)}...`);
    console.log(`  NOTION_TOKEN: ${config.notionToken ? config.notionToken.slice(0, 20) + "..." : "미설정"}`);
    console.log(`  GEMINI_API_KEY: ${config.geminiApiKey ? "설정됨" : "미설정"}`);
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
