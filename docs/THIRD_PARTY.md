# 第三方组件与数据来源 · BodyTrack 1.1

## GitHub 调研与复用

- [Microsoft ONNX Runtime](https://github.com/microsoft/onnxruntime)：复用 1.22.0 的浏览器 WASM 推理运行时，仅分发所需三个文件。MIT，原许可证及 ThirdPartyNotices 保存在 `dist/vendor/ort/`。
- [Microsoft TinyCLIP](https://github.com/microsoft/Cream/tree/main/TinyCLIP)：使用其 CLIP 图像文本候选分类方法与预训练模型。代码及所选模型采用 MIT；许可证在 `dist/models/TinyCLIP-LICENSE.txt`。不把这一通用模型称为经过 BodyTrack 专项训练的食品诊断模型。
- [NutriLens](https://github.com/thejusdutt/nutrilens)：GitHub 检索发现的相近离线食物 PWA，参考其本地推理、离线缓存及人工确认的架构思路。其仓库 MIT 仅覆盖代码，模型和数据有各自许可。BodyTrack 保留自己的数据模型及 UI，当前实现没有复制其应用代码、营养条目或测得准确率，不采用其份量自动估计结果。

## 实际分发的识别资源

模型来自 [onnx-community/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX](https://huggingface.co/onnx-community/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX)，固定 revision `9463a9c508a344c837ffefe9d724f3827bf2dc79`。量化的完整 CLIP ONNX 文件为 24,281,512 字节；WASM 为 11,210,254 字节，另有小型 JS、标签及工作线程文件，首次约 36 MB。

模型预处理使用其 `preprocessor_config.json`：RGB、中心裁切 224×224、按通道先除以 255，再使用 CLIP mean `[0.48145466,0.4578275,0.40821073]` 和 std `[0.26862954,0.26130258,0.27577711]`。浏览器 canvas 的缩放与参考 Python 图像库可能存在细微差异。

照片处理为临时内存流程：解码后即撤销原图 Blob URL、释放 canvas；识别结束、失败或取消后清除预览与文件引用、释放图像数组并终止推理 Worker。仅当前模型和运行时保留在资源缓存，不保存用户照片；旧版本资源在新版本完整缓存后清理。系统相册原图由用户管理，浏览器垃圾回收与操作系统内存回收不保证在同一瞬间完成。

标签包含 32 个常见食物组和一个非食物提示。固定英文提示的 BPE token 由模型自己的 tokenizer 生成；运行时不接收外部提示，不执行远程推理。候选排名是相对模型得分，**不显示为置信度百分比，不代表盘中全部食物，也不等于热量实测**。所有入账由用户确认。

当前没有将下列最初研究的候选模型纳入分发：MobileCLIP。核对其当前上游模型条款后，选用许可明确的 TinyCLIP 路线。下载调研的临时资源位于被忽略的 artifacts，不随应用发布。

## USDA 食物数据

来源：[USDA FoodData Central 官方下载](https://fdc.nal.usda.gov/download-datasets/)，SR Legacy April 2018 CSV archive。许可为 [CC0 1.0 / public domain](https://fdc.nal.usda.gov/api-guide/)。引用：U.S. Department of Agriculture, Agricultural Research Service. FoodData Central, 2019.

`dist/foods.json` 保存原始压缩包 SHA-256；每项有 FDC ID、英文原描述、官方条目 URL、每 100 g 营养值及数据库提供的参考份量 ID。中文名称由开发时人工整理，数值由脚本直接提取，无来源的缺失值保留 null。

营养 ID：1008 热量 kcal，1003 蛋白 g，1005 碳水 g，1004 脂肪 g，1079 纤维 g，1093 钠 mg；可选钙 1087、铁 1089、锌 1095、镁 1090、钾 1092、维 C 1162、维 D 1114。单位按原表，不做不明单位转换。

数据为美国一般食物历史参考值，不同于特定中国品牌或具体餐厅菜肴。生/熟、无盐/加盐、可食部分及烹调方式在条目名称中区分；份量换算只是原数据库的参考，不保证用户实际一份的重量完全相同。包装品牌以其标签为准。

## 重新获取和构建

1. Windows PowerShell 运行 `scripts/fetch-food-assets.ps1`：从官方站点、npm registry、Hugging Face 固定 revision 和 Microsoft GitHub 下载所需资源；不访问用户健康记录。
2. 从下载的 npm tgz 解出 `package/dist/ort.wasm.min.mjs`、`ort-wasm-simd-threaded.mjs`、`ort-wasm-simd-threaded.wasm` 放到 `dist/vendor/ort/`，保留许可。
3. Python 3 运行 `scripts/build-food-catalog.py`，生成 48 条食物的本地库。
4. Node 运行 `scripts/build-photo-labels.mjs`，生成固定提示 token。
5. 运行测试、`node scripts/release.mjs`、`node scripts/check.mjs`，再部署。

`scripts/release.mjs` 根据资源内容生成应用缓存和照片资源缓存版本。照片资源按需下载，与核心离线壳分开，未启用照片识别也能搜索食品、记录及备份。

## 测试图像

真实推理测试使用 [scikit-image 的 coffee.png](https://github.com/scikit-image/scikit-image/blob/v0.19.3/skimage/data/coffee.png)，测试文件保存在 `artifacts/food-assets/coffee-test.png`，不分发进应用，也不作为用户记录或模型精度基准。
