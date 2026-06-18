/**
 * Auto Label Issues - Main Classification Logic
 * * This file contains the main logic for automatically labeling GitHub Issues.
 * It fetches issues, calculates confidence scores, applies labels, and handles
 * all the classification logic.
 */

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Log message with timestamp
 */
function log(message, level = 'info') {
  const timestamp = new Date().toISOString();
  const prefix = `[${timestamp}] [${level.toUpperCase()}]`;
  console.log(`${prefix} ${message}`);
}

/**
 * Calculate confidence score for a label based on issue content
 * Uses weighted scoring: title weight > body weight
 */
function calculateConfidence(label, issue, rules) {
  const labelConfig = rules.LABELS[label];
  if (!labelConfig) return 0;
  
  let score = 0;
  let maxScore = 0;
  
  // Separate title and body for weighted scoring
  const title = issue.title.toLowerCase();
  const body = (issue.body || '').toLowerCase();
  
  // Title has higher weight (2x) than body
  const titleWeight = 2;
  const bodyWeight = 1;
  
  // Check keyword matches in title (weighted)
  if (labelConfig.keywords) {
    maxScore += labelConfig.keywords.length * 25 * titleWeight;
    labelConfig.keywords.forEach(keyword => {
      if (title.includes(keyword.toLowerCase())) {
        score += 25 * titleWeight;
      }
    });
  }
  
  // Check keyword matches in body (lower weight)
  if (labelConfig.keywords) {
    maxScore += labelConfig.keywords.length * 15 * bodyWeight;
    labelConfig.keywords.forEach(keyword => {
      if (body.includes(keyword.toLowerCase())) {
        score += 15 * bodyWeight;
      }
    });
  }
  
  // Check pattern matches in title (weighted)
  if (labelConfig.patterns) {
    maxScore += labelConfig.patterns.length * 35 * titleWeight;
    labelConfig.patterns.forEach(pattern => {
      if (pattern.test(title)) {
        score += 35 * titleWeight;
      }
    });
  }
  
  // Check pattern matches in body (lower weight)
  if (labelConfig.patterns) {
    maxScore += labelConfig.patterns.length * 20 * bodyWeight;
    labelConfig.patterns.forEach(pattern => {
      if (pattern.test(body)) {
        score += 20 * bodyWeight;
      }
    });
  }
  
  // Bonus if label name appears in title
  if (title.includes(label.toLowerCase())) {
    score += 30;
    maxScore += 30;
  }
  
  // Use raw weighted score instead of percentage normalization
  return Math.min(100, Math.round(score));
}

/**
 * Check if labels conflict
 */
function labelsConflict(label1, label2, rules) {
  for (const group of rules.CONFLICTING_LABELS) {
    if (group.includes(label1) && group.includes(label2)) {
      return true;
    }
  }
  return false;
}

/**
 * Resolve conflicting labels by keeping the highest confidence
 */
function resolveConflicts(labelScores, rules) {
  const resolved = {};
  
  for (const [label, score] of Object.entries(labelScores)) {
    let shouldAdd = true;
    
    // Check for conflicts with existing labels
    for (const existingLabel of Object.keys(resolved)) {
      if (labelsConflict(label, existingLabel, rules)) {
        // Keep the one with higher confidence
        if (score > resolved[existingLabel]) {
          delete resolved[existingLabel];
        } else {
          shouldAdd = false;
        }
      }
    }
    
    if (shouldAdd) {
      resolved[label] = score;
    }
  }
  
  return resolved;
}

/**
 * Check if issue qualifies as "good first issue"
 * Requires: small scope, clear acceptance criteria, limited files
 */
function isGoodFirstIssue(issue, confidence) {
  // Must have extremely high confidence
  if (confidence < 90) return false;
  
  // Check for small scope indicators
  const content = `${issue.title} ${issue.body || ''}`.toLowerCase();
  const smallScopeIndicators = ['simple', 'easy', 'small', 'minor', 'quick', 'typo', 'spelling'];
  const hasSmallScope = smallScopeIndicators.some(indicator => content.includes(indicator));
  
  // Check for clear acceptance criteria
  const hasAcceptanceCriteria = /acceptance|criteria|requirement|spec/i.test(issue.body || '');
  
  // Check if issue is too complex
  const complexIndicators = ['refactor', 'architecture', 'redesign', 'rewrite', 'migration'];
  const isComplex = complexIndicators.some(indicator => content.includes(indicator));
  
  return hasSmallScope && !isComplex;
}

