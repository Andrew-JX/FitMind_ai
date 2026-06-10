import {
  createProductFeedback,
  type ProductFeedbackRow,
} from "../db/product-feedback-repository.js";
import { HttpError } from "../utils/http-error.js";

export interface SubmitProductFeedbackInput {
  message?: string | null | undefined;
  rating?: number | null | undefined;
  sourceRoute?: string | null | undefined;
  userAgent?: string | null | undefined;
  userId: string;
}

export interface ProductFeedbackDto {
  createdAt: string;
  id: string;
  message: string | null;
  rating: number | null;
  sourceRoute: string | null;
}

interface ProductFeedbackDependencies {
  createFeedback: typeof createProductFeedback;
}

const defaultDependencies: ProductFeedbackDependencies = {
  createFeedback: createProductFeedback,
};

const EMPTY_FEEDBACK_MESSAGE = "请至少选择星级或填写反馈内容。";

export async function submitProductFeedback(
  input: SubmitProductFeedbackInput,
  dependencies: ProductFeedbackDependencies = defaultDependencies,
): Promise<ProductFeedbackDto> {
  const message = normalizeOptionalText(input.message);
  const sourceRoute = normalizeOptionalText(input.sourceRoute);
  const userAgent = normalizeOptionalText(input.userAgent);
  const rating = input.rating ?? null;

  if (rating === null && message === null) {
    throw new HttpError(400, "VALIDATION_ERROR", EMPTY_FEEDBACK_MESSAGE);
  }

  const row = await dependencies.createFeedback({
    message,
    rating,
    sourceRoute,
    userAgent,
    userId: input.userId,
  });

  return mapFeedbackRow(row);
}

function normalizeOptionalText(value: string | null | undefined): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  const trimmed = value.trim();

  return trimmed.length > 0 ? trimmed : null;
}

function mapFeedbackRow(row: ProductFeedbackRow): ProductFeedbackDto {
  return {
    createdAt: row.created_at,
    id: row.id,
    message: row.message,
    rating: row.rating,
    sourceRoute: row.source_route,
  };
}
