import {
  IsArray,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
} from 'class-validator';

/**
 * Handoff file schema (Requirement 3.1, 3.3). Produced by a user-triggered,
 * Claude computer-use-assisted capture of a Cloudflare-blocked list page, and
 * consumed by `apps/crawler`'s handoff ingestion path (task 2.2 onward) to
 * resume normal job-collection progress for that source without an in-band
 * browser fetch of the blocked page.
 *
 * Field shapes here are a boundary contract (`HandoffFileSchema`, see
 * design.md) shared by the loader/validator (task 2.2) and the
 * full/degraded conversion logic (tasks 2.3-2.5) -- do not add fields beyond
 * what design.md's "Data Models" JSON examples show without revisiting
 * requirements 3.1/3.3.
 */

/** Job sources this handoff mechanism currently supports (Requirement 1.2). */
export type HandoffHost = 'cake.me' | '104.com.tw';

/**
 * `full`: `rawResponse` carries the source's existing `JobsAPIResponse` shape
 * verbatim, reusing the source's own `parsePagination`/`extractItems` logic
 * (Requirement 2.1). `degraded`: only the minimum viable per-item fields were
 * obtainable in reasonable time/operations, captured as `minimalItems`
 * (Requirement 2.2).
 */
export type HandoffCaptureMode = 'full' | 'degraded';

export interface HandoffFile {
  host: HandoffHost;
  pages: HandoffPage[];
}

export interface HandoffPage {
  sourceUrl: string;
  pageIndex: number;
  totalPages: number;
  captureMode: HandoffCaptureMode;
  /** captureMode === 'full' 時必填：對應來源既有 JobsAPIResponse 原始形狀，逐筆欄位不做深層驗證。 */
  rawResponse?: unknown;
  /** captureMode === 'degraded' 時必填，逐筆通過 class-validator 驗證。 */
  minimalItems?: HandoffMinimalItem[];
}

/**
 * Must be a class (not an interface) so `class-validator`'s `validate()` /
 * `class-transformer`'s `plainToInstance()` can operate on it at runtime
 * (Requirement 3.3) -- this is what makes the degraded-capture minimum
 * viable dataset (Requirement 2.2) individually field-verifiable rather than
 * a same-shape-as-full assumption.
 */
export class HandoffMinimalItem {
  @IsUrl()
  url!: string;

  @IsString()
  @IsNotEmpty()
  title!: string;

  @IsString()
  @IsNotEmpty()
  location!: string;

  @IsString()
  @IsNotEmpty()
  companyName!: string;

  /** Cake 可省略（可由 url 結構推導公司 slug）；104 必填。 */
  @IsOptional()
  @IsString()
  companyId?: string;

  @IsOptional()
  @IsUrl()
  companyLink?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  tags?: string[];
}
