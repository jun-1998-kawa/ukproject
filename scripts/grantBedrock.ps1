param(
  [string]$Region = "ap-northeast-1",
  [string]$ModelId = "anthropic.claude-3-haiku-20240307-v1:0",
  [string]$FunctionName = "aiSummary",
  [string]$PolicyName = "AllowBedrockInvoke"
)

Write-Host "Granting Bedrock invoke to Lambda '$FunctionName' in $Region (ModelId=$ModelId)"

function Resolve-FunctionRole {
  param([string]$Fn, [string]$Region)
  try {
    $j = aws lambda get-function-configuration --function-name $Fn --region $Region | ConvertFrom-Json
    if ($j -and $j.Role) { return $j.Role }
  } catch {}
  # Fallback: find by partial name
  try {
    $list = aws lambda list-functions --region $Region | ConvertFrom-Json
    foreach($f in $list.Functions){ if($f.FunctionName -match [Regex]::Escape($Fn)){ return $f.Role } }
  } catch {}
  return $null
}

$roleArn = Resolve-FunctionRole -Fn $FunctionName -Region $Region
if(-not $roleArn){ throw "Could not resolve Lambda role for function '$FunctionName' in $Region." }

$roleName = ($roleArn -split '/')[-1]
Write-Host "Resolved role: $roleName"

# Load policy and replace region/model if needed
$policyPath = Join-Path $PSScriptRoot 'AllowBedrockInvoke.json'
$policy = Get-Content $policyPath -Raw
$policy = $policy -replace 'ap-northeast-1', $Region
$policy = $policy -replace 'anthropic.claude-3-haiku-20240307-v1:0', $ModelId

# Attach/overwrite inline policy
aws iam put-role-policy --role-name $roleName --policy-name $PolicyName --policy-document $policy | Out-Null
Write-Host "Attached inline policy '$PolicyName' to role '$roleName' for $ModelId in $Region."