/**
 * Fetch issues with pagination using GitHub Search API
 * Uses search API instead of listForRepo to support query parameters
 */
async function fetchIssues(github, context, config) {
  const issues = [];
  let page = 1;
  const perPage = 100;
  
  // Build search query
  let query = `is:issue is:open repo:${context.repo.owner}/${context.repo.repo}`;
  
  if (config.since) {
    query += ` created:>${config.since}`;
  }
  
  log(`Fetching issues with query: ${query}`);
  
  while (true) {
    try {
      // Use search API instead of listForRepo to support query parameters
      const response = await github.rest.search.issuesAndPullRequests({
        q: query,
        per_page: perPage,
        page: page,
        sort: 'created',
        order: 'desc'
      });
      
      if (response.data.items.length === 0) {
        break;
      }
      
      // Filter out pull requests (search API returns both)
      const issueItems = response.data.items.filter(item => !item.pull_request);
      issues.push(...issueItems);
      
      log(`Fetched ${issueItems.length} issues (page ${page})`);
      
      // Check if we've reached the limit
      if (config.limit > 0 && issues.length >= config.limit) {
        log(`Reached limit of ${config.limit} issues`);
        break;
      }
      
      // Check if we've fetched all available issues
      if (response.data.items.length < perPage) {
        log(`Fetched all available issues (${response.data.total_count} total)`);
        break;
      }
      
      page++;
      
      // Small delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 500));
      
    } catch (error) {
      log(`Error fetching issues: ${error.message}`, 'error');
      
      // Retry logic
      if (page <= config.maxRetries) {
        log(`Retrying (attempt ${page}/${config.maxRetries})`, 'warn');
        await new Promise(resolve => setTimeout(resolve, config.retryDelay));
        continue;
      } else {
        throw error;
      }
    }
  }
  
  return issues;
}

/**
 * Apply labels to an issue
 */
async function applyLabels(github, context, config, issueNumber, labels) {
  if (config.dryRun) {
    log(`[DRY RUN] Would apply labels to #${issueNumber}: ${labels.join(', ')}`);
    return;
  }
  
  try {
    await github.rest.issues.addLabels({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issueNumber,
      labels: labels
    });
    
    log(`Applied labels to #${issueNumber}: ${labels.join(', ')}`);
  } catch (error) {
    log(`Error applying labels to #${issueNumber}: ${error.message}`, 'error');
  }
}

/**
 * Remove a label from an issue
 */
async function removeLabel(github, context, config, issueNumber, label) {
  if (config.dryRun) {
    log(`[DRY RUN] Would remove label "${label}" from #${issueNumber}`);
    return;
  }
  
  try {
    await github.rest.issues.removeLabel({
      owner: context.repo.owner,
      repo: context.repo.repo,
      issue_number: issueNumber,
      name: label
    });
    
    log(`Removed label "${label}" from #${issueNumber}`);
  } catch (error) {
    // Ignore error if label doesn't exist
    if (error.status !== 404) {
      log(`Error removing label from #${issueNumber}: ${error.message}`, 'error');
    }
  }
}

/**
 * Log structured classification results for an issue
 */
function logClassificationResults(issue, labelScores, labelsToAdd, labelsSkipped, reasoning) {
  log(`\n=== Issue #${issue.number} Classification ===`);
  log(`Title: ${issue.title}`);
  log(`Detected labels: ${Object.keys(labelScores).join(', ')}`);
  log(`Confidence scores: ${JSON.stringify(labelScores)}`);
  log(`Labels to add: ${labelsToAdd.join(', ') || 'none'}`);
  log(`Labels skipped: ${labelsSkipped.join(', ') || 'none'}`);
  if (reasoning) {
    log(`Reasoning: ${reasoning}`);
  }
  log(`========================================\n`);
}

// =============================================================================
// MAIN CLASSIFICATION LOGIC
// =============================================================================

