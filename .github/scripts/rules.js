/**
 * Auto Label Issues - Rules Configuration
 * 
 * This file contains all label definitions, classification rules,
 * and conflict resolution logic for the auto-labeling workflow.
 * 
 * Architecture:
 * - LABELS: All label definitions with keywords and patterns
 * - CONFLICTING_LABELS: Groups of mutually exclusive labels
 * - loadRules(): Export function to load rules
 */

// =============================================================================
// LABEL DEFINITIONS
// =============================================================================
// All available labels with their classification rules
// =============================================================================

const LABELS = {
  // Core Issue Types
  // Only bug, feature, and question are mutually exclusive
  // documentation and enhancement can be combined with other labels
  bug: {
    category: 'core',
    priority: 1,
    keywords: [
      'bug', 'crash', 'error', 'exception', 'fail', 'failure',
      'broken', 'incorrect', 'wrong', 'regression', 'not working',
      "doesn't work", 'unexpected', 'unexpected behavior', 'defect',
      'glitch', 'malfunction', 'freeze', 'hang', 'stuck'
    ],
    patterns: [
      /\bcrash\b/i,
      /\berror\b/i,
      /\bexception\b/i,
      /\bfail\b/i,
      /\bbroken\b/i,
      /\bincorrect\b/i,
      /\bregression\b/i,
      /doesn't work/i,
      /not working/i,
      /\bglitch\b/i,
      /\bfreeze\b/i,
      /\bhang\b/i,
      /\bstuck\b/i
    ],
    description: 'Something isn\'t working'
  },
  
  feature: {
    category: 'core',
    priority: 1,
    keywords: [
      'feature', 'new', 'add', 'implement', 'support', 'capability',
      'request', 'proposal', 'new feature', 'new functionality'
    ],
    patterns: [
      /feature request/i,
      /new feature/i,
      /add support for/i,
      /\bimplement\b/i,
      /new capability/i,
      /would be nice/i,
      /it would be great/i
    ],
    description: 'New functionality or feature request'
  },
  
  question: {
    category: 'core',
    priority: 1,
    keywords: [
      'question', 'help', 'how to', 'how do i', 'clarification',
      'support', 'asking', 'wondering', 'confused'
    ],
    patterns: [
      /\?$/,
      /how do i/i,
      /how to/i,
      /\bquestion\b/i,
      /\bhelp\b/i,
      /\bclarification\b/i,
      /can someone/i
    ],
    description: 'Question or support request'
  },
  
  // These can be combined with core types
  enhancement: {
    category: 'core',
    priority: 2,
    keywords: [
      'enhancement', 'improve', 'improvement', 'optimize', 'better',
      'enhance', 'refine', 'polish', 'upgrade', 'usability'
    ],
    patterns: [
      /\benhancement\b/i,
      /\bimprove\b/i,
      /\boptimization\b/i,
      /make it better/i,
      /\benhance\b/i,
      /\busability\b/i
    ],
    description: 'Improvement to existing functionality'
  },
  
  documentation: {
    category: 'core',
    priority: 2,
    keywords: [
      'documentation', 'docs', 'readme', 'guide', 'tutorial',
      'document', 'api docs', 'missing docs', 'outdated docs'
    ],
    patterns: [
      /\bdocumentation\b/i,
      /\breadme\b/i,
      /\bguide\b/i,
      /\btutorial\b/i,
      /api docs/i,
      /missing documentation/i
    ],
    description: 'Improvements to documentation'
  },
  
  // Technical Areas
  frontend: {
    category: 'technical',
    priority: 3,
    keywords: [
      'frontend', 'react', 'vue', 'angular', 'ui', 'component',
      'client', 'browser', 'css', 'html', 'javascript', 'typescript',
      'interface', 'view', 'page', 'screen'
    ],
    patterns: [
      /\bfrontend\b/i,
      /\breact\b/i,
      /\bvue\b/i,
      /\bangular\b/i,
      /ui component/i,
      /client.?side/i,
      /\bbrowser\b/i
    ],
    description: 'Frontend or client-side issue'
  },
  
  backend: {
    category: 'technical',
    priority: 3,
    keywords: [
      'backend', 'server', 'service', 'controller',
      'business logic', 'server-side', 'microservice'
    ],
    patterns: [
      /\bbackend\b/i,
      /server.?side/i,
      /\bservice\b/i,
      /\bcontroller\b/i,
      /business logic/i
    ],
    description: 'Backend or server-side issue'
  },
  
  api: {
    category: 'technical',
    priority: 3,
    keywords: [
      'rest', 'graphql', 'endpoint', 'request', 'response',
      'http', 'webhook', 'integration', 'sdk', 'client library'
    ],
    patterns: [
      /\brest\b/i,
      /\bgraphql\b/i,
      /\bendpoint\b/i,
      /\bhttp\b/i,
      /\bwebhook\b/i
    ],
    description: 'API or integration issue'
  },
  
  database: {
    category: 'technical',
    priority: 3,
    keywords: [
      'database', 'sql', 'nosql', 'migration', 'schema',
      'query', 'index', 'mongodb', 'postgres', 'mysql', 'redis'
    ],
    patterns: [
      /\bdatabase\b/i,
      /\bmigration\b/i,
      /\bschema\b/i,
      /\bquery\b/i,
      /\bmongodb\b/i,
      /\bpostgres\b/i,
      /\bmysql\b/i
    ],
    description: 'Database or data storage issue'
  },
  
  // Authentication - focused on auth mechanisms only
  authentication: {
    category: 'technical',
    priority: 3,
    keywords: [
      'login', 'signup', 'oauth', 'jwt',
      'session', 'permission', 'authorization', 'access'
    ],
    patterns: [
      /\blogin\b/i,
      /\bsignup\b/i,
      /\boauth\b/i,
      /\bjwt\b/i,
      /\bsession\b/i,
      /\bpermission\b/i,
      /\bauthorization\b/i
    ],
    description: 'Authentication or authorization issue'
  },
  
  ui: {
    category: 'technical',
    priority: 3,
    keywords: [
      'ui', 'visual', 'design', 'layout', 'styling', 'css',
      'theme', 'appearance', 'responsive', 'mobile', 'desktop'
    ],
    patterns: [
      /\bui\b/i,
      /\bvisual\b/i,
      /\bdesign\b/i,
      /\blayout\b/i,
      /\bstyling\b/i,
      /\bcss\b/i,
      /\btheme\b/i
    ],
    description: 'User interface or visual design issue'
  },
  
  ux: {
    category: 'technical',
    priority: 3,
    keywords: [
      'ux', 'user experience', 'workflow', 'usability', 'accessibility',
      'a11y', 'navigation', 'interaction', 'user flow'
    ],
    patterns: [
      /\bux\b/i,
      /user experience/i,
      /\busability\b/i,
      /\baccessibility\b/i,
      /\ba11y\b/i,
      /\bworkflow\b/i
    ],
    description: 'User experience or usability issue'
  },
  
  // Engineering Categories
  // Security - requires stronger evidence (specific security terms)
  security: {
    category: 'engineering',
    priority: 4,
    keywords: [
      'vulnerability', 'xss', 'csrf', 'sql injection',
      'secret', 'credential', 'hack',
      'exploit', 'cve', 'injection', 'attack', 'breach',
      'secrets exposure'
    ],
    patterns: [
      /\bvulnerability\b/i,
      /\bxss\b/i,
      /\bcsrf\b/i,
      /sql injection/i,
      /\bsecret\b/i,
      /\bcredential\b/i,
      /\bhack\b/i,
      /\bexploit\b/i,
      /\bcve\b/i,
      /\binjection\b/i,
      /\battack\b/i,
      /\bbreach\b/i
    ],
    requiresStrongEvidence: true,
    description: 'Security vulnerability or concern'
  },
  
  performance: {
    category: 'engineering',
    priority: 4,
    keywords: [
      'performance', 'slow', 'latency', 'memory', 'leak',
      'optimize', 'optimization', 'speed', 'fast', 'resource',
      'cpu', 'load', 'bottleneck', 'scalability'
    ],
    patterns: [
      /\bperformance\b/i,
      /\bslow\b/i,
      /\blatency\b/i,
      /memory leak/i,
      /\boptimization\b/i,
      /\bspeed\b/i,
      /\bbottleneck\b/i
    ],
    description: 'Performance or scalability issue'
  },
  
  refactor: {
    category: 'engineering',
    priority: 4,
    keywords: [
      'refactor', 'cleanup', 'technical debt', 'restructure',
      'maintainability', 'code quality', 'simplify', 'reorganize'
    ],
    patterns: [
      /\brefactor\b/i,
      /\bcleanup\b/i,
      /technical debt/i,
      /\brestructure\b/i,
      /\bmaintainability\b/i,
      /code quality/i
    ],
    description: 'Code refactoring or cleanup'
  },
  
  dependencies: {
    category: 'engineering',
    priority: 4,
    keywords: [
      'dependency', 'package', 'library', 'upgrade', 'update',
      'version', 'npm', 'yarn', 'pip', 'maven', 'gradle'
    ],
    patterns: [
      /\bdependenc/i,
      /\bpackage\b/i,
      /\blibrary\b/i,
      /\bupgrade\b/i,
      /\bupdate\b/i,
      /\bversion\b/i
    ],
    description: 'Dependency or package management issue'
  },
  
  ci: {
    category: 'engineering',
    priority: 4,
    keywords: [
      'ci', 'cd', 'github actions', 'pipeline', 'build', 'deploy',
      'workflow', 'automation', 'test', 'continuous integration'
    ],
    patterns: [
      /\bci\b/i,
      /\bcd\b/i,
      /github action/i,
      /\bpipeline\b/i,
      /\bbuild\b/i,
      /\bdeploy\b/i,
      /\bworkflow\b/i
    ],
    description: 'CI/CD or build automation issue'
  },
  
  // Workflow Status
  triage: {
    category: 'status',
    priority: 5,
    autoApply: true, // Applied when no meaningful labels detected
    description: 'Issue needs triage'
  },
  
  'needs-review': {
    category: 'status',
    priority: 5,
    autoApply: true,
    description: 'Issue needs maintainer review'
  },
  
  'in-progress': {
    category: 'status',
    priority: 5,
    autoApply: false, // Applied manually
    description: 'Issue is being worked on'
  },
  
  blocked: {
    category: 'status',
    priority: 5,
    keywords: [
      'blocked', 'waiting', 'dependency', 'blocked by', 'depends on',
      'hold', 'stalled', 'waiting for'
    ],
    patterns: [
      /\bblocked\b/i,
      /waiting for/i,
      /blocked by/i,
      /depends on/i,
      /on hold/i
    ],
    description: 'Issue is blocked by another issue or dependency'
  },
  
  // Community Labels
  // Good First Issue - requires extremely high confidence and specific criteria
  'good first issue': {
    category: 'community',
    priority: 6,
    requiresHighConfidence: true,
    requiresSmallScope: true,
    keywords: [
      'simple', 'easy', 'small', 'minor', 'quick', 'beginner',
      'good first issue', 'starter', 'introductory'
    ],
    patterns: [
      /good first issue/i,
      /\bsimple\b/i,
      /\beasy\b/i,
      /\bsmall\b/i,
      /\bminor\b/i,
      /\bquick\b/i,
      /\bbeginner\b/i
    ],
    description: 'Good for newcomers'
  },
  
  'help wanted': {
    category: 'community',
    priority: 6,
    keywords: [
      'help wanted', 'community', 'contributions welcome', 'looking for help'
    ],
    patterns: [
      /help wanted/i,
      /contributions welcome/i,
      /looking for help/i
    ],
    description: 'Help needed from community'
  },
  
  // Resolution Labels
  duplicate: {
    category: 'resolution',
    priority: 7,
    autoApply: false, // Applied manually
    description: 'Duplicate of another issue'
  },
  
  wontfix: {
    category: 'resolution',
    priority: 7,
    autoApply: false, // Applied manually
    description: 'Issue will not be fixed'
  }
};

// =============================================================================
// CONFLICTING LABELS
// =============================================================================
// Labels that should not be applied together
// =============================================================================

const CONFLICTING_LABELS = [
  // Core types - only bug, feature, question are mutually exclusive
  ['bug', 'feature', 'question'],
  
  // Resolution labels
  ['duplicate', 'wontfix'],
  
  // Status labels
  ['triage', 'needs-review', 'in-progress', 'blocked'],
];

// =============================================================================
// EXPORT FUNCTION
// =============================================================================

function loadRules() {
  return {
    LABELS,
    CONFLICTING_LABELS
  };
}

module.exports = { loadRules };
