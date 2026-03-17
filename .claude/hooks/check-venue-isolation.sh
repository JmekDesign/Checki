#!/usr/bin/env bash
# Soft warning hook: checks that router files touching venue-scoped tables
# always include a venue_id filter in their SQL.
# Exits 0 always (warning only, never blocking).

set -euo pipefail

input="$(cat)"

tool_name="$(printf '%s' "$input" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('tool_name', ''))")"

# Only care about Write and Edit tools
if [[ "$tool_name" != "Write" && "$tool_name" != "Edit" ]]; then
  exit 0
fi

file_path="$(printf '%s' "$input" | python3 -c "import sys, json; d=json.load(sys.stdin); print(d.get('tool_input', {}).get('file_path', ''))")"

# Only care about router files
if [[ ! "$file_path" =~ backend/app/routers/[^/]+\.py$ ]]; then
  exit 0
fi

# Extract the new content being written (Write uses 'content', Edit uses 'new_string')
new_content="$(printf '%s' "$input" | python3 -c "
import sys, json
d = json.load(sys.stdin)
ti = d.get('tool_input', {})
print(ti.get('content', ti.get('new_string', '')))
")"

# Check for SQL keywords on venue-scoped tables
venue_scoped_tables="checks|check_items|products|guests"
sql_keywords="SELECT|INSERT|UPDATE|DELETE"

has_sql_on_scoped_table=false
has_venue_id=false

if printf '%s' "$new_content" | grep -qiE "($sql_keywords)"; then
  if printf '%s' "$new_content" | grep -qiE "($venue_scoped_tables)"; then
    has_sql_on_scoped_table=true
  fi
fi

if printf '%s' "$new_content" | grep -qF "venue_id"; then
  has_venue_id=true
fi

if [[ "$has_sql_on_scoped_table" == "true" && "$has_venue_id" == "false" ]]; then
  echo "WARNING [check-venue-isolation]: '$file_path' contains SQL on venue-scoped tables (checks/check_items/products/guests) but does NOT reference venue_id. All queries on these tables must be filtered by venue_id." >&2
fi

exit 0
