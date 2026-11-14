$ErrorActionPreference = 'Stop'
$taskRoot = Split-Path -Parent $PSScriptRoot
$taskArtifacts = Join-Path $taskRoot 'artifacts\food-assets'
$taskVendor = Join-Path $taskRoot 'dist\vendor\ort'
$taskModels = Join-Path $taskRoot 'dist\models'
New-Item -ItemType Directory -Path $taskArtifacts,$taskVendor,$taskModels -Force | Out-Null
function Get-TaskAsset([string]$url,[string]$destination) {
  if (!(Test-Path -LiteralPath $destination)) { Invoke-WebRequest -Uri $url -OutFile $destination -UseBasicParsing }
}
Get-TaskAsset 'https://fdc.nal.usda.gov/fdc-datasets/FoodData_Central_sr_legacy_food_csv_2018-04.zip' (Join-Path $taskArtifacts 'usda-sr-legacy.zip')
Get-TaskAsset 'https://registry.npmjs.org/onnxruntime-web/-/onnxruntime-web-1.22.0.tgz' (Join-Path $taskArtifacts 'onnxruntime-web-1.22.0.tgz')
$taskModelName = 'onnx-community/TinyCLIP-ViT-8M-16-Text-3M-YFCC15M-ONNX'
$taskRevision = '9463a9c508a344c837ffefe9d724f3827bf2dc79'
Get-TaskAsset "https://huggingface.co/api/models/$taskModelName/revision/$taskRevision" (Join-Path $taskArtifacts 'tinyclip-metadata.json')
$taskModelBase = "https://huggingface.co/$taskModelName/resolve/$taskRevision/"
Get-TaskAsset ($taskModelBase + 'onnx/model_quantized.onnx') (Join-Path $taskModels 'food-clip-q8.onnx')
Get-TaskAsset ($taskModelBase + 'tokenizer.json') (Join-Path $taskArtifacts 'tinyclip-tokenizer.json')
Get-TaskAsset ($taskModelBase + 'preprocessor_config.json') (Join-Path $taskModels 'preprocessor-config.json')
Get-TaskAsset 'https://raw.githubusercontent.com/microsoft/Cream/main/TinyCLIP/LICENSE' (Join-Path $taskModels 'TinyCLIP-LICENSE.txt')
Get-TaskAsset 'https://raw.githubusercontent.com/microsoft/onnxruntime/v1.22.0/LICENSE' (Join-Path $taskVendor 'LICENSE.txt')
Get-TaskAsset 'https://raw.githubusercontent.com/microsoft/onnxruntime/v1.22.0/ThirdPartyNotices.txt' (Join-Path $taskVendor 'ThirdPartyNotices.txt')
Get-TaskAsset 'https://raw.githubusercontent.com/scikit-image/scikit-image/v0.19.3/skimage/data/coffee.png' (Join-Path $taskArtifacts 'coffee-test.png')
Write-Output 'Downloaded official USDA data, MIT-licensed TinyCLIP and ONNX Runtime resources. No user photos were sent.'
