#!/bin/bash
# Writes the release notes of a Meltingplot version tag (e.g. v3.7.0-rc.1+mp.1) to stdout: the message
# of the tag if it is annotated, the upstream DuetWebControl commit the build is based on, and the
# commits since the previous Meltingplot release on the same upstream base - for the first release
# on a base, every commit the fork adds on top of upstream.
#
# Usage: mp-release-notes.sh <tag> <upstream commit>   (UPSTREAM_BRANCH names the upstream branch)
set -euo pipefail

tag="$1"
upstream="$2"
version="${tag#v}"
base="$(git merge-base "$tag" "$upstream")"
upstream_version="$(git show "$base:package.json" | jq -r .version)"

# Header: annotated tag message, or just the version for a lightweight tag
if [ "$(git cat-file -t "$tag")" = "tag" ]; then
	printf '%s\n' "$(git tag -l --format='%(contents)' "$tag" | sed '/^-----BEGIN PGP SIGNATURE-----/,$d')"
else
	echo "DuetWebControl $version"
fi
echo
echo "Meltingplot build of upstream DuetWebControl \`${UPSTREAM_BRANCH:-upstream}\` at $(git rev-parse --short "$base") (version $upstream_version). It adds the CHX 350 operator UI, the built-in layout plugin CHX350."

# The previous Meltingplot release counts only if it sits on the same upstream base
previous="$(git describe --tags --abbrev=0 --match 'v*+mp.*' "$tag^" 2>/dev/null || true)"
echo
if [ -n "$previous" ] && git merge-base --is-ancestor "$base" "$previous"; then
	range="$previous..$tag"
	echo "## Changes since ${previous#v}"
else
	range="$base..$tag"
	echo "## Changes over upstream $upstream_version"
fi
echo
changes="$(git log --no-merges --format='- %s (%h)' "$range" | grep -v '^- Version [0-9]' || true)"
echo "${changes:-- No functional changes}"
