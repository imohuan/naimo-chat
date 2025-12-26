# 从 Git 历史中移除大文件的脚本
Write-Host "正在从 Git 历史中移除大文件..." -ForegroundColor Green

# 要移除的文件列表
$largeFiles = @(
    "packages/backend/.1884679f55b4ffac-00000000.bun-build"
)

Write-Host "`n要移除的文件:" -ForegroundColor Yellow
foreach ($file in $largeFiles) {
    Write-Host "  - $file" -ForegroundColor Red
}

# 检查 git-filter-repo 是否可用
$hasFilterRepo = Get-Command git-filter-repo -ErrorAction SilentlyContinue

if (-not $hasFilterRepo) {
    Write-Host "`n警告: git-filter-repo 未安装，将使用 git filter-branch" -ForegroundColor Yellow
    Write-Host "建议安装 git-filter-repo 以获得更好的性能" -ForegroundColor Yellow
    Write-Host "安装方法: pip install git-filter-repo" -ForegroundColor Yellow
    Write-Host ""
    
    # 使用 git filter-branch
    $filePattern = $largeFiles -join "|"
    Write-Host "使用 git filter-branch 移除文件..." -ForegroundColor Green
    
    # 创建临时脚本
    $scriptContent = @"
git filter-branch --force --index-filter `
    "git rm --cached --ignore-unmatch $($largeFiles -join ' ')" `
    --prune-empty --tag-name-filter cat -- --all
"@
    
    Write-Host "`n执行命令:" -ForegroundColor Cyan
    Write-Host $scriptContent -ForegroundColor Gray
    
    # 询问确认
    $confirm = Read-Host "`n是否继续？(Y/N)"
    if ($confirm -ne 'Y' -and $confirm -ne 'y') {
        Write-Host "已取消操作" -ForegroundColor Yellow
        exit
    }
    
    # 执行 git filter-branch
    foreach ($file in $largeFiles) {
        Write-Host "`n正在移除: $file" -ForegroundColor Green
        git filter-branch --force --index-filter "git rm --cached --ignore-unmatch $file" --prune-empty --tag-name-filter cat -- --all
        if ($LASTEXITCODE -eq 0) {
            Write-Host "成功移除: $file" -ForegroundColor Green
        } else {
            Write-Host "移除失败: $file" -ForegroundColor Red
        }
    }
} else {
    # 使用 git-filter-repo
    Write-Host "`n使用 git-filter-repo 移除文件..." -ForegroundColor Green
    $filePattern = $largeFiles -join " "
    git filter-repo --path $filePattern --invert-paths --force
}

Write-Host "`n清理 Git 引用..." -ForegroundColor Green
git for-each-ref --format='delete %(refname)' refs/original | git update-ref --stdin
git reflog expire --expire=now --all
git gc --prune=now --aggressive

Write-Host "`n完成！大文件已从 Git 历史中移除" -ForegroundColor Green
Write-Host "现在可以执行: git push --force origin main" -ForegroundColor Yellow

