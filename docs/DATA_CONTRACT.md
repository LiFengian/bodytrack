# BodyTrack 数据协议：计划 1.0、记录 1.3、备份 1.2

三个独立文件类型：

| 用途 | 类型标记 | Schema | 示例 |
| --- | --- | --- | --- |
| 导入训练建议 | `schemaVersion: "1.0"`，无 type | `dist/schemas/plan.schema.json` | `dist/examples/plan-v1.json`、`plan-v2.json` |
| 导出分析记录 | `type: "bodytrack.records"`，Schema 1.3 | `dist/schemas/records.schema.json` | `dist/examples/records-v1.3.json` |
| 完整备份恢复 | `type: "bodytrack.backup"`，Schema 1.2 | `dist/schemas/backup.schema.json` | `dist/examples/backup-v3.json` |

旧版记录和备份样本保留在 `dist/examples/`。备份 Schema 1.0、1.1、1.2 分别对应数据版本 1、2、3，恢复时校验两者的对应关系。

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

临时交换保存在相应启用记录的可选字段 `dayOverrides` 中。键是从本次启用起按零计数的训练周期位置，值是实际安排的训练日 ID。例如内置计划交换第一轮的肩部日和背部日后，此字段为 `{"1":"back","3":"shoulder"}`。同一轮内各训练日的出现次数和休息日的位置均保留。分析导出和备份都包含此字段，旧备份缺少此字段时使用计划原顺序。

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
- `sessions`、`cardio`、`meals`、`body` 按记录日期过滤。不会把未记录的数据填充成 0 或伪造缺失训练。
- 每条 session 的 `planKey`、`activationId` 和 `occurrenceIndex` 唯一定位周期；`makeupFor` 引用原跳过记录，原记录可能在导出范围之外。
- `exercises[].target` 为当时完整目标快照；`targetSets` 为当次实际采用的目标组数，可能低于计划完整组数。`sets[]` 保存每组唯一 ID、目标次数、实际值、侧别和完成状态。
- `journal` 保存主观感受。未录入数值使用 null 或省略；0 分疼痛不等于未知。
- 每条 meal 的 `per100` 是保存的营养来源快照。自 1.2.3 起，修改自定义食物会自动按稳定 `foodId` 更正所有关联餐食的名称、状态、来源和营养快照，覆盖历史日期；不修改实际克重、日期、餐次、记录 ID、创建时间和记录方式。启动时也检查并修复旧版本遗留的快照不同步，已同步则不重复写库。更正前快照与更新在同一 IndexedDB 事务中写入。`dailyNutrition`、CSV、报告与图表根据更正后的实际食用数据重算；缺失营养仍为 null，不按同名食物猜测关联。字段结构与 Schema 版本保持不变。
- 1.1 新条目可带 `sourceUrl`、`sourceDescription`、`catalogVersion`；`entryMethod` 为 `catalog`、`custom` 或 `photo-confirmed`；`portionBasis` 为 `weighed`、`manual-estimate` 或 `household-estimate`。选择数据库参考份量时附 `portionReference`（原始份量 ID、标签及克重）。这些均为向后兼容的可选字段，旧记录不回填、不改写；schemaVersion 保持 1.0。
- 汇总 `value` 在部分未知时仅为已知部分，`unknownCount` 为缺失条数，`complete` 表示该项所有饮食条目是否已知。全部未知为 null。
- `per100.totalSugars` 是每 100 g 的总糖（g）。未提供时按未知处理。汇总、饮食 CSV 和报告使用总糖。`settings.targets.totalSugars` 是用户设置的每日总糖上限（g），分析导出中对应 `nutritionTargets.totalSugars`。留空时仅统计摄入。旧版 `addedSugars` 值保存在完整备份中，当前餐食计算和分析导出使用总糖。
- `cycle.asOf` 为所选结束日；next 基于当前数据库中截至该日已完成/跳过记录计算，但日期调整是当前保存的调整，**不是完整的历史数据库时间旅行快照**。
- `mediaIncluded: false`，首版不管理媒体。

CSV 使用 UTF-8 BOM、CRLF、双引号转义，防止以 `= + - @` 开头的文本在表格应用中被当成公式。训练 CSV 一行对应一个侧别的一组，含训练日记 JSON；休息日也保留一行。饮食 CSV 的未知值写「未知」。JSON 保留未舍入的数值，CSV 也不在计算阶段截断。

## 爬楼梯有氧

`cardio` 是独立的已完成实际记录，不使用力量训练的 `activationId`、`occurrenceIndex`、组数或计划快照，不进入力量完成率分母。它可以与进行中的力量训练并存，不改变休息日或漏练周期。

```json
{
  "id": "a7d039bc-a343-43ee-a2ce-4d905139fc46",
  "type": "stair-climbing",
  "date": "2026-11-14",
  "mode": "stair-machine",
  "durationMinutes": 20,
  "floors": 35,
  "level": 5,
  "effort": "moderate",
  "notes": "虚构示例，不是训练建议",
  "createdAt": "2026-11-14T10:00:00.000Z",
  "updatedAt": "2026-11-14T10:00:00.000Z"
}
```

`mode` 为 `stairs`（楼梯）或 `stair-machine`（楼梯机）。`durationMinutes` 必填，范围 0.1–1440；`floors` 为累计层数，1–10000 整数或 null；`level` 为楼梯机档位，1–100 整数或 null，普通楼梯必须为 null。`effort` 可为 `easy`、`moderate`、`hard`、`veryHard` 或 null，表示主观感受，不是自动换算的 RPE/RIR。备注最多 10000 字符。

每条记录有稳定 ID；修改保留 ID 和 `createdAt`，更新 `updatedAt`。保存时拒绝未来日期；未填写指标保留 null，不估算热量、楼层或档位。有氧 CSV 单独导出，一行一次记录；JSON 和简明报告同时保留有氧及力量数据。每日趋势按记录日期合计分钟，不补零未记录日。

## 完整备份

恢复仅接受 `bodytrack.backup`，最大 50 MB。先 `parseBackup` → `migrateState` → `validateState`，预览记录数量，确认后原子替换。ID、计划/启用引用、侧别组序号、实际次数、RPE/RIR、营养数据、生熟状态、来源和设置都必须有效。

当前数据版本是 3。版本 1 迁移会补充空 `cardio` 列表，版本 2 迁移会保留原有记录。首次打开旧数据库时，原始数据作为「升级前」快照与新状态在同一事务中写入，修订号加一，最多保留 14 份快照。目录加载后，按稳定食物 ID、食用状态和来源补录旧 USDA 餐食缺少的糖字段。旧自定义食物的糖值可在食物库补填，关联餐食会自动重算。

完整备份可在支持相应 Schema 的应用版本中恢复。设备内快照独立存放。

## 发给 ChatGPT 的建议提示词

> 我会提供 BodyTrack records JSON 和当前 plan JSON。请仅根据真实记录分析训练完成情况、疲劳、颈肩状态、动作控制和营养数据完整性，不将未知营养当成 0。用户有轻度脊柱侧弯史，但 Cobb 角和方向未知，不从照片或自报数据诊断疾病、判断结构异常或指定单侧脊柱矫正。需要调整时，输出符合附件 plan.schema.json 的完整 JSON，将 planVersion 增加，并保留未改变动作的稳定 ID。胸、肩、背日下巴回收和胸椎伸展保留为独立热身；动作轻柔，避免强迫颈部后仰和腰部代偿。所有调整为训练建议，最终由用户审阅确认。缺少信息时先说明不确定性，不虚构训练、营养或医疗结论。
