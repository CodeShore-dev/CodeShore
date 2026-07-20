# NestJS 使用說明

這份文件記錄 `apps/backend` 用了哪些 NestJS 功能、為什麼用、以及目前刻意不用某些功能的原因，供任何人（不限維護者）檢視這個後端的架構決策。內容會隨著實作變動更新；如果程式碼與這裡描述的不一致，以程式碼為準。

## 套件總覽

| 套件 | 用途 | 位置 |
|---|---|---|
| `@nestjs/common` / `@nestjs/core` / `@nestjs/platform-express` | 核心框架、DI、Express adapter | 全專案 |
| `@nestjs/config` | 啟動時驗證必要環境變數 | `app.module.ts` |
| `@nestjs/cache-manager` | 快取後端（包在自製 `CacheService` 之下） | `libs/service-cache` |
| `@nestjs/schedule` | Cron job（目前僅一個：快取 metadata 定期清理） | `libs/service-cache` |
| `@nestjs/serve-static` | 服務前端靜態檔 | `libs/service-serve-static` |
| `@nestjs/swagger` | API 文件（`/api` 下的 Swagger UI） | `libs/service-utils` + 各 controller |
| `@nestjs/throttler` | 全域 API 速率限制 | `app.module.ts` |
| `@nestjs/terminus` | `/api/health` 存活檢查 | `features/health` |
| `@nestjs/testing` | 單元測試 | 各 `*.spec.ts` |

## 核心請求生命週期

```
Middleware (TraceContextMiddleware)
  → Guards (ThrottlerGuard → AuthGuard → PermissionGuard → QueryLimitGuard → AdminGuard)
  → Interceptor 前段 (InboundInterceptor：記錄 request、開始計時)
  → Pipe (全域 ValidationPipe：DTO 驗證/轉型)
  → Controller → Service
  → Interceptor 後段 (InboundInterceptor：記錄 response、包成 {code,message,data})
  → Exception Filter (AllExceptionsFilter：任何例外的最終出口)
```

### Guards：認證、授權、流量限制

- `AuthGuard`：解析 Bearer token，呼叫 Supabase 驗證，把 `user` 掛到 `request` 上。搭配 `@Public()`（完全略過驗證）與 `@OptionalAuth()`（有 token 就驗、沒有就當 guest）兩種例外。
- `AdminGuard` / `PermissionGuard`：目前兩者的檢查邏輯完全相同（都是 `isAdminEmail(user.email)`），共用 `AdminEmailGuard` 抽象基底類別（`features/auth/admin-email.guard.ts`）處理共同的 Reflector/metadata/拋錯邏輯，各自只帶自己的 metadata key 與錯誤訊息 —— 保留成兩個決策點是為了未來可能出現「非 admin 但有特定權限」的情境時容易分岔，不代表現在邏輯有差異。
- `QueryLimitGuard`：限制 `from`/`to` 分頁區間大小（`@LimitQuery(n)`）。
- `ThrottlerGuard`：全域 IP 限流，預設每 60 秒 120 次請求（`app.module.ts` 的 `ThrottlerModule.forRoot`）。目前門檻是寫死的常數，之後如需依端點調整可用 `@Throttle()` 覆寫。

四個自訂 Guard 全部透過 `useFactory`/`inject` 註冊（見下方「DI 慣例」一節），只有 `ThrottlerGuard` 用 `useClass`。

### Interceptor / Filter / Pipe：透過 DI 註冊，而非 `app.useGlobalXxx()`

`InboundInterceptor`、`AllExceptionsFilter`、全域 `ValidationPipe` 都在 `libs/service-transport/src/transport.module.ts` 的 `TransportModule` 裡，用 `APP_INTERCEPTOR`/`APP_FILTER`/`APP_PIPE` token 註冊，`AppModule` 直接 `imports: [TransportModule]`。

這與最早的寫法（`libs/service-utils/src/lib/service-utils.ts` 裡手動 `app.useGlobalInterceptors(new InboundInterceptor(logger))`）不同：手動 `new` 出來的物件完全繞過 DI，`AllExceptionsFilter` 因此永遠拿不到 `ServiceLogger`，導致一個實際的可觀測性缺口——**Guard 丟出的例外（401 未登入、403 權限不足、400 分頁超限）完全不會被記錄**，因為 Guard 在 Nest 生命週期裡跑在 Interceptor 之前，`InboundInterceptor` 的 `catchError` 永遠攔不到它們。改成 DI 註冊後，`AllExceptionsFilter` 能注入 `ServiceLogger`，現在會記錄**每一個**例外（method、path、status、message），這個缺口已經補上。

