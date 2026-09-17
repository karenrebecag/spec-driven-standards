# Attribution

This skill is adapted from **cyber-neo** v0.1.0 by mhenry (tododeia.com), MIT License.

Upstream: https://github.com/Hainrixz/cyber-neo

## Local changes

- Renamed `cyber-neo` to `security-audit`; removed the branded persona.
- `description` rewritten to disambiguate recall against the ECC skills
  `security-review` and `security-scan` and the `security-reviewer` agent.
- Report output renamed to `~/Desktop/security-audit-{project}-{date}.md`.
- Removed the `/last30days` and `superpowers` integrations (not installed here).
- Remediation handoff repointed to the `tdd-guide` and `security-reviewer` agents,
  with the global rule that dependency and root-config changes need approval.
- Added an instruction to request a Sonnet-tier model for the five analysis
  subagents, because `CLAUDE_CODE_SUBAGENT_MODEL` is set to `haiku` globally.

Not tracked upstream. To take a newer upstream version, re-apply these changes by hand.
