#!/bin/sh
# sjgl02 测试 runner：为每个测试文件创建独立 PostgreSQL 数据库
# 用法：sh test-runner.sh <test-file-path>
# 示例：sh test-runner.sh packages/plugins/@my-project/plugin-sjgl02/src/__tests__/server/export-execute.test.ts

set -e

TEST_FILE="$1"
if [ -z "$TEST_FILE" ]; then
  echo "用法: sh test-runner.sh <test-file-path>"
  exit 1
fi

# 从测试路径提取数据库名（防冲突）
DB_NAME="test_$(echo "$TEST_FILE" | md5sum | cut -c1-8)"
echo "=== 数据库: ${DB_NAME} ==="

# 建库
dropdb -U nocobase "${DB_NAME}" --if-exists 2>/dev/null
createdb -U nocobase "${DB_NAME}" -O nocobase 2>/dev/null
echo "数据库已就绪"

# 测试环境删 dist worker，强制走内联（避免 vitest fork 兼容问题）
rm -f /workspace/nocobase1/nocobase-2.1.9/packages/plugins/@my-project/plugin-sjgl02/dist/server/workers/export-worker.js 2>/dev/null
echo "worker 已移除（走内联模式）"

# 用独立库名跑测试
cd /workspace/nocobase1/nocobase-2.1.9
DB_DATABASE="${DB_NAME}" DB_HOST="${DB_HOST:-localhost}" DB_PORT="${DB_PORT:-5432}" DB_USER="${DB_USER:-nocobase}" DB_PASSWORD="${DB_PASSWORD:-nocobase}" DB_DIALECT=postgres yarn test "$TEST_FILE" --run 2>&1
TEST_EXIT=$?

# 清理
dropdb -U nocobase "${DB_NAME}" --if-exists 2>/dev/null
echo "数据库已清理"

exit $TEST_EXIT