async function autoLabelIssues(github, context, config, rules) {
  log('=== Auto Label Issues Workflow Started ===');
  log(`Configuration: ${JSON.stringify({
    dryRun: config.dryRun,
    limit: config.limit,
    since: config.since,
    removeTriage: config.removeTriage,
    confidenceThreshold: config.confidenceThreshold
  })}`);
  
  // Fetch issues
  const issues = await fetchIssues(github, context, config);
  log(`Total issues to process: ${issues.length}`);
  
  let processedCount = 0;
  let labeledCount = 0;
  let skippedCount = 0;
  let triageAppliedCount = 0;
  
  for (const issue of issues) {
    processedCount++;
    
    // Get existing labels
    const existingLabels = issue.labels.map(l => l.name.toLowerCase());
    
    // Calculate confidence scores for all labels
    const labelScores = {};
    
    for (const labelName of Object.keys(rules.LABELS)) {
      const labelConfig = rules.LABELS[labelName];
      
      // Skip labels that shouldn't be auto-applied
      if (labelConfig.autoApply === false) {
        continue;
      }
      
      // Skip if label already exists
      if (existingLabels.includes(labelName.toLowerCase())) {
        continue;
      }
      
      const confidence = calculateConfidence(labelName, issue, rules);
      
      // Security labels require stronger evidence
      if (labelConfig.requiresStrongEvidence && confidence < 50) {
        continue;
      }
      
      // Good First Issue requires special criteria
      if (labelName === 'good first issue' && !isGoodFirstIssue(issue, confidence)) {
        continue;
      }
      
      if (confidence > 0) {
        labelScores[labelName] = confidence;
      }
    }
    
    // Resolve conflicts
    const resolvedLabels = resolveConflicts(labelScores, rules);
    
    // Filter by confidence threshold
    const filteredLabels = {};
    for (const [label, score] of Object.entries(resolvedLabels)) {
      if (score >= config.confidenceThreshold) {
        filteredLabels[label] = score;
      }
    }
    
    // Sort purely by confidence (highest first) up to max labels limit
    const sortedLabels = Object.entries(filteredLabels)
      .sort((a, b) => b[1] - a[1])
      .slice(0, config.maxLabelsPerIssue)
      .map(([label]) => label);
    
    // Determine labels to add
    const labelsToAdd = [];
    const labelsSkipped = [];
    let reasoning = '';
    
    // Check if we have meaningful labels
    const hasMeaningfulLabels = sortedLabels.length > 0 && 
                               !sortedLabels.includes('triage');
    
    if (hasMeaningfulLabels) {
      labelsToAdd.push(...sortedLabels);
      
      // Add needs-review if confidence is high
      const maxConfidence = Math.max(...Object.values(filteredLabels));
      if (maxConfidence >= config.confidenceThreshold + 20) {
        if (!existingLabels.includes('needs-review') && !sortedLabels.includes('needs-review')) {
          labelsToAdd.push('needs-review');
        }
      }
      
      reasoning = `Meaningful labels detected with confidence ${maxConfidence}%`;
      
      // Remove triage label if configured
      if (config.removeTriage && existingLabels.includes('triage')) {
        await removeLabel(github, context, config, issue.number, 'triage');
      }
      
      labeledCount++;
    } else {
      // No meaningful labels - apply triage
      if (!existingLabels.includes('triage')) {
        labelsToAdd.push('triage');
        reasoning = 'No meaningful labels detected, applying triage';
        triageAppliedCount++;
      } else {
        reasoning = 'No meaningful labels detected, triage already exists';
      }
      
      skippedCount++;
    }
    
    // Apply labels
    if (labelsToAdd.length > 0) {
      await applyLabels(github, context, config, issue.number, labelsToAdd);
    }
    
    // Log structured results
    logClassificationResults(issue, labelScores, labelsToAdd, labelsSkipped, reasoning);
  }
  
  // Final summary
  log('\n=== Workflow Summary ===');
  log(`Total issues processed: ${processedCount}`);
  log(`Issues labeled: ${labeledCount}`);
  log(`Issues skipped: ${skippedCount}`);
  log(`Triage labels applied: ${triageAppliedCount}`);
  log(`Dry run mode: ${config.dryRun}`);
  log('=== Auto Label Issues Workflow Completed ===');
}

module.exports = { autoLabelIssues };
