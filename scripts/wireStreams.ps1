Param(
  [string]$Region = "",
  [string]$PointTable = "",
  [string]$AggTargetTable = "",
  [string]$AggMethodTable = "",
  [string]$FunctionName = ""
)

$ErrorActionPreference = 'Stop'

function Info($m){ Write-Host "[INFO] $m" -ForegroundColor Cyan }
function Warn($m){ Write-Host "[WARN] $m" -ForegroundColor Yellow }
function Ok($m){ Write-Host "[ OK ] $m" -ForegroundColor Green }
function Fail($m){ Write-Host "[FAIL] $m" -ForegroundColor Red }

try {
  if (-not $Region) {
    if (Test-Path ./amplify_outputs.json) {
      $cfg = Get-Content -Raw ./amplify_outputs.json | ConvertFrom-Json
      $Region = $cfg.auth.aws_region
    }
  }
  if (-not $Region) { throw "AWS Region not provided and amplify_outputs.json missing" }
  Info "Using region: $Region"

  # Discover tables if not provided
  $tables = (aws dynamodb list-tables --region $Region | ConvertFrom-Json).TableNames
  if (-not $PointTable) {
    $PointTable = $tables | Where-Object { $_ -like '*Point*' } | Select-Object -First 1
  }
  if (-not $AggTargetTable) {
    $AggTargetTable = $tables | Where-Object { $_ -like '*AggregatePlayerTargetDaily*' } | Select-Object -First 1
  }
  if (-not $AggMethodTable) {
    $AggMethodTable = $tables | Where-Object { $_ -like '*AggregatePlayerMethodDaily*' } | Select-Object -First 1
  }

  if (-not $PointTable -or -not $AggTargetTable -or -not $AggMethodTable) {
    throw "Failed to discover required tables. Point=$PointTable AggTarget=$AggTargetTable AggMethod=$AggMethodTable"
  }
  Info "PointTable=$PointTable"
  Info "AggTargetTable=$AggTargetTable"
  Info "AggMethodTable=$AggMethodTable"

  # Discover function if not provided
  if (-not $FunctionName) {
    $funcs = (aws lambda list-functions --region $Region | ConvertFrom-Json).Functions
    $FunctionName = ($funcs | Where-Object { $_.FunctionName -like '*aggStream*' } | Select-Object -First 1).FunctionName
  }
  if (-not $FunctionName) { throw "Lambda function 'aggStream' not found. Ensure sandbox/deploy has created it." }
  Info "Lambda=$FunctionName"

  # Enable Streams on Point table
  try {
    aws dynamodb update-table --region $Region --table-name $PointTable --stream-specification StreamEnabled=true,StreamViewType=NEW_IMAGE | Out-Null
    Ok "Enabled Streams (NEW_IMAGE) on $PointTable"
  } catch {
    Warn "update-table failed (権限不足または既に有効化済みの可能性): $($_.Exception.Message)"
  }

  # Get Stream ARN
  $streamArn = aws dynamodb describe-table --region $Region --table-name $PointTable --query "Table.LatestStreamArn" --output text
  if (-not $streamArn -or $streamArn -eq 'None') { throw "Failed to obtain Stream ARN for $PointTable" }
  Info "StreamArn=$streamArn"

  # Update Lambda environment
  aws lambda update-function-configuration --region $Region --function-name $FunctionName --environment "Variables={AGG_TARGET_TABLE=$AggTargetTable,AGG_METHOD_TABLE=$AggMethodTable}" | Out-Null
  Ok "Updated Lambda env vars"

  # Attach role policy for DDB access
  $roleArn = aws lambda get-function-configuration --region $Region --function-name $FunctionName --query "Role" --output text
  $roleName = ($roleArn -split "/")[-1]
  $policyPath = Join-Path $env:TEMP "AllowAggStream.json"
  $policyJson = @"
{
  ""Version"": ""2012-10-17"",
  ""Statement"": [
    { ""Effect"": ""Allow"", ""Action"": [""dynamodb:UpdateItem"",""dynamodb:DescribeTable""], ""Resource"": [
      ""arn:aws:dynamodb:*:*:table/$AggTargetTable"",
      ""arn:aws:dynamodb:*:*:table/$AggMethodTable""
    ]},
    { ""Effect"": ""Allow"", ""Action"": [
      ""dynamodb:DescribeStream"",""dynamodb:GetRecords"",""dynamodb:GetShardIterator"",""dynamodb:ListStreams""
    ], ""Resource"": ""*"" }
  ]
}
"@
  try {
    Set-Content -Path $policyPath -Value $policyJson -Encoding ascii
    aws iam put-role-policy --role-name $roleName --policy-name AllowAggStream --policy-document file://$policyPath --region $Region | Out-Null
    Ok "Attached inline policy to role $roleName"
  } catch {
    $msg = $_.Exception.Message
    Fail ("Failed to attach inline policy to role {0}: {1}" -f $roleName, $msg)
  }

  # Wire event source mapping (idempotent)
  $existing = aws lambda list-event-source-mappings --region $Region --function-name $FunctionName | ConvertFrom-Json
  $hasMap = $false
  foreach ($m in $existing.EventSourceMappings) {
    if ($m.EventSourceArn -eq $streamArn) { $hasMap = $true; break }
  }
  if (-not $hasMap) {
    try {
      aws lambda create-event-source-mapping --region $Region --function-name $FunctionName --event-source-arn $streamArn --batch-size 100 --starting-position LATEST | Out-Null
      Ok "Created event source mapping"
    } catch {
      $msg = $_.Exception.Message
      Fail ("Failed to create event source mapping: {0}. Ensure role has DescribeStream/GetRecords/GetShardIterator/ListStreams." -f $msg)
    }
  } else { Warn "Event source mapping already exists" }

  Ok "Wiring complete. Add a Point via the web UI and verify aggregates."
} catch {
  Fail $_.Exception.Message
  exit 1
}