## 一個比較嚴重、這次順便修好的既有 bug

`apps/backend` 的 dev/test 建置走 Vite（`vite.config.mts`，底層是 esbuild）；esbuild **不支援** `emitDecoratorMetadata`，即使 `tsconfig.app.json` 開著這個選項也沒用（esbuild 完全忽略它，因為它本來就不做型別檢查）。這代表：任何 controller / service / guard 如果靠「建構子參數型別」讓 Nest 自動注入依賴（也就是最常見的寫法：`constructor(private readonly service: Service) {}`，provider 用裸類別 `useClass`/`providers: [Service]` 註冊），在這條 pipeline 下 Nest 會拿不到型別 metadata，**靜默地**把每個參數當成 `undefined` 建構出來——不會報錯，只會在真正呼叫該方法時炸出 `TypeError: Cannot read properties of undefined`。

`features/keyword-curation/module.ts` 原本就有一段很仔細的註解描述這個問題，但只套用在 `keyword-curation` 這個 feature，其餘 9 個 controller 與 7 個 bare-registered 的 feature-level Service（`app.service.ts`、`admin/service.ts`、`company/service.ts`、`job/service.ts`、`keyword/service.ts`、`job-filter-watchlist/service.ts`、`ai-suggestion/service.ts`）仍然是裸的建構子注入。實際寫一個最小重現測試（`NestFactory.create` + 真的打一個 HTTP request）直接證實：**在這條 pipeline 下，幾乎每個 controller 的每個請求都會 500**，只是正式環境的 `build-lambda` target 用真正的 `tsc`（見 `apps/backend/project.json`，`compiler: "tsc"`）編譯，metadata 有正確發出，才沒被線上流量踩到；`nx serve backend`（本地開發用的指令）跟 `nx test backend` / Vitest 用的都是 esbuild，理論上會撞到同一個問題。

修法（已套用到所有受影響的 controller/service，以及原本就有問題但沒被注意到的四個 auth guard）：

- **Controller**：Nest 的 `controllers` 陣列沒有 `useFactory` 這個選項，所以改成在建構子參數上加 `@Inject(Token)` 明確指定 token（例如 `constructor(@Inject(Service) private readonly service: Service)`）。`@Inject()` 是直接呼叫裝飾器把 token 存進 metadata，不依賴 TypeScript 的型別反射，所以不受 esbuild 這個限制影響。
- **Guard / 部分 Service**：延續 `provideWithLogger`（見下一節）已經在用的模式，在對應的 `module.ts` 用 `useFactory`/`inject` 明確列出依賴。

驗證方式：寫了幾個一次性的 smoke test（起真的 Nest app、打真的 HTTP request，測完就刪掉），確認 guard chain 正確擋下未帶 token 的請求（401/403）、公開端點正確打到資料庫拿回真實資料（200 + 真實 Supabase 資料），而不是原本的 500。

## DI 慣例：為什麼很多 provider 用 `useFactory`/`inject` 而不是裸類別

上面這個 bug 的根本原因，也是這個專案原本就存在、但只套用不完整的慣例：

- `provideWithLogger(SomeDataUtilsService)`（`features/logger-provider.ts`）：幾乎所有 `@codeshore/data-utils` 的 service 都需要一個可選的 `ServiceLogger`，這個 helper 把 `{ provide: X, useFactory: (logger) => new X(logger), inject: [ServiceLogger] }` 包成一行呼叫，全專案的 `module.ts` 都在用。
- `features/keyword-curation/module.ts` 的一整組 `xxxProvider`：這個 feature 的 service/graph node 建構子參數故意宣告成 `Pick<SomeClass, 'method'>` 或裸 interface（縮小依賴介面，只暴露真正用到的方法），這種型別在 TypeScript 編譯後一律變成 `Object`，就算用真正的 `tsc` 也無法還原成具體 class，所以這個 feature 從一開始就必須用 `useFactory`/`inject`，不能靠自動注入。

現在的原則是：**只要是這個 repo 自己寫的 class，一律不依賴 Nest 的自動型別注入**——provider 用 `useFactory`/`inject`，controller 用 `@Inject()`。第三方套件（例如 `Reflector`、`ThrottlerGuard`、`HealthCheckService`）本身是預編譯好的 JS，metadata 是它們自己的建置流程（通常是真正的 `tsc`）發出並固化在套件裡的，不受這個 repo 的 esbuild 影響，可以放心用裸 `useClass`——已經個別驗證過。

