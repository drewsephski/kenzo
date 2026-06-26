---
description: Generate Kenzo epics and tasks from project requirements
allowed-tools: mcp__flux__*
---

# Kenzo Generate (`/flux-generate`)

Analyze the current project and generate a structured breakdown of epics and tasks in Kenzo.

## Process

1. **Gather Requirements**: Read README.md, PRD documents, specs, or any files the user specifies. If none exist, ask the user to describe what they're building.

2. **Identify the Project**: Check if a Kenzo project exists for this codebase using `list_projects`. If not, create one with `create_project`.

3. **Define Epics**: Break down the requirements into major features or workstreams. Each epic should represent a distinct deliverable. Create them with `create_epic`.

4. **Create Tasks**: For each epic, create granular tasks that can be completed in a single work session. Include:
   - Clear, actionable titles
   - Detailed notes with acceptance criteria
   - Dependencies on other tasks where applicable

5. **Set Dependencies**: Identify task dependencies (e.g., "API endpoint" must be done before "Frontend integration") and set them using the `depends_on` field.

## Output

After generation, summarize what was created:
- Project name
- Number of epics and tasks
- Key dependencies identified
- Suggested starting point (tasks with no blockers)
