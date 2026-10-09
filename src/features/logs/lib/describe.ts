import {
  OPERATION_TARGET_LABEL,
  OPERATION_TYPE,
  OPERATION_TYPE_GROUP,
  OPERATION_TYPE_GROUP_OF,
  OPERATION_TYPE_LABEL,
  type OperationType,
  type OperationTypeGroup,
} from '@/config/constants';

/**
 * 一条日志怎么读（W10）。
 *
 * **纯函数、单独一个文件**：日志页要靠它把「一行数据库记录」变成一句人话，
 * 而这句话的规则会随操作类型增长 —— 放进组件里就只能靠肉眼看，放进这里就能单测。
 *
 * 句子拆成三段（`prefix` / `target` / `suffix`）而不是一整句：设计稿把**对象名**加粗，
 * 而加粗是界面的事，所以这里只给出「哪一段是对象」。
 */
export type OperationSentence = {
  /** 主语（操作人）之后、对象之前 */
  prefix: string;
  /** 被操作的对象名（界面会加粗） */
  target: string;
  /** 对象之后的部分 */
  suffix: string;
};

export type DescribedOperation = {
  group: OperationTypeGroup;
  /** 类型标签（下拉与「第二行」都用它） */
  typeLabel: string;
  sentence: OperationSentence;
  /** 第二行的尾巴：`回收中 → 已暂停`、`CSV · 342 份` 这类补充 */
  extra: string | null;
};

type Detail = Record<string, unknown>;

