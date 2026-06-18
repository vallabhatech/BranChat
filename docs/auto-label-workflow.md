# Auto Label Issues Workflow - Documentation

## Table of Contents
1. [Architecture Overview](#architecture-overview)
2. [Classification Engine](#classification-engine)
3. [Label Determination Logic](#label-determination-logic)
4. [Classification Examples](#classification-examples)
5. [Usage Guide](#usage-guide)
6. [Maintenance Guide](#maintenance-guide)

---

## Architecture Overview

### High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     GitHub Actions Runner                        │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │           Workflow Trigger (workflow_dispatch)            │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                          │
│                       ▼                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Configuration Loading                        │  │
│  │  - Load workflow inputs                                   │  │
│  │  - Load label definitions                                 │  │
│  │  - Load classification rules                              │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                          │
│                       ▼                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Issue Fetching                                │  │
│  │  - Query GitHub API for open issues                       │  │
│  │  - Handle pagination                                       │  │
│  │  - Respect rate limits                                     │  │
│  │  - Apply filters (date, limit)                              │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                          │
│                       ▼                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Classification Engine                        │  │
│  │  ┌────────────────────────────────────────────────────┐  │  │
│  │  │  For each issue:                                    │  │  │
│  │  │    1. Extract content (title + body)               │  │  │
│  │  │    2. Check existing labels                         │  │  │
│  │  │    3. Calculate confidence for each label           │  │  │
│  │  │    4. Resolve conflicts                             │  │  │
│  │  │    5. Sort by priority & confidence                 │  │  │
│  │  │    6. Apply labels (or dry run)                     │  │  │
│  │  └────────────────────────────────────────────────────┘  │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                          │
│                       ▼                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Label Application                            │  │
│  │  - Apply new labels via GitHub API                       │  │
│  │  - Remove triage label if configured                     │  │
│  │  - Handle API errors gracefully                          │  │
│  └────────────────────┬─────────────────────────────────────┘  │
│                       │                                          │
│                       ▼                                          │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │              Summary & Logging                            │  │
│  │  - Log detailed classification results                   │  │
│  │  - Generate workflow summary                              │  │
│  │  - Report statistics                                      │  │
│  └──────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

### Component Breakdown

#### 1. Configuration Layer
- **Purpose**: Centralized configuration for easy maintenance
- **Components**:
  - `CONFIG`: Workflow settings (dry run, limits, thresholds)
  - `LABELS`: Label definitions with classification rules
  - `CONFLICTING_LABELS`: Groups of mutually exclusive labels
- **Benefits**: Single source of truth, easy to extend, version-controlled

#### 2. Issue Fetching Layer
- **Purpose**: Retrieve issues from GitHub with proper API handling
- **Features**:
  - Pagination support for large repositories
  - Rate limit detection and automatic waiting
  - Retry logic with exponential backoff
  - Query filtering (date range, state)
- **Safety**: Respects GitHub API rate limits (5000 requests/hour)

#### 3. Classification Engine
- **Purpose**: Analyze issue content and determine appropriate labels
- **Process**:
  1. Content extraction (title + body)
  2. Keyword matching
  3. Pattern matching (regex)
  4. Confidence scoring
  5. Conflict resolution
  6. Priority-based sorting
- **Output**: List of labels with confidence scores

#### 4. Label Application Layer
- **Purpose**: Apply labels to issues via GitHub API
- **Features**:
  - Dry run mode for testing
  - Idempotent operations (safe to re-run)
  - Existing label preservation
  - Triage label removal (optional)
- **Safety**: Graceful error handling, no partial failures

#### 5. Logging Layer
- **Purpose**: Detailed logging for debugging and audit trail
- **Features**:
  - Timestamped log entries
  - Per-issue classification details
  - Confidence score reporting
  - Workflow summary statistics
- **Benefits**: Debugging, audit trail, transparency

### Key Design Principles

#### 1. Idempotency
The workflow is designed to be safe to run multiple times:
- Checks for existing labels before applying
- Only applies labels that don't already exist
- No side effects from repeated execution

#### 2. Safety First
- Dry run mode for testing without changes
- Rate limit handling to avoid API abuse
- Graceful error handling with retries
- Detailed logging for troubleshooting

#### 3. Configurability
- Centralized configuration in one place
- Easy to add new labels and rules
- Workflow inputs for runtime configuration
- Extensible architecture

#### 4. Transparency
- Detailed logging of all decisions
- Confidence scores for each label
- Summary statistics
- Clear audit trail

#### 5. Performance
- Pagination for large repositories
- Rate limit awareness
- Efficient keyword matching
- Minimal API calls

---

## Classification Engine

### Confidence Scoring Algorithm

The classification engine uses a multi-factor confidence scoring system:

```
Confidence Score = (Keyword Matches + Pattern Matches + Title Match) / Max Possible Score × 100
```

#### Scoring Components

1. **Keyword Matching** (20 points per match)
   - Simple substring matching
   - Case-insensitive
   - Applied to both title and body
   - Example: "crash" in content → +20 points

2. **Pattern Matching** (30 points per match)
   - Regular expression patterns
   - More sophisticated matching
   - Can match phrases and context
   - Example: /doesn't work/i → +30 points

3. **Title Matching** (25 points)
   - Bonus if label name appears in title
   - Higher weight for title content
   - Example: "bug" in title → +25 points

#### Confidence Threshold

Labels are only applied if confidence score ≥ 60% (configurable).

```
if (confidence >= CONFIG.confidenceThreshold) {
  applyLabel();
}
```

#### Example Calculation

**Issue**: "App crashes when I click the save button"

**Label: bug**
- Keyword matches: crash (+20), crashes (+20) = +40
- Pattern matches: /crash/i (+30) = +30
- Title match: bug in title? No = +0
- Total: 70 points
- Max possible: 95 points (keywords: 40, patterns: 30, title: 25)
- Confidence: (70/95) × 100 = 73.7%
- Result: Apply label (73.7% ≥ 60%)

### Conflict Resolution

When multiple labels from the same conflict group match, the engine:

1. Calculates confidence for all conflicting labels
2. Selects the label with highest confidence
3. Discards lower-confidence conflicting labels

**Example**:
- bug: 85% confidence
- feature: 45% confidence
- enhancement: 30% confidence

Result: Only `bug` label applied (highest confidence)

### Priority-Based Sorting

Labels are sorted before application:

1. **Primary Sort**: Priority (lower number = higher priority)
   - Core types: priority 1
   - Technical areas: priority 2
   - Engineering categories: priority 3
   - Status labels: priority 4
   - Community labels: priority 5
   - Resolution labels: priority 6

2. **Secondary Sort**: Confidence (higher = better)

**Example Output**:
```
1. bug (priority 1, confidence 85%)
2. security (priority 3, confidence 75%)
3. frontend (priority 2, confidence 70%)
```

### Special Label Handling

#### Auto-Apply Labels
Some labels have `autoApply: false` and are never applied automatically:
- `triage` (only applied when no other labels match)
- `in-progress` (manual only)
- `duplicate` (manual only)
- `wontfix` (manual only)

#### Manual Review Labels
Some labels require higher confidence (≥90%):
- `good first issue` (requires manual review)

#### Triage Label Logic
- Applied automatically when no other labels match
- Removed automatically when other labels are applied (if configured)
- Indicates issue needs human review

---

## Label Determination Logic

### Label Categories

#### 1. Core Issue Types (Priority 1)
Mutually exclusive - only one applied per issue.

**bug**
- Keywords: crash, error, exception, fail, broken, incorrect, regression
- Patterns: /crash/i, /error/i, /doesn't work/i
- Use case: Something isn't working as expected

**feature**
- Keywords: feature, new, add, implement, support, capability
- Patterns: /feature request/i, /add support for/i
- Use case: Requesting new functionality

**enhancement**
- Keywords: enhancement, improve, optimization, better, usability
- Patterns: /enhancement/i, /improve/i
- Use case: Improving existing functionality

**documentation**
- Keywords: documentation, docs, readme, guide, tutorial
- Patterns: /documentation/i, /readme/i
- Use case: Documentation improvements

**question**
- Keywords: question, help, how to, clarification
- Patterns: /\?$/, /how do i/i
- Use case: User asking for help or clarification

#### 2. Technical Areas (Priority 2)
Can be combined with core types.

**frontend**
- Keywords: frontend, react, vue, angular, ui, component, client
- Patterns: /frontend/i, /react/i, /client.?side/i
- Use case: Frontend or client-side issues

**backend**
- Keywords: backend, server, service, controller, business logic
- Patterns: /backend/i, /server.?side/i
- Use case: Backend or server-side issues

**api**
- Keywords: api, rest, graphql, endpoint, request, response
- Patterns: /api/i, /rest/i, /endpoint/i
- Use case: API or integration issues

**database**
- Keywords: database, db, sql, nosql, migration, schema
- Patterns: /database/i, /migration/i, /schema/i
- Use case: Database or data storage issues

**authentication**
- Keywords: auth, authentication, login, signup, oauth, jwt
- Patterns: /auth/i, /login/i, /oauth/i
- Use case: Authentication or authorization issues

**ui**
- Keywords: ui, visual, design, layout, styling, css
- Patterns: /ui/i, /visual/i, /design/i
- Use case: User interface or visual design issues

**ux**
- Keywords: ux, user experience, workflow, usability, accessibility
- Patterns: /ux/i, /usability/i, /accessibility/i
- Use case: User experience or usability issues

#### 3. Engineering Categories (Priority 3)
Can be combined with core types and technical areas.

**security**
- Keywords: security, vulnerability, xss, csrf, sql injection, exploit
- Patterns: /security/i, /vulnerability/i, /xss/i
- Use case: Security vulnerabilities or concerns

**performance**
- Keywords: performance, slow, latency, memory leak, optimization
- Patterns: /performance/i, /slow/i, /latency/i
- Use case: Performance or scalability issues

**refactor**
- Keywords: refactor, cleanup, technical debt, restructure
- Patterns: /refactor/i, /cleanup/i, /technical debt/i
- Use case: Code refactoring or cleanup

**dependencies**
- Keywords: dependency, package, library, upgrade, update
- Patterns: /dependenc/i, /package/i, /upgrade/i
- Use case: Dependency or package management issues

**ci**
- Keywords: ci, cd, github actions, pipeline, build, deploy
- Patterns: /ci/i, /github action/i, /pipeline/i
- Use case: CI/CD or build automation issues

#### 4. Workflow Status (Priority 4)
Indicate issue state in workflow.

**triage**
- Auto-applied when no other labels match
- Removed when other labels are applied
- Indicates issue needs initial review

**needs-review**
- Auto-applied when issue is sufficiently described
- Indicates issue needs maintainer evaluation

**in-progress**
- Manual only
- Indicates issue is being worked on

**blocked**
- Keywords: blocked, waiting, dependency, blocked by
- Patterns: /blocked/i, /waiting for/i
- Use case: Issue is blocked by another issue

#### 5. Community Labels (Priority 5)
Indicate community involvement.

**good first issue**
- Requires confidence ≥ 90%
- Keywords: simple, easy, small, minor, beginner
- Use case: Good for newcomers

**help wanted**
- Keywords: help wanted, contributions welcome
- Patterns: /help wanted/i
- Use case: Help needed from community

#### 6. Resolution Labels (Priority 6)
Indicate issue resolution.

**duplicate**
- Manual only
- Use case: Duplicate of another issue

**wontfix**
- Manual only
- Use case: Issue will not be fixed

### Decision Tree

```
┌─────────────────────────────────────┐
│         Start Classification        │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│    Extract Issue Content            │
│    (title + body)                   │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│    Check Existing Labels            │
│    Skip if already present          │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│    Calculate Confidence for        │
│    Each Label                       │
│    - Keyword matching               │
│    - Pattern matching               │
│    - Title matching                 │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│    Filter by Threshold             │
│    Keep if confidence ≥ 60%         │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│    Resolve Conflicts                │
│    Keep highest confidence in       │
│    each conflict group              │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│    Sort by Priority & Confidence    │
│    Limit to max 5 labels            │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│    Apply Labels                     │
│    - Skip if dry run                │
│    - Remove triage if configured    │
└──────────────┬──────────────────────┘
               │
               ▼
┌─────────────────────────────────────┐
│    Log Results                      │
│    - Labels applied                 │
│    - Confidence scores              │
│    - Summary statistics              │
└─────────────────────────────────────┘
```

---

## Classification Examples

### Example 1: Bug Report

**Issue Title**: "App crashes when I click the save button"

**Issue Body**: 
```
I'm experiencing a crash when I try to save my work. 
The error message says "NullPointerException at line 45".
This happens every time I click the save button.
```

**Classification Process**:
1. **bug**: 
   - Keywords: crash (+20), crashes (+20), error (+20) = +60
   - Patterns: /crash/i (+30), /error/i (+30) = +60
   - Title match: No = +0
   - Total: 120 / 145 = 82.8% ✓

2. **frontend**:
   - Keywords: button (+20) = +20
   - Patterns: None = +0
   - Title match: No = +0
   - Total: 20 / 20 = 100% ✓

3. **ui**:
   - Keywords: button (+20) = +20
   - Patterns: None = +0
   - Title match: No = +0
   - Total: 20 / 20 = 100% ✓

**Labels Applied**: `bug`, `frontend`, `ui`

**Confidence Scores**: bug: 83%, frontend: 100%, ui: 100%

---

### Example 2: Feature Request

**Issue Title**: "Add support for dark mode"

**Issue Body**: 
```
It would be great if the app had a dark mode option.
Many users prefer dark themes for reduced eye strain.
This is a common feature in modern applications.
```

**Classification Process**:
1. **feature**:
   - Keywords: feature (+20), support (+20) = +40
   - Patterns: /add support for/i (+30) = +30
   - Title match: No = +0
   - Total: 70 / 95 = 73.7% ✓

2. **ui**:
   - Keywords: dark mode (+20), theme (+20) = +40
   - Patterns: None = +0
   - Title match: No = +0
   - Total: 40 / 40 = 100% ✓

3. **ux**:
   - Keywords: users (+20), eye strain (+20) = +40
   - Patterns: None = +0
   - Title match: No = +0
   - Total: 40 / 40 = 100% ✓

**Labels Applied**: `feature`, `ui`, `ux`

**Confidence Scores**: feature: 74%, ui: 100%, ux: 100%

---

### Example 3: Security Vulnerability

**Issue Title**: "XSS vulnerability in user input field"

**Issue Body**: 
```
I found a security vulnerability in the user input field.
It's possible to inject malicious scripts through the input.
This is a classic XSS attack vector that needs to be fixed.
```

**Classification Process**:
1. **security**:
   - Keywords: security (+20), vulnerability (+20), xss (+20), attack (+20) = +80
   - Patterns: /security/i (+30), /vulnerability/i (+30), /xss/i (+30) = +90
   - Title match: Yes (+25) = +25
   - Total: 195 / 195 = 100% ✓

2. **bug**:
   - Keywords: vulnerability (+20) = +20
   - Patterns: None = +0
   - Title match: No = +0
   - Total: 20 / 20 = 100% ✓

3. **frontend**:
   - Keywords: input (+20), field (+20) = +40
   - Patterns: None = +0
   - Title match: No = +0
   - Total: 40 / 40 = 100% ✓

**Conflict Resolution**: bug vs security
- security: 100%
- bug: 100%
- Result: security wins (higher priority: 3 vs 1)

**Labels Applied**: `security`, `frontend`

**Confidence Scores**: security: 100%, frontend: 100%

---

### Example 4: Documentation Issue

**Issue Title**: "README is missing installation instructions"

**Issue Body**: 
```
The README file doesn't have clear installation instructions.
New users are confused about how to set up the project.
We should add a step-by-step guide for getting started.
```

**Classification Process**:
1. **documentation**:
   - Keywords: documentation (+20), readme (+20), guide (+20) = +60
   - Patterns: /documentation/i (+30), /readme/i (+30) = +60
   - Title match: Yes (+25) = +25
   - Total: 145 / 145 = 100% ✓

2. **enhancement**:
   - Keywords: add (+20) = +20
   - Patterns: None = +0
   - Title match: No = +0
   - Total: 20 / 20 = 100% ✓

**Conflict Resolution**: documentation vs enhancement
- documentation: 100%
- enhancement: 100%
- Result: documentation wins (higher priority: 1 vs 1, same priority, documentation matched first)

**Labels Applied**: `documentation`

**Confidence Scores**: documentation: 100%

---

### Example 5: Performance Issue

**Issue Title**: "Slow database queries on large datasets"

**Issue Body**: 
```
The application becomes very slow when querying large datasets.
Database queries take several seconds to complete.
This is affecting user experience significantly.
We need to optimize the query performance.
```

**Classification Process**:
1. **performance**:
   - Keywords: performance (+20), slow (+20), optimize (+20) = +60
   - Patterns: /performance/i (+30), /slow/i (+30), /optimization/i (+30) = +90
   - Title match: No = +0
   - Total: 150 / 150 = 100% ✓

2. **database**:
   - Keywords: database (+20), queries (+20) = +40
   - Patterns: /database/i (+30), /query/i (+30) = +60
   - Title match: Yes (+25) = +25
   - Total: 125 / 125 = 100% ✓

3. **backend**:
   - Keywords: None = +0
   - Patterns: None = +0
   - Title match: No = +0
   - Total: 0 / 0 = 0% ✗

**Labels Applied**: `performance`, `database`

**Confidence Scores**: performance: 100%, database: 100%

---

### Example 6: Question/Support Request

**Issue Title**: "How do I configure OAuth authentication?"

**Issue Body**: 
```
I'm trying to set up OAuth authentication but I'm confused about the process.
Can someone help me understand the steps?
What do I need to configure on the OAuth provider side?
```

**Classification Process**:
1. **question**:
   - Keywords: question (+20), help (+20), confused (+20) = +60
   - Patterns: /\?$/ (no match), /how do i/i (+30), /can someone/i (+30) = +60
   - Title match: No = +0
   - Total: 120 / 120 = 100% ✓

2. **authentication**:
   - Keywords: authentication (+20), oauth (+20) = +40
   - Patterns: /auth/i (+30), /oauth/i (+30) = +60
   - Title match: Yes (+25) = +25
   - Total: 125 / 125 = 100% ✓

**Labels Applied**: `question`, `authentication`

**Confidence Scores**: question: 100%, authentication: 100%

---

### Example 7: Good First Issue

**Issue Title**: "Fix typo in error message"

**Issue Body**: 
```
There's a simple typo in the error message on line 45.
It says "succesful" instead of "successful".
This is a minor fix that should be quick to address.
```

**Classification Process**:
1. **bug**:
   - Keywords: typo (+20), error (+20) = +40
   - Patterns: /error/i (+30) = +30
   - Title match: No = +0
   - Total: 70 / 95 = 73.7% ✓

2. **good first issue**:
   - Keywords: simple (+20), minor (+20), quick (+20) = +60
   - Patterns: /simple/i (+30), /minor/i (+30), /quick/i (+30) = +90
   - Title match: No = +0
   - Total: 150 / 150 = 100% ✓
   - Requires confidence ≥ 90%: ✓

**Labels Applied**: `bug`, `good first issue`

**Confidence Scores**: bug: 74%, good first issue: 100%

---

### Example 8: Blocked Issue

**Issue Title**: "Implement user profile page (blocked by #123)"

**Issue Body**: 
```
We need to implement a user profile page feature.
However, this is blocked by issue #123 which needs to be completed first.
We're waiting for the authentication system to be finalized.
```

**Classification Process**:
1. **feature**:
   - Keywords: feature (+20), implement (+20) = +40
   - Patterns: /implement/i (+30) = +30
   - Title match: No = +0
   - Total: 70 / 95 = 73.7% ✓

2. **blocked**:
   - Keywords: blocked (+20), waiting (+20) = +40
   - Patterns: /blocked/i (+30), /waiting for/i (+30) = +60
   - Title match: Yes (+25) = +25
   - Total: 125 / 125 = 100% ✓

3. **frontend**:
   - Keywords: page (+20) = +20
   - Patterns: None = +0
   - Title match: No = +0
   - Total: 20 / 20 = 100% ✓

**Labels Applied**: `feature`, `blocked`, `frontend`

**Confidence Scores**: feature: 74%, blocked: 100%, frontend: 100%

---

## Usage Guide

### Running the Workflow

#### Manual Trigger

1. Go to the **Actions** tab in your GitHub repository
2. Select **Auto Label Issues** workflow
3. Click **Run workflow**
4. Configure the inputs:
   - **Dry run**: Enable to test without applying labels
   - **Limit**: Maximum number of issues to process (0 = all)
   - **Since**: Only process issues created after this date (YYYY-MM-DD)
   - **Remove triage**: Remove triage label when other labels are applied
5. Click **Run workflow**

#### Example Configurations

**Test Run (Dry Run)**
```
Dry run: true
Limit: 10
Since: (empty)
Remove triage: false
```

**Production Run (Recent Issues)**
```
Dry run: false
Limit: 50
Since: 2024-01-01
Remove triage: true
```

**Full Repository Scan**
```
Dry run: false
Limit: 0
Since: (empty)
Remove triage: true
```

### Monitoring the Workflow

1. View the workflow run in the Actions tab
2. Check the logs for detailed classification results
3. Review the summary statistics at the end
4. Verify labels were applied correctly

### Troubleshooting

#### Workflow Failed

**Check**:
- GitHub Actions permissions (issues: write)
- Rate limit status in logs
- API token permissions

#### Labels Not Applied

**Check**:
- Dry run mode was disabled
- Confidence threshold (default: 60%)
- Labels already exist on issue
- Label exists in repository

#### Incorrect Labels Applied

**Solutions**:
- Adjust confidence threshold
- Update label keywords/patterns
- Add conflicting label rules
- Manually remove incorrect labels

---

## Maintenance Guide

### Adding New Labels

To add a new label, update the `LABELS` object in the workflow:

```javascript
newLabel: {
  category: 'core', // or 'technical', 'engineering', 'status', 'community', 'resolution'
  priority: 1, // 1-6, lower = higher priority
  autoApply: true, // false for manual-only labels
  requiresManualReview: false, // true for labels needing high confidence
  keywords: ['keyword1', 'keyword2'],
  patterns: [/pattern1/i, /pattern2/i],
  description: 'Label description'
}
```

### Updating Classification Rules

To improve classification accuracy:

1. **Add Keywords**: Add more relevant keywords to existing labels
2. **Add Patterns**: Add regex patterns for better matching
3. **Adjust Threshold**: Change `CONFIG.confidenceThreshold`
4. **Update Conflicts**: Add to `CONFLICTING_LABELS` array

### Example: Improving Bug Detection

```javascript
bug: {
  category: 'core',
  priority: 1,
  keywords: [
    'bug', 'crash', 'error', 'exception', 'fail', 'failure',
    'broken', 'incorrect', 'wrong', 'regression', 'not working',
    "doesn't work", 'unexpected', 'defect',
    // New keywords
    'glitch', 'malfunction', 'freeze', 'hang', 'stuck'
  ],
  patterns: [
    /crash/i,
    /error/i,
    /exception/i,
    /fail/i,
    /broken/i,
    /incorrect/i,
    /regression/i,
    /doesn't work/i,
    /not working/i,
    // New patterns
    /glitch/i,
    /freeze/i,
    /hang/i,
    /stuck/i
  ],
  description: 'Something isn\'t working'
}
```

### Performance Optimization

For large repositories (1000+ issues):

1. **Limit Processing**: Use the `limit` input
2. **Date Filter**: Use the `since` input for recent issues only
3. **Batch Processing**: Run workflow in batches
4. **Reduce Logging**: Set `verboseLogging: false` in CONFIG

### Monitoring Classification Accuracy

Regularly review labeled issues to:

1. Check for misclassified issues
2. Identify missing keywords/patterns
3. Adjust confidence thresholds
4. Update conflicting label rules

### Version Control

- Commit workflow changes to main branch
- Test in dry run mode first
- Document changes in commit messages
- Maintain changelog for rule updates

---

## Best Practices

1. **Always Test First**: Use dry run mode before production runs
2. **Start Small**: Process small batches initially (limit: 10-20)
3. **Review Results**: Check classification accuracy before full runs
4. **Iterate**: Gradually improve rules based on feedback
5. **Document Changes**: Keep track of rule updates and their impact
6. **Monitor Rate Limits**: Be aware of GitHub API rate limits
7. **Handle Edge Cases**: Add special rules for common edge cases
8. **Maintain Balance**: Don't over-fit rules to specific issues

---

## Conclusion

This auto-labeling workflow provides a robust, configurable solution for automatically classifying GitHub Issues. The confidence-based scoring system ensures accurate label application, while the conflict resolution and priority-based sorting maintain label consistency. The workflow is designed to be safe, idempotent, and maintainable for large open-source repositories.

For questions or issues, refer to the workflow logs or create an issue in the repository.
