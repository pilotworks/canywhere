#!/usr/bin/env bash
set -e

# ==============================================================================
# Canywhere Release Automation Script (Bash)
# ==============================================================================

BOLD="\033[1m"
GREEN="\033[32m"
CYAN="\033[36m"
YELLOW="\033[33m"
RED="\033[31m"
PURPLE="\033[35m"
RESET="\033[0m"

# Portable in-place sed (macOS / BSD vs GNU / Linux)
sedi() {
  if [ "$(uname)" = "Darwin" ]; then
    sed -i '' "$@"
  else
    sed -i "$@"
  fi
}

print_help() {
  printf "${BOLD}Canywhere Release Automation Script (sh/bash)${RESET}\n\n"
  printf "Usage:\n  ./scripts/release.sh <version> [options]\n\n"
  printf "Arguments:\n  <version>       Target version (e.g. 0.2.0, 1.0.0, v0.2.0)\n\n"
  printf "Options:\n"
  printf "  --push          Automatically push commit and tag to GitHub origin\n"
  printf "  --dry-run       Preview modifications without writing or committing\n"
  printf "  --skip-tests    Skip pre-release verification tests\n"
  printf "  --allow-dirty   Allow running with uncommitted git changes\n"
  printf "  --help, -h      Show this help message\n\n"
  printf "Examples:\n"
  printf "  ./scripts/release.sh 0.2.0\n"
  printf "  ./scripts/release.sh 0.2.0 --push\n"
  printf "  ./scripts/release.sh 0.2.0 --dry-run\n"
}

VERSION=""
DO_PUSH=false
DRY_RUN=false
SKIP_TESTS=false
ALLOW_DIRTY=false

# Parse arguments
for arg in "$@"; do
  case "$arg" in
    --help|-h)
      print_help
      exit 0
      ;;
    --push)
      DO_PUSH=true
      ;;
    --dry-run)
      DRY_RUN=true
      ;;
    --skip-tests)
      SKIP_TESTS=true
      ;;
    --allow-dirty)
      ALLOW_DIRTY=true
      ;;
    -*)
      echo -e "${RED}Error: Unknown option '$arg'${RESET}"
      print_help
      exit 1
      ;;
    *)
      if [ -z "$VERSION" ]; then
        VERSION="$arg"
      fi
      ;;
  esac
done

if [ -z "$VERSION" ]; then
  echo -e "${RED}Error: Target version is required.${RESET}"
  print_help
  exit 1
fi

# Strip leading 'v'
VERSION="${VERSION#v}"
TAG="v${VERSION}"

# Validate SemVer format
if ! echo "$VERSION" | grep -Eq '^[0-9]+\.[0-9]+\.[0-9]+(-[a-zA-Z0-9.]+)?$'; then
  echo -e "${RED}Error: '$VERSION' is not a valid Semantic Version (e.g. 0.2.0, 1.0.0).${RESET}"
  exit 1
fi

echo -e "\n${BOLD}🚀 Preparing Canywhere Release: ${PURPLE}${TAG}${RESET}\n"

# 1. Check Git Status
if [ "$ALLOW_DIRTY" = false ] && [ "$DRY_RUN" = false ]; then
  if [ -n "$(git status --porcelain)" ]; then
    echo -e "${RED}Error: Git working directory has uncommitted changes.${RESET}"
    echo "Please commit or stash changes before releasing, or use --allow-dirty."
    exit 1
  fi
fi

# 2. Check current branch
CURRENT_BRANCH=$(git rev-parse --abbrev-ref HEAD 2>/dev/null || echo "unknown")
if [ "$CURRENT_BRANCH" != "main" ] && [ "$ALLOW_DIRTY" = false ]; then
  echo -e "${YELLOW}Warning: Releasing from branch '$CURRENT_BRANCH' instead of 'main'.${RESET}"
fi

# 3. Bump version in files
echo -e "${CYAN}📝 Bumping version numbers across workspace:${RESET}"

update_file() {
  local desc="$1"
  local file="$2"
  local cmd="$3"

  if [ ! -f "$file" ]; then
    echo -e "  ${YELLOW}⚠️ File not found: $file${RESET}"
    return
  fi

  if [ "$DRY_RUN" = true ]; then
    echo "  [DRY RUN] Would update $desc ($file)"
  else
    eval "$cmd"
    echo -e "  ${GREEN}✓${RESET} Updated $desc"
  fi
}