export function describeOperation(input: {
  type: string;
  targetName: string;
  detail: unknown;
}): DescribedOperation {
  const type = input.type as OperationType;
  const detail = (input.detail ?? {}) as Detail;
  const name = input.targetName || OPERATION_TARGET_LABEL.QUESTIONNAIRE;
  const typeLabel = OPERATION_TYPE_LABEL[type] ?? input.type;

  const build = (prefix: string, target: string, suffix: string): OperationSentence => ({
    prefix,
    target,
    suffix,
  });

  switch (type) {
    case OPERATION_TYPE.PUBLISH:
      return {
        group: OPERATION_TYPE_GROUP_OF.PUBLISH,
        typeLabel,
        sentence: build('发布了问卷', name, ''),
        extra: detail.version ? String(detail.version) : null,
      };

    case OPERATION_TYPE.PAUSE:
      return {
        group: OPERATION_TYPE_GROUP_OF.PAUSE,
        typeLabel,
        sentence: build('暂停了问卷', name, '的回收'),
        extra: '回收中 → 已暂停',
      };

    case OPERATION_TYPE.RESUME:
      return {
        group: OPERATION_TYPE_GROUP_OF.RESUME,
        typeLabel,
        sentence: build('恢复了问卷', name, '的回收'),
        extra: '已暂停 → 回收中',
      };

    case OPERATION_TYPE.CLOSE:
      return {
        group: OPERATION_TYPE_GROUP_OF.CLOSE,
        typeLabel,
        sentence: build('截止了问卷', name, '的回收'),
        extra: '截止后不可重开',
      };

    case OPERATION_TYPE.ROLLBACK:
      return {
        group: OPERATION_TYPE_GROUP_OF.ROLLBACK,
        typeLabel,
        sentence: build('把问卷', name, '回滚到了旧版本'),
        extra: detail.from ? `恢复到 ${String(detail.from)}` : null,
      };

    case OPERATION_TYPE.SETTINGS:
      return {
        group: OPERATION_TYPE_GROUP_OF.SETTINGS,
        typeLabel,
        sentence: build('修改了问卷', name, '的发布设置'),
        extra: null,
      };

    case OPERATION_TYPE.CHANNEL_CREATE:
      return {
        group: OPERATION_TYPE_GROUP_OF.CHANNEL_CREATE,
        typeLabel,
        sentence: build('为问卷', name, '新建了渠道'),
        extra:
          [detail.channel, detail.src ? `?src=${String(detail.src)}` : null]
            .filter(Boolean)
            .join(' · ') || null,
      };

    case OPERATION_TYPE.RESPONSE_INVALIDATE:
    case OPERATION_TYPE.RESPONSE_RESTORE:
      return {
        group: OPERATION_TYPE_GROUP_OF[type],
        typeLabel,
        sentence: build(
          type === OPERATION_TYPE.RESPONSE_INVALIDATE ? '把问卷' : '把问卷',
          name,
          type === OPERATION_TYPE.RESPONSE_INVALIDATE
            ? `的答卷 #${String(detail.serial ?? '')} 标记为无效`
            : `的答卷 #${String(detail.serial ?? '')} 恢复为有效`,
        ),
        // 标记无效会改变统计结果，第二行说明这一点
        extra:
          type === OPERATION_TYPE.RESPONSE_INVALIDATE ? '统计图不再计入它' : '统计图重新计入它',
      };

    case OPERATION_TYPE.EXPORT:
      return {
        group: OPERATION_TYPE_GROUP_OF.EXPORT,
        typeLabel,
        sentence: build('导出了问卷', name, '的答卷数据'),
        extra: `CSV${detail.rows === undefined ? '' : ` · ${String(detail.rows)} 份`}`,
      };

    case OPERATION_TYPE.INVITE:
      return {
        group: OPERATION_TYPE_GROUP_OF.INVITE,
        typeLabel,
        sentence: build('邀请', String(detail.email ?? name), '加入工作区'),
        extra: `${String(detail.role ?? '')} · 等待接受`,
      };

    case OPERATION_TYPE.INVITE_REVOKE:
      return {
        group: OPERATION_TYPE_GROUP_OF.INVITE_REVOKE,
        typeLabel,
        sentence: build('撤回了发给', String(detail.email ?? name), '的邀请'),
        extra: null,
      };

    case OPERATION_TYPE.MEMBER_JOIN:
      return {
        group: OPERATION_TYPE_GROUP_OF.MEMBER_JOIN,
        typeLabel,
        sentence: build('', name, ' 接受了邀请，加入工作区'),
        extra: String(detail.role ?? '') || null,
      };

    case OPERATION_TYPE.MEMBER_ROLE:
      return {
        group: OPERATION_TYPE_GROUP_OF.MEMBER_ROLE,
        typeLabel,
        sentence: build('把成员', name, '的角色改了'),
        extra: detail.from && detail.to ? `${String(detail.from)} → ${String(detail.to)}` : null,
      };

    case OPERATION_TYPE.MEMBER_REMOVE:
      return {
        group: OPERATION_TYPE_GROUP_OF.MEMBER_REMOVE,
        typeLabel,
        sentence: build('把成员', name, '移出了工作区'),
        extra: String(detail.email ?? '') || null,
      };

    case OPERATION_TYPE.ARCHIVE:
      return {
        group: OPERATION_TYPE_GROUP_OF.ARCHIVE,
        typeLabel,
        sentence: build('归档了问卷', name, ''),
        extra: '数据只读保留',
      };

    case OPERATION_TYPE.RESTORE:
      return {
        group: OPERATION_TYPE_GROUP_OF.RESTORE,
        typeLabel,
        sentence: build('恢复了问卷', name, ''),
        extra: null,
      };

    case OPERATION_TYPE.COPY:
      return {
        group: OPERATION_TYPE_GROUP_OF.COPY,
        typeLabel,
        sentence: build('复制了问卷', name, ''),
        extra: '副本是新的草稿',
      };

    case OPERATION_TYPE.IMPORT:
      return {
        group: OPERATION_TYPE_GROUP_OF.IMPORT,
        typeLabel,
        sentence: build('给问卷', name, '导入了 JSON 结构'),
        extra: null,
      };

    case OPERATION_TYPE.DELETE:
      return {
        group: OPERATION_TYPE_GROUP_OF.DELETE,
        typeLabel,
        sentence: build('删除了问卷', name, ''),
        // 删除是不可逆的，份数要留在日志里 —— 事后想找回「删掉的那份有多少答卷」只有这一处
        extra: typeof detail.responses === 'number' ? `含 ${detail.responses} 份答卷` : null,
      };

    case OPERATION_TYPE.TEMPLATE_RENAME:
      return {
        group: OPERATION_TYPE_GROUP_OF.TEMPLATE_RENAME,
        typeLabel,
        sentence: build('把模板', name, '改了名'),
        extra: detail.to ? `改为「${String(detail.to)}」` : null,
      };

    case OPERATION_TYPE.TEMPLATE_DELETE:
      return {
        group: OPERATION_TYPE_GROUP_OF.TEMPLATE_DELETE,
        typeLabel,
        sentence: build('删除了模板', name, ''),
        extra: typeof detail.questions === 'number' ? `${detail.questions} 题` : null,
      };

    case OPERATION_TYPE.TEMPLATE_PUBLISH:
      return {
        group: OPERATION_TYPE_GROUP_OF.TEMPLATE_PUBLISH,
        typeLabel,
        sentence: build('把模板', name, '公开到了公开池'),
        extra: detail.category ? `分类：${String(detail.category)}` : null,
      };

    case OPERATION_TYPE.TEMPLATE_UNPUBLISH:
      return {
        group: OPERATION_TYPE_GROUP_OF.TEMPLATE_UNPUBLISH,
        typeLabel,
        sentence: build('把模板', name, '从公开池收回了'),
        extra: null,
      };

    default:
      // 兜底也要能读：类型随里程碑增长，漏一个不该让整页显示空白
      return {
        group: OPERATION_TYPE_GROUP.QUESTIONNAIRE,
        typeLabel,
        sentence: build('对问卷', name, `执行了「${typeLabel}」`),
        extra: null,
      };
  }
}

/** 操作人缺失时（成员被移除后 actor 会置空）用这个占位，不能显示空白 */
export const UNKNOWN_ACTOR = '已离职成员';
