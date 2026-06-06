export interface TrainingKnowledgeChunk {
  id: string;
  title: string;
  category: string;
  chunk_text: string;
  source_type: "seed";
  tags: string[];
}

export const trainingKnowledgeChunks: TrainingKnowledgeChunk[] = [
  {
    id: "rpe-basics",
    title: "RPE 主观用力程度",
    category: "training_concept",
    chunk_text:
      "RPE 是主观用力程度，用来描述一组训练离力竭还有多远。RPE 8 通常表示大约还能再做 2 次，适合用来控制训练强度。",
    source_type: "seed",
    tags: ["RPE", "强度", "主观用力程度"],
  },
  {
    id: "training-volume",
    title: "训练容量",
    category: "training_concept",
    chunk_text:
      "训练容量通常可以用组数、次数和重量组合观察。FitMind 中的容量统计来自训练记录，适合用来判断最近训练负荷和分布。",
    source_type: "seed",
    tags: ["训练容量", "训练量", "volume"],
  },
  {
    id: "progressive-overload",
    title: "渐进超负荷",
    category: "training_principle",
    chunk_text:
      "渐进超负荷指在恢复可承受的前提下，逐步提高重量、次数、组数或动作质量。它是力量和肌肥大进步的重要原则。",
    source_type: "seed",
    tags: ["渐进超负荷", "progressive overload", "进步", "没进步"],
  },
  {
    id: "bench-plateau",
    title: "卧推进步停滞",
    category: "exercise_progress",
    chunk_text:
      "卧推短期没进步可能和训练容量不足、强度安排单一、恢复不足或动作技术有关。判断停滞应结合多周训练记录，而不是单次训练表现。",
    source_type: "seed",
    tags: ["卧推", "停滞", "训练容量", "进步"],
  },
  {
    id: "deload",
    title: "Deload 减量周",
    category: "recovery",
    chunk_text:
      "Deload 是在一段高负荷训练后主动降低训练量或强度，让身体恢复。它通常用于疲劳累积、表现下降或训练压力较高时。",
    source_type: "seed",
    tags: ["deload", "减量周", "恢复"],
  },
  {
    id: "squat-knee-valgus",
    title: "深蹲膝盖内扣",
    category: "exercise_technique",
    chunk_text:
      "深蹲膝盖内扣常见原因包括髋外展控制不足、足部稳定性差、重量过重或动作路径不稳定。处理时应先降低重量并关注膝盖追踪方向。",
    source_type: "seed",
    tags: ["深蹲", "膝盖内扣", "动作技术"],
  },
  {
    id: "shoulder-press-errors",
    title: "肩推常见错误",
    category: "exercise_technique",
    chunk_text:
      "肩推常见错误包括过度后仰、耸肩代偿、手腕过度后伸和核心不稳。训练时应控制躯干稳定并让重量路径更垂直。",
    source_type: "seed",
    tags: ["肩推", "推肩", "常见错误"],
  },
  {
    id: "pull-up-cues",
    title: "引体向上动作要点",
    category: "exercise_technique",
    chunk_text:
      "引体向上应关注肩胛下沉、背阔肌发力和全程控制。不要只用手臂硬拉，也不要为了次数牺牲动作幅度。",
    source_type: "seed",
    tags: ["引体向上", "背部", "动作要点"],
  },
  {
    id: "fatigue-recovery",
    title: "训练疲劳和恢复判断",
    category: "recovery",
    chunk_text:
      "恢复判断不能只看训练日志，还应结合睡眠、酸痛、主观疲劳和疼痛信号。FitMind 只能基于已记录训练给出保守提醒。",
    source_type: "seed",
    tags: ["疲劳", "恢复", "训练建议"],
  },
];
