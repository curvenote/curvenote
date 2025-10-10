---
"@curvenote/cli": patch
---

Extended `curvenote init` with template support and new initialization options:

- `cn init --github <url>` - Initialize from GitHub repository with interactive questions
- `cn init --curvenote <url>` - Initialize from Curvenote project URL
- `cn init --write-template` - Generate customizable `template.yml` file
- `cn init --improve` - Update existing project by re-answering template questions
- `cn init --add-authors <orcid|github>` - Add authors via ORCID or GitHub username lookup
- `--output <folder>` option for all init commands
- Template system with `people`, `text`, and `list` question types
- Compact author YAML output (removes internal `id` and `nameParsed` fields)
- GitHub profile scraping for comprehensive author metadata (ORCID, social links, affiliations)
