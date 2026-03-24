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

**해결**: Velog MCP를 사용하지 않고, `lib/velog-client.ts`에서 Velog GraphQL API(`https://v3.velog.io/graphql`)를 직접 호출하도록 변경. `httpPost()`에서 `utf-8` 인코딩을 명시적으로 지정.

**교훈**: Velog MCP는 읽기(get_user_posts, search_posts 등)에만 사용하고, 쓰기(write_post)는 `lib/velog-client.ts`의 `publishToVelog()`로 직접 GraphQL API를 호출할 것.

추가 발견사항:
- Velog GraphQL 엔드포인트는 `https://v2.velog.io/graphql` (v3 아님!)
- 인증은 `Cookie: access_token=...` 형식 (Bearer 아님)
- `operationName`을 request body에 포함해야 함
- writePost mutation의 필드 타입은 `String` (not `String!`) + `meta: JSON`, `token: String`, `thumbnail: String` 추가 필요
- 직접 GraphQL 호출 시 한글 태그 정상 동작 확인됨

---

## 2. Velog Access Token 만료 (2026-03-24)

**증상**: `write_post` 호출 시 `null` 반환, 에러 메시지 없음

**원인**: Velog access_token은 약 1일 만료. `.mcp.json`에 하드코딩된 토큰이 만료됨.

**해결**: `mcp__velog__login`으로 토큰 갱신 후 재시도. 또는 `.env`의 토큰을 갱신.

**교훈**: 발행 실패 시 먼저 토큰 만료 여부를 확인할 것. `get_user_posts`가 성공해도 `write_post`는 실패할 수 있음 (읽기/쓰기 권한 차이).

---

## 3. 블로그 본문에 Notion 출처 footer 넣지 않기

**증상**: 사용자가 "이 글은 Notion 학습 노트를 기반으로 작성되었습니다" footer를 원하지 않음

**해결**: `velog-client.ts`의 `appendFooter()` 제거 완료. 템플릿에서도 제거.

**교훈**: 학습 노트 기반임을 드러내는 표현을 본문에 포함하지 말 것.
