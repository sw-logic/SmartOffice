#!/usr/bin/env bash
#
# Publish SmartOffice Connector WordPress plugin to its GitHub repo.
#
# Steps:
#   1. Push plugin subdirectory to plugin repo via git subtree
#   2. Create a GitHub release with a ZIP asset (for the WP updater)
#
# Usage:
#   ./publish-plugin.sh              # reads version from plugin file
#   ./publish-plugin.sh --dry-run    # show what would happen without doing it
#
# Prerequisites:
#   - gh CLI authenticated (https://cli.github.com) — only needed for release creation
#   - Remote "plugin-origin" pointing to the plugin repo
#

set -euo pipefail

# ── Configuration ──────────────────────────────────────────────────────
PLUGIN_REPO="sw-logic/smartoffice-connector"
PLUGIN_REMOTE="plugin-origin"
PLUGIN_DIR="wordpress-plugin/smartoffice-connector"
PLUGIN_FILE="$PLUGIN_DIR/smartoffice-connector.php"
# ───────────────────────────────────────────────────────────────────────

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$SCRIPT_DIR"

DRY_RUN=false
if [[ "${1:-}" == "--dry-run" ]]; then
    DRY_RUN=true
    echo "[DRY RUN] No changes will be made."
    echo ""
fi

# 1. Verify plugin directory exists
if [[ ! -f "$PLUGIN_FILE" ]]; then
    echo "Error: Plugin file not found at $PLUGIN_FILE"
    exit 1
fi

# 2. Extract version from plugin header
VERSION=$(grep -oP "Version:\s*\K[0-9]+\.[0-9]+\.[0-9]+" "$PLUGIN_FILE")
if [[ -z "$VERSION" ]]; then
    echo "Error: Could not read version from $PLUGIN_FILE"
    exit 1
fi

TAG="v$VERSION"
ZIP_NAME="smartoffice-connector-$VERSION.zip"

echo "Plugin:  SmartOffice Connector"
echo "Version: $VERSION"
echo "Tag:     $TAG"
echo "Repo:    $PLUGIN_REPO"
echo ""

# 3. Check for uncommitted changes in the plugin directory
if ! git diff --quiet -- "$PLUGIN_DIR" || ! git diff --cached --quiet -- "$PLUGIN_DIR"; then
    echo "Warning: You have uncommitted changes in $PLUGIN_DIR"
    read -rp "Continue anyway? [y/N] " confirm
    if [[ "$confirm" != [yY] ]]; then
        echo "Aborted."
        exit 1
    fi
fi

# 4. Push plugin subdirectory to plugin repo
echo "Pushing plugin files to $PLUGIN_REMOTE..."
if $DRY_RUN; then
    echo "[DRY RUN] Would run: git subtree push --prefix=$PLUGIN_DIR $PLUGIN_REMOTE main"
else
    git subtree push --prefix="$PLUGIN_DIR" "$PLUGIN_REMOTE" main
fi
echo ""

# 5. Create GitHub release with ZIP (requires gh CLI)
if ! command -v gh &>/dev/null; then
    echo "Done! Plugin pushed to $PLUGIN_REPO."
    echo ""
    echo "Note: gh CLI not found — skipping release creation."
    echo "Install gh (https://cli.github.com) to auto-create releases with ZIP assets."
    echo "The WP self-updater needs a release with a .zip asset or will fall back to zipball."
    exit 0
fi

# Check if this release already exists
if gh release view "$TAG" --repo "$PLUGIN_REPO" &>/dev/null; then
    echo "Release $TAG already exists — skipping release creation."
    echo "Done!"
    exit 0
fi

# Build ZIP with correct directory structure (smartoffice-connector/ at root)
TEMP_DIR=$(mktemp -d)
trap 'rm -rf "$TEMP_DIR"' EXIT

cp -r "$PLUGIN_DIR" "$TEMP_DIR/smartoffice-connector"

# Remove dev files that shouldn't be in the release
rm -rf "$TEMP_DIR/smartoffice-connector/.git" \
       "$TEMP_DIR/smartoffice-connector/.gitignore" \
       "$TEMP_DIR/smartoffice-connector/node_modules" \
       "$TEMP_DIR/smartoffice-connector/.DS_Store" \
       2>/dev/null || true

echo "Creating $ZIP_NAME..."
if command -v zip &>/dev/null; then
    (cd "$TEMP_DIR" && zip -rq "$SCRIPT_DIR/$ZIP_NAME" smartoffice-connector/)
else
    # Fallback for Windows/Git Bash: use PowerShell
    WIN_TEMP=$(cygpath -w "$TEMP_DIR/smartoffice-connector")
    WIN_ZIP=$(cygpath -w "$SCRIPT_DIR/$ZIP_NAME")
    powershell.exe -NoProfile -Command "Compress-Archive -Path '$WIN_TEMP' -DestinationPath '$WIN_ZIP' -Force"
fi

echo "ZIP size: $(du -h "$ZIP_NAME" | cut -f1)"
echo ""

if $DRY_RUN; then
    echo "[DRY RUN] Would create release $TAG on $PLUGIN_REPO with $ZIP_NAME"
    rm -f "$ZIP_NAME"
    exit 0
fi

# Create GitHub release with the ZIP
echo "Creating release $TAG on $PLUGIN_REPO..."
gh release create "$TAG" \
    "$ZIP_NAME" \
    --repo "$PLUGIN_REPO" \
    --title "SmartOffice Connector $VERSION" \
    --notes "SmartOffice Connector v$VERSION" \
    --latest

# Clean up local ZIP
rm -f "$ZIP_NAME"

echo ""
echo "Done! Release $TAG published to $PLUGIN_REPO"
echo "WordPress sites with the updater will pick this up within 12 hours (or on manual check)."