# Root package.json
update_file "Root package.json version" "package.json" \
  "sedi -E 's/\"version\": \"[^\"]+\"/\"version\": \"$VERSION\"/' package.json"

# Root Cargo.toml
update_file "Root Cargo.toml workspace version" "Cargo.toml" \
  "sedi -E 's/^version = \"[^\"]+\"/version = \"$VERSION\"/' Cargo.toml"

# Desktop App Cargo.toml
update_file "Desktop Tauri Cargo.toml version" "packages/desktop-app/src-tauri/Cargo.toml" \
  "sedi -E 's/^version = \"[^\"]+\"/version = \"$VERSION\"/' packages/desktop-app/src-tauri/Cargo.toml"

# Desktop App tauri.conf.json
update_file "Tauri configuration version" "packages/desktop-app/src-tauri/tauri.conf.json" \
  "sedi -E 's/\"version\": \"[^\"]+\"/\"version\": \"$VERSION\"/' packages/desktop-app/src-tauri/tauri.conf.json"

# Desktop UI package.json
update_file "Desktop UI package.json version" "packages/desktop-ui/package.json" \
  "sedi -E 's/\"version\": \"[^\"]+\"/\"version\": \"$VERSION\"/' packages/desktop-ui/package.json"

# Desktop UI update-store.ts
update_file "Desktop UI CURRENT_APP_VERSION" "packages/desktop-ui/src/store/update-store.ts" \
  "sedi -E 's/export const CURRENT_APP_VERSION = \"[^\"]+\";/export const CURRENT_APP_VERSION = \"$VERSION\";/' packages/desktop-ui/src/store/update-store.ts"

# iOS Info.plist
update_file "iOS CFBundleShortVersionString" "mobile/ios/Info.plist" \
  "sedi -E '/<key>CFBundleShortVersionString<\/key>/{n;s/<string>[^<]+<\/string>/<string>'$VERSION'<\/string>/;}' mobile/ios/Info.plist"

# 4. Generate Changelog
echo -e "\n${CYAN}📋 Generating release changelog...${RESET}"
PREV_TAG=$(git describe --tags --abbrev=0 2>/dev/null || true)
RANGE="HEAD"
if [ -n "$PREV_TAG" ]; then
  RANGE="${PREV_TAG}..HEAD"
  echo -e "  Parsing commits between ${PURPLE}${PREV_TAG}${RESET} and ${PURPLE}HEAD${RESET}..."
else
  echo -e "  Parsing all commits up to ${PURPLE}HEAD${RESET} (initial release)..."
fi

FEATS=""
FIXES=""
PERFS=""
DOCS=""
CHORES=""

while IFS= read -r line; do
  [ -z "$line" ] && continue
  if echo "$line" | grep -Eq '^[a-f0-9]+ chore\(release\):'; then
    continue
  fi

  HASH=$(echo "$line" | awk '{print $1}')
  SUBJECT=$(echo "$line" | cut -d' ' -f2-)

  if echo "$SUBJECT" | grep -Eq '^feat(\([^)]+\))?:'; then
    CLEAN_MSG=$(echo "$SUBJECT" | sed -E 's/^feat(\([^)]+\))?:\s*//')
    FEATS="${FEATS}- ${CLEAN_MSG} (${HASH})\n"
  elif echo "$SUBJECT" | grep -Eq '^fix(\([^)]+\))?:'; then
    CLEAN_MSG=$(echo "$SUBJECT" | sed -E 's/^fix(\([^)]+\))?:\s*//')
    FIXES="${FIXES}- ${CLEAN_MSG} (${HASH})\n"
  elif echo "$SUBJECT" | grep -Eq '^(perf|refactor)(\([^)]+\))?:'; then
    CLEAN_MSG=$(echo "$SUBJECT" | sed -E 's/^(perf|refactor)(\([^)]+\))?:\s*//')
    PERFS="${PERFS}- ${CLEAN_MSG} (${HASH})\n"
  elif echo "$SUBJECT" | grep -Eq '^docs(\([^)]+\))?:'; then
    CLEAN_MSG=$(echo "$SUBJECT" | sed -E 's/^docs(\([^)]+\))?:\s*//')
    DOCS="${DOCS}- ${CLEAN_MSG} (${HASH})\n"
  else
    CLEAN_MSG=$(echo "$SUBJECT" | sed -E 's/^[a-z]+(\([^)]+\))?:\s*//')
    CHORES="${CHORES}- ${CLEAN_MSG} (${HASH})\n"
  fi
