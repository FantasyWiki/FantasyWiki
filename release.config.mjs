// How a version is computed and published. Read by `npx semantic-release`,
// which `.github/workflows/release.yml` runs after every push to `master` that
// reached production (docs/development/release-process.md).
//
// The rules are the course's shared Conventional Commits preset, unmodified:
// `feat` is a minor, `fix`, `perf`, `docs` and `revert` are a patch, a `!` or a
// `BREAKING CHANGE` footer is a major, and everything else releases nothing.
// Tags are bare (`1.4.0`, no `v`), which is also the form `gitSemVer` reads.
import preset from "semantic-release-preconfigured-conventional-commits" with { type: "json" };

export default {
  ...preset,
  branches: ["master"],
  plugins: [
    // The preset also writes a CHANGELOG.md, which only means something if it
    // is committed back. It cannot be: `master` accepts pull requests and
    // signed commits only. The release notes live on the GitHub release instead.
    ...preset.plugins.filter((plugin) => plugin !== "@semantic-release/changelog"),
    [
      "@semantic-release/github",
      {
        // A release lists what it contains. Commenting "released in 1.4.0" on
        // every pull request and issue it mentions says the same thing again,
        // once per item, in a repository whose notifications a player-facing
        // problem report also lands in.
        successComment: false,
        releasedLabels: false,
        // A failed release fails the workflow run, which is where CI failures
        // are already read; an issue opened per failure would be a second copy.
        failComment: false,
        failTitle: false,
      },
    ],
  ],
};
