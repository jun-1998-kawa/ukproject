param($path)
$lines = Get-Content -LiteralPath $path
function Set-Line { param([string]$regex,[string]$new)
  $idx = ($lines | Select-String -Pattern $regex | Select-Object -First 1).LineNumber
  if($idx){ $lines[$idx-1] = $new }
}
Set-Line 'Badge variation="info"' '              <Badge variation="info" marginRight="1rem">{user?.signInDetails?.loginId}</Badge>'
Set-Line '<Button onClick=\{signOut\}>' '              <Button onClick={signOut}>サインアウト</Button>'
Set-Line 'setTab\(''input''\)' '            <Button variation={tab==='"'"'input'"'"'? '"'"'primary'"'"' : '"'"'link'"'"'} onClick={()=> setTab('"'"'input'"'"')}>入力と一覧</Button>'
Set-Line 'setTab\(''dashboard''\)' '            <Button variation={tab==='"'"'dashboard'"'"'? '"'"'primary'"'"' : '"'"'link'"'"'} onClick={()=> setTab('"'"'dashboard'"'"')}>ダッシュボード</Button>'
Set-Line 'onClick=\{fetchMatches\}' '                <Button isLoading={loading} onClick={fetchMatches}>再読み込み</Button>'
Set-Line 'value=\{selectedMatchId\}' '                <SelectField label="試合" value={selectedMatchId} onChange={e=> setSelectedMatchId(e.target.value)} size="small">'
Set-Line '^\s*<option value="">' '                  <option value="">選択してください</option>'
Set-Line 'value=\{selectedBoutId\}' '                <SelectField label="取組" value={selectedBoutId} onChange={e=> setSelectedBoutId(e.target.value)} size="small" isDisabled={!selectedMatch}>'
$lines | Set-Content -LiteralPath $path -Encoding utf8