done < <(git log "$RANGE" --oneline --no-merges)

RELEASE_NOTES=""
if [ -n "$FEATS" ]; then
  RELEASE_NOTES="${RELEASE_NOTES}### 🚀 Features\n${FEATS}\n"
fi
if [ -n "$FIXES" ]; then
  RELEASE_NOTES="${RELEASE_NOTES}### 🐛 Bug Fixes\n${FIXES}\n"
fi
if [ -n "$PERFS" ]; then
  RELEASE_NOTES="${RELEASE_NOTES}### ⚡ Improvements\n${PERFS}\n"
fi
if [ -n "$DOCS" ]; then
  RELEASE_NOTES="${RELEASE_NOTES}### 📝 Documentation\n${DOCS}\n"
fi
if [ -n "$CHORES" ]; then
  RELEASE_NOTES="${RELEASE_NOTES}### 🔧 Maintenance & Chores\n${CHORES}\n"
fi

if [ -z "$RELEASE_NOTES" ]; then
  RELEASE_NOTES="Maintenance and stability improvements.\n"
fi

if [ "$DRY_RUN" = true ]; then
  echo -e "\n${BOLD}Generated Release Notes Preview:${RESET}"
  echo -e "----------------------------------------"
  printf "%b" "$RELEASE_NOTES"
  echo -e "----------------------------------------"
  echo -e "\n${YELLOW}[DRY RUN COMPLETED] No files were committed or tagged.${RESET}\n"
  exit 0
fi

# Write .release-notes.md
printf "%b" "$RELEASE_NOTES" > .release-notes.md

# Update or Create CHANGELOG.md
TODAY=$(date +%Y-%m-%d)
ENTRY="## [${TAG}] - ${TODAY}\n\n${RELEASE_NOTES}\n"
if [ ! -f "CHANGELOG.md" ]; then
  printf "# Changelog\n\nAll notable changes to Canywhere will be documented in this file.\n\n%b" "$ENTRY" > CHANGELOG.md
  echo -e "  ${GREEN}✓${RESET} Created CHANGELOG.md"
else
  TMP_CHANGELOG=$(mktemp)
  if grep -q "^# Changelog" CHANGELOG.md; then
    sed '/^# Changelog/d' CHANGELOG.md > "$TMP_CHANGELOG"
    printf "# Changelog\n\nAll notable changes to Canywhere will be documented in this file.\n\n%b\n%s" "$ENTRY" "$(cat "$TMP_CHANGELOG")" > CHANGELOG.md
  else
    printf "# Changelog\n\n%b\n%s" "$ENTRY" "$(cat CHANGELOG.md)" > CHANGELOG.md
  fi
  rm -f "$TMP_CHANGELOG"
  echo -e "  ${GREEN}✓${RESET} Updated CHANGELOG.md"
fi

# 5. Update Cargo.lock
echo -e "\n${CYAN}🔄 Updating Cargo.lock with new version...${RESET}"
cargo check -p canywhere-desktop

# 6. Run Verification Tests
if [ "$SKIP_TESTS" = false ]; then
  echo -e "\n${CYAN}🧪 Running pre-release verification tests...${RESET}"
  (cd packages/desktop-ui && bun test test/update.test.ts)
fi

# 7. Git Commit & Tag
echo -e "\n${CYAN}📦 Creating release commit and git tag...${RESET}"
git add -A
git commit -m "chore(release): $TAG"
git tag -a "$TAG" -F .release-notes.md

echo -e "\n${GREEN}${BOLD}✓ Successfully created release commit and tag ${TAG}!${RESET}\n"

# 7. Push or Guide
if [ "$DO_PUSH" = true ]; then
  echo -e "${CYAN}🚀 Pushing release commit and tag to GitHub origin...${RESET}"
  git push origin HEAD
  git push origin "$TAG"
  echo -e "\n${GREEN}🎉 Release $TAG pushed successfully! GitHub Actions is building the release.${RESET}"
  echo -e "Track progress: ${CYAN}https://github.com/pilotworks/canywhere/actions${RESET}\n"
else
  echo -e "To publish this release to GitHub Actions, run:"
  echo -e "  ${BOLD}${CYAN}git push origin HEAD && git push origin $TAG${RESET}\n"
fi
