# BodyTrack 数据协议 1.0

三个独立文件类型：

| 用途 | 类型标记 | Schema | 示例 |
| --- | --- | --- | --- |
| 导入训练建议 | `schemaVersion: "1.0"`，无 type | `dist/schemas/plan.schema.json` | `dist/examples/plan-v1.json`、`plan-v2.json` |
| 导出分析记录 | `type: "bodytrack.records"` | `dist/schemas/records.schema.json` | `dist/examples/records-v1.json` |
| 完整备份恢复 | `type: "bodytrack.backup"` | `dist/schemas/backup.schema.json` | `dist/examples/backup-v1.json` |

记录和备份示例是纯虚构测试数据，不是用户记录，食品数值不应作为营养参考。示例不会自动导入应用。`invalid-plan.json` 是必须拒绝的测试文件。

## 计划导入

必填：`schemaVersion`、`planId`、`planVersion`、`generatedAt`、`effectiveDate`、`name`、`cycleDefinition`、`trainingDays`、`instructions`、`precautions`。

`planId` 在同一计划谱系内保持稳定，`planVersion` 为递增正整数。已有 ID/版本组合不能覆盖写入。更高版本不会删除低版本。不同计划也可有不同 `planId`。

周期定义：

```json
{
  "name": "五分化 · 练二休一",
  "length": 15,
  "trainingDayIds": ["chest", "shoulder", null, "back", "arms", null, "legs", "chest", null, "shoulder", "back", null, "arms", "legs", null]
}
```

`null` 是休息日，其他项引用 `trainingDays[].id`。数组长度必须等于 length，至少一个训练日。同一训练日可以在周期多次引用。

动作示例：

```json
{
  "id": "chest-chin",
  "name": "下巴回收 Chin Tuck",
  "module": "warmup",
  "sets": 2,
  "repetitions": 10,
  "perSide": false,
  "holdSeconds": 5,
  "intensity": { "rirMin": 2, "rirMax": 4 },
  "instructions": "轻轻收回下巴，保持呼吸；每次保持 5 秒。",
  "precautions": "不强迫颈部后仰，不用力挤压颈部。"
}
```

动作 ID 在同一计划内唯一；跨版本对应的同一动作应尽量保留 ID，使差异比较可靠。替换成不同动作可分配新 ID。`perSide` 表示分别记录左右两侧，不表示单侧矫正建议。

JSON Schema 检查形状、范围和必填；`parsePlan`/`validatePlan` 另外检查 ID 唯一性、周期引用、数组长度、RIR 上下界及有效日期。最多 2 MB。所有说明视为文本转义显示，不能注入 HTML/脚本。

导入流程是选择文件 → 校验 → 预览完整 JSON 和差异 → 用户勾选确认 → 选择今天或未来日期 → 写入计划和启用事件。没有自动生效途径。启用日期以用户最终选择为准，保留原始建议文件的 effectiveDate；实际启用日期记录在 activation 中。若当前训练未结束，启用会被拒绝且计划保存事务整体回滚。

## 分析导出

`range` 是闭区间 YYYY-MM-DD 本地日历日期；`generatedAt`、`createdAt`、`exportedAt` 等使用 ISO 时间戳。

- `plans`、`activations`、`cycleAdjustments` 保留全部版本与时间线，便于解析训练引用。
- `sessions`、`meals`、`body` 按记录日期过滤。不会把未记录的数据填充成 0 或伪造缺失训练。
- 每条 session 的 `planKey`、`activationId` 和 `occurrenceIndex` 唯一定位周期；`makeupFor` 引用原跳过记录，原记录可能在导出范围之外。
- `exercises[].target` 为当时完整目标快照；`targetSets` 为当次实际采用的目标组数，可能低于计划完整组数。`sets[]` 保存每组唯一 ID、目标次数、实际值、侧别和完成状态。
- `journal` 保存主观感受。未录入数值使用 null 或省略；0 分疼痛不等于未知。
- 每条 meal 的 `per100` 是录入当时的来源快照。`dailyNutrition` 提供实际食用重量换算后的每日汇总。
- 1.1 新条目可带 `sourceUrl`、`sourceDescription`、`catalogVersion`；`entryMethod` 为 `catalog`、`custom` 或 `photo-confirmed`；`portionBasis` 为 `weighed`、`manual-estimate` 或 `household-estimate`。选择数据库参考份量时附 `portionReference`（原始份量 ID、标签及克重）。这些均为向后兼容的可选字段，旧记录不回填、不改写；schemaVersion 保持 1.0。
- 汇总 `value` 在部分未知时仅为已知部分，`unknownCount` 为缺失条数，`complete` 表示该项所有饮食条目是否已知。全部未知为 null。
- `cycle.asOf` 为所选结束日；next 基于当前数据库中截至该日已完成/跳过记录计算，但日期调整是当前保存的调整，**不是完整的历史数据库时间旅行快照**。
- `mediaIncluded: false`，首版不管理媒体。

CSV 使用 UTF-8 BOM、CRLF、双引号转义，防止以 `= + - @` 开头的文本在表格应用中被当成公式。训练 CSV 一行对应一个侧别的一组，含训练日记 JSON；休息日也保留一行。饮食 CSV 的未知值写「未知」。JSON 保留未舍入的数值，CSV 也不在计算阶段截断。

## 完整备份

恢复仅接受 `bodytrack.backup`，最大 50 MB。先 `parseBackup` → `migrateState` → `validateState`，预览记录数量，确认后原子替换。ID、计划/启用引用、侧别组序号、实际次数、RPE/RIR、营养数据、生熟状态、来源和设置都必须有效。

当前首次数据版本是 1，无旧版本需要转换。未来迁移应逐个版本执行，先保留迁移前快照，完成后重新校验；不得捕获迁移失败后偷偷初始化空数据库。备份内不包含设备内快照，以免递归膨胀。

## 发给 ChatGPT 的建议提示词

> 我会提供 BodyTrack records JSON 和当前 plan JSON。请仅根据真实记录分析训练完成情况、疲劳、颈肩状态、动作控制和营养数据完整性，不将未知营养当成 0。用户有轻度脊柱侧弯史，但 Cobb 角和方向未知，不从照片或自报数据诊断疾病、判断结构异常或指定单侧脊柱矫正。需要调整时，输出符合附件 plan.schema.json 的完整 JSON，将 planVersion 增加，并保留未改变动作的稳定 ID。胸、肩、背日下巴回收和胸椎伸展保留为独立热身；动作轻柔，避免强迫颈部后仰和腰部代偿。所有调整为训练建议，最终由用户审阅确认。缺少信息时先说明不确定性，不虚构训练、营养或医疗结论。
