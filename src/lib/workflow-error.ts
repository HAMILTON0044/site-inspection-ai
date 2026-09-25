import "server-only";

type DatabaseError = {
  code?: string;
  message?: string;
};

const messageMap: Array<[string, string]> = [
  ["Only an active manager", "只有已激活的 Manager 可以执行此操作。"],
  ["Assignee must be", "负责人必须是该项目中已激活的巡检员。"],
  ["Closed findings", "已关闭问题需要先重新打开。"],
  ["without an assignee", "当前状态的问题必须保留负责人。"],
  ["Assign the finding", "请先为问题指定负责人。"],
  ["workflow transition", "当前账号不能执行这次状态转换。"],
  ["corrective follow-up", "请先添加整改跟进说明。"],
  ["Verification decisions", "复核关闭或重新打开时必须填写说明。"],
  ["corrective photo evidence", "高风险问题关闭前必须提供整改照片。"],
  ["in-progress finding", "只有整改中的问题可以提交复核。"],
  ["assignee or a manager", "只有负责人或 Manager 可以提交复核。"],
  ["photo object is missing", "整改照片上传不完整，请重试。"],
  ["Follow-up ID already exists", "本次跟进已经提交，请勿重复操作。"],
];

export function getWorkflowErrorResponse(
  error: DatabaseError,
  fallback: string,
) {
  const translated = messageMap.find(([fragment]) =>
    error.message?.includes(fragment),
  )?.[1];

  if (error.code === "P0002") {
    return { status: 404, message: "问题不存在或无权操作。" };
  }
  if (error.code === "42501") {
    return { status: 403, message: translated ?? "当前账号无权执行此操作。" };
  }
  if (error.code === "22023" || error.code === "23505") {
    return { status: 400, message: translated ?? "提交内容不符合业务规则。" };
  }

  return { status: 500, message: fallback };
}
