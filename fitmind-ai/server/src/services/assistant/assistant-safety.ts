import { loadServerEnv } from "../../env.js";
import {
  emptyEvidence,
  type AssistantStructuredAnswer,
} from "./assistant-answer-composer.js";

export type AssistantSafetyBoundary = "none" | "medical_boundary";

export type AssistantSafetyReason =
  | "acute_pain"
  | "ambiguous_pain_or_symptom"
  | "red_flag_symptom"
  | "medication_request"
  | "diagnosis_or_treatment_request";

export interface AssistantSafetyClassification {
  boundary: AssistantSafetyBoundary;
  reason: AssistantSafetyReason | null;
}

const NO_SAFETY_BOUNDARY: AssistantSafetyClassification = {
  boundary: "none",
  reason: null,
};

const RED_FLAG_PATTERN =
  /胸口|胸痛|胸闷|喘不上气|呼吸困难|头晕|晕倒|快晕|麻木|发麻|无力|失去知觉|心悸|shortness\s*of\s*breath|chest\s*(pain|tightness)|dizz(?:y|iness)|faint|numb(?:ness)?|weakness/u;
const MEDICATION_PATTERN =
  /止痛药|消炎药|布洛芬|芬必得|阿司匹林|吃什么药|用什么药|painkiller|ibuprofen|aspirin|medication|medicine/u;
const DIAGNOSIS_OR_TREATMENT_PATTERN =
  /是不是.*(撕裂|拉伤|骨折|脱臼|韧带|半月板|炎症)|怎么治|治疗|康复处方|康复计划|诊断|确诊|需不需要手术|rehab|treat(?:ment)?|diagnos(?:e|is)|prescription/u;
const ACUTE_PAIN_PATTERN =
  /现在.*(疼|痛|不舒服|刺痛|剧痛)|一.*就.*(疼|痛|不舒服|刺痛|剧痛)|训练时.*(疼|痛|不舒服|刺痛|剧痛)|刚.*(疼|痛|扭|拉伤)|突然.*(疼|痛|不舒服|刺痛|剧痛)|sharp\s*pain|severe\s*pain|acute\s*pain|hurts?\s*(when|during|now)/u;
const PAIN_OR_SYMPTOM_PATTERN =
  /疼|痛|不舒服|刺痛|剧痛|扭伤|拉伤|肿|肿胀|麻|头晕|恶心|pain|hurt|ache|discomfort|swollen|strain|sprain|numb|dizzy/u;
const SORENESS_PATTERN = /酸痛|酸|sore|soreness/u;
const SORENESS_STRIP_PATTERN = /酸痛|酸|sore(?:ness)?/gu;
const SORENESS_SEVERITY_PATTERN =
  /越来越|加重|严重|持续|无法缓解|剧烈|worsen(?:ing)?|severe|persistent|won't\s*go\s*away/u;
const CURRENT_OR_RECURRENCE_PATTERN =
  /现在|最近|这几天|这两天|又|还是|复发|开始疼|now|recent(?:ly)?|again|recurr(?:ed|ing|ence)|still/u;
const CHRONIC_PLANNING_PATTERN =
  /避开|避免|少安排|不要安排|伤病约束|档案约束|加到伤病|injury\s*constraint|avoid/u;

/**
 * Classify whether a message crosses the assistant's medical safety boundary.
 *
 * The tie-break is intentionally conservative: current or recurring pain wins
 * over old-injury wording. Pure DOMS/soreness is exempt only when it has no
 * severity marker and no other pain/symptom token after soreness words are
 * removed.
 *
 * @param message - User message text.
 * @returns Safety classification for the message.
 */
export function classifyAssistantSafety(
  message: string,
): AssistantSafetyClassification {
  const normalizedMessage = message.trim();

  if (normalizedMessage === "") {
    return NO_SAFETY_BOUNDARY;
  }

  if (RED_FLAG_PATTERN.test(normalizedMessage)) {
    return { boundary: "medical_boundary", reason: "red_flag_symptom" };
  }

  if (MEDICATION_PATTERN.test(normalizedMessage)) {
    return { boundary: "medical_boundary", reason: "medication_request" };
  }

  if (DIAGNOSIS_OR_TREATMENT_PATTERN.test(normalizedMessage)) {
    return {
      boundary: "medical_boundary",
      reason: "diagnosis_or_treatment_request",
    };
  }

  if (ACUTE_PAIN_PATTERN.test(normalizedMessage)) {
    return { boundary: "medical_boundary", reason: "acute_pain" };
  }

  if (isPureSorenessMessage(normalizedMessage)) {
    return NO_SAFETY_BOUNDARY;
  }

  if (hasPainOrSymptom(normalizedMessage)) {
    if (CURRENT_OR_RECURRENCE_PATTERN.test(normalizedMessage)) {
      return {
        boundary: "medical_boundary",
        reason: "ambiguous_pain_or_symptom",
      };
    }

    if (!CHRONIC_PLANNING_PATTERN.test(normalizedMessage)) {
      return {
        boundary: "medical_boundary",
        reason: "ambiguous_pain_or_symptom",
      };
    }
  }

  return NO_SAFETY_BOUNDARY;
}

function hasPainOrSymptom(message: string): boolean {
  return (
    PAIN_OR_SYMPTOM_PATTERN.test(message) || SORENESS_PATTERN.test(message)
  );
}

function isPureSorenessMessage(message: string): boolean {
  if (
    !SORENESS_PATTERN.test(message) ||
    SORENESS_SEVERITY_PATTERN.test(message)
  ) {
    return false;
  }

  const withoutSoreness = message.replace(SORENESS_STRIP_PATTERN, "");

  return !PAIN_OR_SYMPTOM_PATTERN.test(withoutSoreness);
}

/**
 * Whether the deterministic medical safety gate is enabled.
 *
 * @returns True unless ASSISTANT_SAFETY_GATE is explicitly disabled.
 */
export function isAssistantSafetyGateEnabled(): boolean {
  return loadServerEnv().assistantSafetyGate;
}

/**
 * Compose the fixed safety response. This copy is deterministic and never goes
 * through an LLM, so it cannot diagnose, prescribe, or invent medical detail.
 *
 * @param classification - Safety classification that triggered the response.
 * @returns Structured unsupported answer for the safety boundary.
 */
export function composeMedicalSafetyAnswer(
  classification: AssistantSafetyClassification,
): AssistantStructuredAnswer {
  void classification;

  return {
    summary:
      "听起来这可能涉及疼痛、伤病或医疗判断。我不能诊断原因、判断严重程度，或给出用药和治疗建议。",
    bullets: [
      "如果疼痛正在发生、突然加重，或伴随胸闷、呼吸困难、头晕、麻木等症状，请优先停止训练并尽快寻求医生或急救帮助。",
      "在专业人士确认前，不建议继续用训练计划去硬顶这个症状。",
    ],
    conclusion: "FitMind 可以帮助调整训练记录和计划约束，但不能替代医疗评估。",
    recommendation:
      "等急性问题处理后，你可以把稳定的伤病限制写进训练档案，例如 knee、shoulder 或需要避开的动作，我会在训练计划里按约束保守处理。",
    evidence: emptyEvidence,
    sources: [],
    intent: "unsupported",
    limitations: [
      "这是安全边界提示，不是医疗诊断、治疗方案、用药建议或康复处方。",
    ],
  };
}
