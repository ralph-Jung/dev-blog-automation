# blog-publish Gotchas

스킬 사용 시 발생한 실패 지점과 해결 방법을 기록합니다.
이 파일은 시간이 지나면서 계속 업데이트됩니다.

---

## 1. Velog MCP `write_post` 한글 인코딩 에러 (2026-03-24)

**증상**: `velog-mcp`의 `write_post`로 한글이 포함된 긴 본문 전송 시 에러 발생
```
Cannot convert argument to a ByteString because the character at index 15 has a value of 65533
```

**원인**: `velog-mcp@latest` (`stoneHee99/velog-mcp`) 패키지 내부에서 UTF-8 한글 문자열을 ByteString으로 변환할 때 인코딩이 깨짐

**해결**: Velog MCP를 사용하지 않고, `lib/velog-client.ts`에서 Velog GraphQL API를 직접 호출하도록 변경.

**교훈**: Velog MCP는 읽기(get_user_posts, search_posts 등)에만 사용하고, 쓰기(write_post)는 `lib/velog-client.ts`의 `publishToVelog()`로 직접 GraphQL API를 호출할 것.

---

## 2. Velog GraphQL API 엔드포인트는 v2 (2026-03-24)

**증상**: `https://v3.velog.io/graphql`로 요청 시 Status 200이지만 빈 응답 (content-length: 0)

**원인**: Velog GraphQL API의 올바른 엔드포인트는 `https://v2.velog.io/graphql`이다. v3는 동작하지 않음.

**해결**: `lib/velog-client.ts`의 URL을 `https://v2.velog.io/graphql`로 변경.

**교훈**: `stoneHee99/velog-mcp` 소스코드를 참고하여 정확한 엔드포인트를 확인할 것.

---

## 3. Velog 인증은 Cookie 방식 (Bearer 아님) (2026-03-24)

**증상**: `Authorization: Bearer {token}` 헤더로 요청 시 빈 응답

**원인**: Velog API는 Cookie 기반 인증을 사용함. `Cookie: access_token={token}` 형식이어야 함.

**해결**: `lib/velog-client.ts`에서 `Cookie` 헤더로 토큰 전달.

**교훈**:
- 인증 형식: `Cookie: access_token={token}`
- `operationName`을 request body에 반드시 포함
- writePost mutation 필드 타입은 `String` (not `String!`) + `meta: JSON`, `token: String`, `thumbnail: String` 추가 필요

---

## 4. Velog Access Token 만료 (2026-03-24)

**증상**: GraphQL 호출 시 빈 응답 또는 `null` 반환, 에러 메시지 없음

**원인**: Velog access_token은 약 1일 만료. `.env`에 저장된 토큰이 만료됨.

**해결**: 브라우저에서 Velog 로그인 → 개발자도구 > Application > Cookies에서 `access_token` 복사 → `.env` 갱신.

**교훈**: 발행 실패 시 먼저 토큰 만료 여부를 확인할 것. `.env`의 토큰과 `.mcp.json`의 토큰은 별도 관리됨.

---

## 5. 썸네일 이미지: 로컬 경로는 Velog에서 인식 불가 (2026-03-24)

**증상**: 본문에 `![thumbnail](/Users/.../thumbnails/image.png)` 삽입해도 Velog에서 이미지 표시 안 됨

**원인**: Velog는 외부에서 접근 가능한 URL만 이미지로 인식함. 로컬 파일 경로는 불가.

**해결**: GitHub public 레포에 이미지 push → raw URL 사용.
```
https://raw.githubusercontent.com/ralph-Jung/dev-blog-automation/main/thumbnails/{filename}.png
```

**교훈**:
- GitHub 레포는 반드시 **public**이어야 raw URL 접근 가능
- 새 썸네일 생성 시 `git push` 먼저 → 그 다음 블로그 발행
- `thumbnail-manager.ts`의 `ThumbnailResult.needsPush`가 `true`면 push 필요 신호

---

## 6. 블로그 본문에 Notion 출처 footer 넣지 않기 (2026-03-24)

**증상**: 사용자가 "이 글은 Notion 학습 노트를 기반으로 작성되었습니다" footer를 원하지 않음

**해결**: `velog-client.ts`의 `appendFooter()` 제거 완료. 템플릿에서도 제거.

**교훈**: 학습 노트 기반임을 드러내는 표현을 본문에 포함하지 말 것.

---

## 8. 썸네일 캐시 확인 시 Glob 패턴 실패 (2026-03-24)

**증상**: `Glob("thumbnails/*")` 패턴으로 검색하면 "No files found" 반환. 실제로는 `thumbnails/operatingsystem.png`, `thumbnails/networkthumbnail.png` 등 파일이 존재함.

**원인**: 프로젝트 경로에 한글(`개발 블로그 mcp`)이 포함되어 있어 Glob 도구의 `thumbnails/*` 직접 경로 패턴이 매칭에 실패함. `**/*.png` 재귀 패턴은 동작함.

**해결**: 썸네일 캐시 확인 시 `Glob("**/*.png")`로 검색하거나 `Bash("ls thumbnails/")`를 사용.

**교훈**: 한글 경로 프로젝트에서는 Glob의 직접 경로 패턴(`폴더/*`)이 불안정함. `**/*.png` 같은 재귀 패턴은 정상 동작하므로 이를 사용할 것.

---

## 9. ts-node -e 인라인 스크립트에서 타입 에러 (2026-03-24)

**증상**: `npx ts-node -e "const { publishToVelog } = require('./lib/velog-client'); ..."` 실행 시 `TS7006: Parameter implicitly has an 'any' type` 에러 발생

**원인**: `tsconfig.json`에 `strict: true` 설정이 있고, `require()`는 반환 타입이 `any`이므로 `.then((result) => ...)` 콜백의 파라미터 타입을 추론할 수 없음. `include`가 `lib/**/*.ts`만 포함하므로 인라인 스크립트는 strict 체크 대상이지만 타입 정보가 없음.

**해결**: 인라인 `-e` 스크립트 대신, `lib/` 디렉토리에 임시 실행 스크립트 `.ts` 파일을 생성하여 `import`로 타입을 자동 추론하게 하거나, 불가피할 경우 `--transpileOnly` 옵션을 사용.

**교훈**: 이 프로젝트에서 Velog 발행 등 lib 모듈을 호출할 때는 반드시 `import`로 타입이 추론되는 `.ts` 파일을 통해 실행할 것. `require()` + 인라인 스크립트 조합은 strict 모드에서 타입 에러를 유발함.

---

## 7. 미리보기 축약 금지 (2026-03-24)

**증상**: 발행 전 미리보기를 보여줄 때 본문을 `...`으로 축약하여 사용자가 전체 내용을 확인할 수 없었음

**교훈**: 발행 전 미리보기 시 **전체 본문**을 보여줄 것. 축약하지 말 것.