## 自製 Cache 系統：為什麼不直接用 `@nestjs/cache-manager` 內建的裝飾器

`@nestjs/cache-manager` 只被當底層 store 用（`ServiceCacheModule`），實際的 `@Cacheable`/`@CacheEvict` 裝飾器、`X-Cache` response header、`/api/cache` 底下的管理端點（列出所有快取項目、依 key 清除、清全部、記憶體用量）全是 `libs/service-cache` 自己寫的。原因是這些管理功能（誰在什麼時候寫入了什麼 key、多大、還剩多久過期）並不是 Nest 內建 `CacheInterceptor` 提供的東西，如果只用內建裝飾器會失去這些能力,所以維持自製。

`CacheService` 內部的 `meta` map 只是這個管理介面的簿記，不影響底層 cache-manager 本身的真實過期行為；為了避免 `meta` 因為沒人呼叫 `list()`/`invalidate()` 而無限成長，加了一個 `@Cron(CronExpression.EVERY_10_MINUTES)` 定期清理過期項目——這是全專案唯一的排程工作，純內部簿記，沒有任何外部副作用。

## 刻意不做的事

- **不會自動排程 crawl / refresh-mv**：`@nestjs/schedule` 裝了，但 `admin/controller.ts` 的 `crawl`/`refresh-mv` 兩個 SSE 端點目前刻意維持「admin 手動觸發」——crawl 會對外部求職網站發送大量請求，refresh-mv 是重的資料庫操作,自動排程涉及頻率、風險、對外部站台的禮貌爬取限制等產品面決策,不是單純的工程選擇,所以留給 admin 手動決定何時執行。
- **不用 `@nestjs/passport`**：認證直接呼叫 Supabase 的 `auth.getUser(token)`,不透過 Passport strategy——因為信任來源本來就是 Supabase,多一層 Passport 抽象沒有額外好處。

## 這次一併補上的其他項目

- **`@nestjs/config`**：`ConfigModule.forRoot({ isGlobal: true, validate })`（`app.module.ts` + `config/environment-variables.ts`）用 `class-validator` 驗證 `SUPABASE_URL`/`SUPABASE_SERVICE_ROLE_KEY` 等必要環境變數,啟動時就失敗,不用等到第一個打到 Supabase 的請求才炸出「Missing Supabase credentials」。注意：`libs/supabase`、`libs/ai-client`、`libs/crawler-core` 這些共用 lib 仍然直接讀 `process.env`,沒有改用 `ConfigService`——因為它們同時被 `apps/crawler`（不是 Nest 應用,沒有 DI container）共用,不能只為了 backend 改寫。
- **`@nestjs/throttler`**：見上方 Guards 一節。
- **`@nestjs/terminus`**：新增 `GET /api/health`（`features/health`），只檢查 heap 用量，不打資料庫,單純給 Cloud Run / Lambda 的存活探測用。
- **CORS 收斂**：`app.enableCors()` 原本沒帶設定,等於任何來源的瀏覽器 JS 都能讀到 API 回應。正式環境的前端跟 API 是同一個 origin（`ServeStaticModule` 直接服務前端靜態檔）,只有本地開發（Vite dev server 在 4200/4300 port）才需要跨 origin,所以收斂成白名單：`https://codeshore.dev` + `http://localhost:4200` + `http://localhost:4300`,可用 `CORS_ORIGINS`（逗號分隔）環境變數再擴充。這只影響瀏覽器端的跨來源讀取限制,不是存取控制機制本身——curl/Postman/server-to-server 呼叫本來就不受 CORS 約束。
- **移除死碼**：`libs/service-cache` 的 `CacheStatusInterceptor` 從沒被任何地方引用過,它做的事（設定 `X-Cache` header）已經被全域的 `InboundInterceptor` 做掉了,直接刪除。

## 已知限制 / 之後可以考慮的方向

- 目前的速率限制門檻（120 req/min/IP）是憑經驗設的常數,沒有依端點區分公開讀取 API 跟 admin 端點,之後如果需要更細的控制可以用 `@Throttle()` 個別覆寫。
- `@nestjs/config` 只做了啟動驗證,沒有進一步把 `process.env` 讀取換成 `ConfigService` 注入——這是刻意的取捨（見上方說明）,不是遺漏。
