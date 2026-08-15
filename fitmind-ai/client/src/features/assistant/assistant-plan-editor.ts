import type {
  AssistantPlanDraft,
  AssistantPlanExerciseAlternative,
  AssistantPlanSession,
  AssistantPlannedExercise,
} from "./assistant-types";

export type EditableExercisePatch = Partial<
  Pick<AssistantPlannedExercise, "sets" | "repMin" | "repMax" | "restSeconds">
>;

export function getEditablePlanSessions(
  plan: AssistantPlanDraft,
): AssistantPlanSession[] {
  if (plan.sessions && plan.sessions.length > 0) return plan.sessions;

  return [
    {
      sessionIndex: 1,
      title: "本周目标动作",
      focusAreas: [],
      estimatedDurationMinutes: estimateDuration(plan.exercises),
      exercises: plan.exercises,
    },
  ];
}

export function updatePlanExercise(
  plan: AssistantPlanDraft,
  sessionIndex: number,
  exerciseIndex: number,
  patch: EditableExercisePatch,
): AssistantPlanDraft {
  return updateSessionExercise(
    plan,
    sessionIndex,
    exerciseIndex,
    (exercise) => ({
      ...exercise,
      ...patch,
    }),
  );
}

export function deletePlanExercise(
  plan: AssistantPlanDraft,
  sessionIndex: number,
  exerciseIndex: number,
): AssistantPlanDraft {
  const sessions = getEditablePlanSessions(plan)
    .map((session) =>
      session.sessionIndex === sessionIndex
        ? {
            ...session,
            exercises: session.exercises.filter(
              (_, index) => index !== exerciseIndex,
            ),
          }
        : session,
    )
    .filter((session) => session.exercises.length > 0);

  return rebuildPlan(plan, sessions);
}

export function replacePlanExercise(
  plan: AssistantPlanDraft,
  sessionIndex: number,
  exerciseIndex: number,
  alternative: AssistantPlanExerciseAlternative,
): AssistantPlanDraft {
  return updateSessionExercise(
    plan,
    sessionIndex,
    exerciseIndex,
    (exercise) => ({
      exerciseId: alternative.exerciseId,
      exerciseName: alternative.exerciseName,
      sets: exercise.sets,
      repMin: exercise.repMin,
      repMax: exercise.repMax,
      targetWeightKg: null,
      restSeconds: alternative.restSeconds,
      equipment: alternative.equipment,
      movementPattern: alternative.movementPattern,
      primaryMuscles: alternative.primaryMuscles,
      alternatives: (exercise.alternatives ?? []).filter(
        (item) => item.exerciseId !== alternative.exerciseId,
      ),
      basis: "由你替换为同模式或同目标肌群动作；暂无该动作重量基线。",
    }),
  );
}

function updateSessionExercise(
  plan: AssistantPlanDraft,
  sessionIndex: number,
  exerciseIndex: number,
  updater: (exercise: AssistantPlannedExercise) => AssistantPlannedExercise,
): AssistantPlanDraft {
  const sessions = getEditablePlanSessions(plan).map((session) => {
    if (session.sessionIndex !== sessionIndex) return session;
    const exercises = session.exercises.map((exercise, index) =>
      index === exerciseIndex ? updater(exercise) : exercise,
    );
    return { ...session, exercises };
  });

  return rebuildPlan(plan, sessions);
}

function rebuildPlan(
  plan: AssistantPlanDraft,
  sessions: AssistantPlanSession[],
): AssistantPlanDraft {
  const normalizedSessions = sessions.map((session, index) => ({
    ...session,
    sessionIndex: index + 1,
    title: session.title.startsWith("训练日")
      ? `训练日 ${index + 1}`
      : session.title,
    estimatedDurationMinutes: estimateDuration(session.exercises),
  }));

  return {
    ...plan,
    sessions: normalizedSessions,
    exercises: normalizedSessions.flatMap((session) => session.exercises),
  };
}

function estimateDuration(exercises: AssistantPlannedExercise[]): number {
  const seconds = exercises.reduce(
    (total, exercise) =>
      total +
      exercise.sets * 45 +
      Math.max(0, exercise.sets - 1) * (exercise.restSeconds ?? 90),
    5 * 60,
  );
  return Math.max(15, Math.ceil(seconds / 300) * 5);
}
