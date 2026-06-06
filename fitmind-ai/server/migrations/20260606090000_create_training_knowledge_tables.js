/**
 * @type {import('node-pg-migrate').ColumnDefinitions | undefined}
 */
export const shorthands = undefined;

const documents = [
  {
    slug: "rpe-basics",
    title: "RPE 主观用力程度",
    category: "training_concept",
    chunk:
      "RPE 是主观用力程度，用来描述一组训练离力竭还有多远。RPE 8 通常表示大约还能再做 2 次，适合用来控制训练强度。",
    tags: ["RPE", "强度", "主观用力程度"],
  },
  {
    slug: "training-volume",
    title: "训练容量",
    category: "training_concept",
    chunk:
      "训练容量通常可以用组数、次数和重量组合观察。FitMind 中的容量统计来自训练记录，适合用来判断最近训练负荷和分布。",
    tags: ["训练容量", "训练量", "volume"],
  },
  {
    slug: "progressive-overload",
    title: "渐进超负荷",
    category: "training_principle",
    chunk:
      "渐进超负荷指在恢复可承受的前提下，逐步提高重量、次数、组数或动作质量。它是力量和肌肥大进步的重要原则。",
    tags: ["渐进超负荷", "progressive overload", "进步", "没进步"],
  },
  {
    slug: "bench-plateau",
    title: "卧推进步停滞",
    category: "exercise_progress",
    chunk:
      "卧推短期没进步可能和训练容量不足、强度安排单一、恢复不足或动作技术有关。判断停滞应结合多周训练记录，而不是单次训练表现。",
    tags: ["卧推", "停滞", "训练容量", "进步"],
  },
  {
    slug: "deload",
    title: "Deload 减量周",
    category: "recovery",
    chunk:
      "Deload 是在一段高负荷训练后主动降低训练量或强度，让身体恢复。它通常用于疲劳累积、表现下降或训练压力较高时。",
    tags: ["deload", "减量周", "恢复"],
  },
  {
    slug: "squat-knee-valgus",
    title: "深蹲膝盖内扣",
    category: "exercise_technique",
    chunk:
      "深蹲膝盖内扣常见原因包括髋外展控制不足、足部稳定性差、重量过重或动作路径不稳定。处理时应先降低重量并关注膝盖追踪方向。",
    tags: ["深蹲", "膝盖内扣", "动作技术"],
  },
  {
    slug: "shoulder-press-errors",
    title: "肩推常见错误",
    category: "exercise_technique",
    chunk:
      "肩推常见错误包括过度后仰、耸肩代偿、手腕过度后伸和核心不稳。训练时应控制躯干稳定并让重量路径更垂直。",
    tags: ["肩推", "推肩", "常见错误"],
  },
  {
    slug: "pull-up-cues",
    title: "引体向上动作要点",
    category: "exercise_technique",
    chunk:
      "引体向上应关注肩胛下沉、背阔肌发力和全程控制。不要只用手臂硬拉，也不要为了次数牺牲动作幅度。",
    tags: ["引体向上", "背部", "动作要点"],
  },
  {
    slug: "fatigue-recovery",
    title: "训练疲劳和恢复判断",
    category: "recovery",
    chunk:
      "恢复判断不能只看训练日志，还应结合睡眠、酸痛、主观疲劳和疼痛信号。FitMind 只能基于已记录训练给出保守提醒。",
    tags: ["疲劳", "恢复", "训练建议"],
  },
];

/**
 * Create training knowledge tables for the first RAG MVP.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 * @returns {void}
 */
export const up = (pgm) => {
  pgm.createTable("knowledge_documents", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    slug: {
      type: "varchar(120)",
      notNull: true,
      unique: true,
    },
    title: {
      type: "varchar(200)",
      notNull: true,
    },
    category: {
      type: "varchar(80)",
      notNull: true,
    },
    source_type: {
      type: "varchar(40)",
      notNull: true,
      default: "seed",
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createTable("knowledge_chunks", {
    id: {
      type: "uuid",
      primaryKey: true,
      default: pgm.func("uuid_generate_v4()"),
    },
    document_id: {
      type: "uuid",
      notNull: true,
      references: '"knowledge_documents"',
      onDelete: "CASCADE",
    },
    chunk_index: {
      type: "integer",
      notNull: true,
    },
    chunk_text: {
      type: "text",
      notNull: true,
    },
    tags: {
      type: "jsonb",
      notNull: true,
      default: pgm.func("'[]'::jsonb"),
    },
    search_text: {
      type: "text",
      notNull: true,
    },
    created_at: {
      type: "timestamptz",
      notNull: true,
      default: pgm.func("now()"),
    },
  });

  pgm.createIndex("knowledge_documents", "category", {
    name: "idx_knowledge_documents_category",
  });
  pgm.createIndex("knowledge_chunks", "document_id", {
    name: "idx_knowledge_chunks_document",
  });

  for (const document of documents) {
    pgm.sql(`
      WITH inserted_document AS (
        INSERT INTO knowledge_documents (slug, title, category, source_type)
        VALUES (
          '${document.slug}',
          '${document.title}',
          '${document.category}',
          'seed'
        )
        RETURNING id
      )
      INSERT INTO knowledge_chunks (
        document_id,
        chunk_index,
        chunk_text,
        tags,
        search_text
      )
      SELECT
        id,
        0,
        '${document.chunk}',
        '${JSON.stringify(document.tags)}'::jsonb,
        '${[document.title, document.category, document.chunk, ...document.tags].join(" ")}'
      FROM inserted_document;
    `);
  }
};

/**
 * Roll back training knowledge tables.
 *
 * @param {import('node-pg-migrate').MigrationBuilder} pgm
 * @returns {void}
 */
export const down = (pgm) => {
  pgm.dropTable("knowledge_chunks", {
    ifExists: true,
  });
  pgm.dropTable("knowledge_documents", {
    ifExists: true,
  });
};
