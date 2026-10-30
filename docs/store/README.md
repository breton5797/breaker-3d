# BREAKER 3D 스토어 출시 안내서

준비 완료(코드): 안드로이드 서명·`.aab` CI, iOS 출시 설정(iPhone 전용)·아카이브/업로드 스크립트, 스토어 문구(`listing.md`),
설문 답안(`forms.md`), 스크린샷·그래픽(`screenshots/`, `feature-graphic.png`), 개인정보 처리방침(한·영, 문의 메일).
아래는 **대표님 계정에서 해야 하는 일**을 순서대로 적은 것. 🔁 표시는 값을 Claude에게 알려 주면 이어서 처리하는 단계.

## 0. 먼저 (5분)
1. 터미널에서 `! gh auth login -h github.com` — GitHub 토큰이 만료돼 푸시·PR이 막혀 있음.
2. 이 PR을 머지(웹 배포 포함) — `Android release` 워크플로는 main에 있어야 실행 버튼이 생김.

## 1. AdMob (광고 ID 발급) 🔁
1. admob.google.com 가입 → 결제(지급) 정보·세금 정보 입력.
2. 앱 추가 ×2: Android "BREAKER 3D", iOS "BREAKER 3D" (아직 스토어에 없음 → "아니요"로 등록, 출시 후 스토어 연결).
3. 각 앱에 **보상형** 광고 단위 1개씩 생성.
4. 개인정보 및 메시지 > **GDPR 동의 메시지** 생성·게시(두 앱), iOS는 **IDFA 설명 메시지**도 게시 권장.
5. Claude에게 4개 값 전달(비밀 아님): Android 앱 ID(`ca-app-pub-…~…`), Android 보상형 단위(`…/…`), iOS 앱 ID, iOS 보상형 단위,
   그리고 게시자 ID(`pub-…`) → Claude가 GitHub 저장소 변수 등록 + `app-ads.txt` 게시까지 처리.
   - `app-ads.txt`는 스토어에 적은 웹사이트의 **도메인 루트**에 있어야 함 → `https://breton5797.github.io/app-ads.txt`
     (사용자 사이트 저장소 `breton5797.github.io`를 새로 만들어 올림 — Claude가 할 수 있음).
6. 테스트: 운영 광고를 직접 누르지 말 것(계정 정지 사유). 개발 빌드는 Google 테스트 광고로 동작.

## 2. Google Play
1. **업로드 키** 만들기 (한 번): `! bash scripts/release/android-keystore.sh --secrets`
   → `~/.breaker3d-release/`에 키 생성 + GitHub Secrets 등록. **이 폴더를 꼭 백업**(비밀번호 관리자/USB).
2. Play Console > 앱 만들기: 이름 BREAKER 3D, 기본 언어 한국어, 게임, 무료.
3. 번들 빌드: GitHub > Actions > **Android release** > Run workflow
   - `version_code`: 1부터, 올릴 때마다 +1
   - AdMob 값이 아직 없으면 `test_ads` 체크(내부 테스트용) — 프로덕션 제출 전에는 반드시 실제 ID로 다시 빌드
   - 끝나면 아티팩트 `breaker3d-release-aab-N`의 `app-release.aab`를 받음
4. 테스트 > **내부 테스트**에 `.aab` 업로드(Play 앱 서명 사용 동의) → 본인 기기로 설치 확인.
5. 수익 창출 > 제품 > 인앱 상품 > `remove_ads` 생성(`listing.md` 표). Play 결제 프로필(판매자 계정) 먼저 만들어야 함.
   (결제 권한이 들어간 번들이 한 번 업로드돼야 상품 메뉴가 열림 — 4번 이후에 진행)
6. 앱 콘텐츠: `forms.md` 1·3·5절 그대로 입력. 스토어 등록정보: `listing.md` + 스크린샷 `screenshots/play-*.jpg`,
   그래픽 이미지 `feature-graphic.png`, 아이콘 512×512는 `public/icon-512.png`.
7. **비공개 테스트(필수)**: 2023-11-13 이후 만든 **개인** 개발자 계정은 테스터 **12명 이상이 14일 연속** 비공개 테스트에 참여해야
   프로덕션 신청 가능(조직 계정·D-U-N-S는 면제). 테스터 Gmail 12개 이상을 목록에 넣고 참여 링크 공유 → 14일 뒤 "프로덕션 액세스 신청".
   ※ 기준은 Play Console 도움말(answer 14151465)에서 최신 확인.
8. 프로덕션 출시 → 심사(보통 수일).

## 3. App Store
1. developer.apple.com > Certificates, IDs & Profiles > Identifiers > **App ID 등록**: `com.minimalkorea.breaker3d`
   (Capabilities: In-App Purchase 기본 포함). **Team ID**(Membership 페이지)를 메모.
2. App Store Connect > 비즈니스(계약/세금/은행): **유료 앱 계약** 동의 + 세금·은행 정보 — 없으면 인앱 결제가 안 됨.
3. EU 디지털서비스법 **판매자(Trader) 신고**: 판매자로 신고하면 주소·전화·이메일이 EU 스토어에 공개됨.
   원치 않으면 출시 국가에서 EU를 빼고 시작해도 됨(결정 필요).
4. 나의 앱 > 새로운 앱: iOS, 이름 BREAKER 3D, 기본 언어 한국어, 번들 ID 위 값, SKU `breaker3d`.
5. Xcode > Settings > Accounts에 Apple ID 로그인(한 번). 그다음 업로드:
   ```
   ! APPLE_TEAM_ID=팀ID ADMOB_APP_ID_IOS=… ADMOB_REWARDED_IOS=… bash scripts/release/ios-release.sh
   ```
   AdMob 값이 없으면 `ADMOB_…` 대신 `TEST_ADS=1`(TestFlight 전용). 빌드 번호는 자동(날짜시각).
6. TestFlight에서 본인 기기 설치·확인(동의 → 추적 허용 팝업 → 보상형 광고 → 광고 제거 구매는 샌드박스 계정).
7. 앱 내 구입 > 비소모성 `remove_ads` 생성(`listing.md`), 심사용 스크린샷 첨부, 첫 버전에 **함께 제출**로 연결.
8. 앱 정보: `listing.md`(이름·부제·설명·키워드·URL), 앱 개인정보 보호 `forms.md` 2절, 연령 등급 3절,
   스크린샷 `screenshots/ios-*.jpg`(6.9인치, iPhone 전용이라 iPad 불필요), 심사 메모 4절 → 심사 제출.

## 4. 국내 관련
- 등급: 두 스토어의 등급 설문(IARC / Apple)이 국내 게임물 등급분류를 대신함(자체등급분류사업자). 웹판은 광고·결제 없음 → 기존 판단 유지.
- 인앱 판매 수익이 생기므로 사업자등록·통신판매업 신고 여부는 세무 상담 권장(스토어 판매자 정보와 일치시켜야 함).

## 5. 이후 업데이트
- `package.json`의 `version`을 올림(예 1.0.1) → Android release 워크플로(`version_code` +1) / `ios-release.sh` 재실행.
- 스토어 문구 다른 언어(일·중·스페인어 등)는 국가별 데이터를 보고 추가.
