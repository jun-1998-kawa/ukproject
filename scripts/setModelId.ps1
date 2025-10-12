param(
  [string]$Region = "ap-northeast-1",
  [string]$FunctionName = "aiSummary",
  [string]$ModelId = "anthropic.claude-3-haiku-20240307-v1:0"
)

Write-Host "Setting MODEL_ID environment variable on Lambda '$FunctionName' in $Region to '$ModelId'"
aws lambda update-function-configuration --function-name $FunctionName --region $Region --environment Variables={MODEL_ID=$ModelId} | Out-Null
Write-Host "Done."

