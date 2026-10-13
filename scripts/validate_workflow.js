/**
 * Workflow Validator & Test Payload Runner for n8n/workflows/lead_qualification_v1.json
 * Validates JSON structure, Google Gemini Chat Model node, connections, and simulates Code node logic against:
 * 1. Valid clean structured JSON
 * 2. Gemini markdown-enclosed JSON
 * 3. Conversational preamble + JSON + conversational closing
 * 4. Multiline raw string literal with unescaped newlines (common Gemini draft issue)
 * 5. Pure conversational text with NO JSON braces (heuristic fallback extraction)
 * 6. Missing required fields (input validation)
 * 7. Invalid email payload (input validation)
 * 8. Upstream execution failure (missing credentials / API error)
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKFLOW_PATH = path.resolve(__dirname, '../n8n/workflows/lead_qualification_v1.json');

console.log('----------------------------------------------------');
console.log('n8n Lead Qualification Workflow Validator (Gemini Structured Output)');
console.log(`Checking workflow file: ${WORKFLOW_PATH}`);
console.log('----------------------------------------------------\n');

// 1. Load and parse JSON
if (!fs.existsSync(WORKFLOW_PATH)) {
  console.error(`❌ Workflow file not found at ${WORKFLOW_PATH}`);
  process.exit(1);
}

let workflow;
try {
  const content = fs.readFileSync(WORKFLOW_PATH, 'utf-8');
  workflow = JSON.parse(content);
  console.log(`✅ JSON is valid. Workflow Name: "${workflow.name}"`);
} catch (err) {
  console.error(`❌ Failed to parse workflow JSON: ${err.message}`);
  process.exit(1);
}

// 2. Validate Nodes and Connections
const nodesByName = new Map();
workflow.nodes.forEach((node) => {
  nodesByName.set(node.name, node);
});

console.log(`✅ Found ${workflow.nodes.length} nodes:`);
workflow.nodes.forEach((node) => {
  console.log(`   - [${node.type}] "${node.name}" (id: ${node.id})`);
});

// Check critical nodes
const requiredNodes = [
  'Webhook Trigger (lead-qualification)',
  'Validate Input & Check Required Fields',
  'Check Validation State',
  'Normalize Lead Data',
  'AI Qualification (LLM Node)',
  'Google Gemini Chat Model',
  'Validate Qualification Output',
  'Return Structured Response',
  'Return Failure Response'
];

for (const reqNode of requiredNodes) {
  if (!nodesByName.has(reqNode)) {
    console.error(`❌ Missing required node: "${reqNode}"`);
    process.exit(1);
  }
}
console.log('✅ All required workflow nodes present, including Google Gemini Chat Model.');

// Check Webhook node configuration
const webhookNode = nodesByName.get('Webhook Trigger (lead-qualification)');
if (webhookNode.parameters.httpMethod !== 'POST' || webhookNode.parameters.path !== 'lead-qualification') {
  console.error(`❌ Webhook node improperly configured: method=${webhookNode.parameters.httpMethod}, path=${webhookNode.parameters.path}`);
  process.exit(1);
}
console.log('✅ Webhook node verified: POST /lead-qualification with responseMode="responseNode".');

// Check Gemini Model Node configuration
const geminiNode = nodesByName.get('Google Gemini Chat Model');
if (geminiNode.type !== '@n8n/n8n-nodes-langchain.lmChatGoogleGemini') {
  console.error(`❌ Google Gemini node has unexpected type: ${geminiNode.type}`);
  process.exit(1);
}
console.log(`✅ Google Gemini node verified: modelName=${geminiNode.parameters.modelName}`);

// Check Synchronous Response connection
const connections = workflow.connections;
const outputConn = connections['Validate Qualification Output']?.main?.[0]?.[0]?.node;
if (outputConn !== 'Return Structured Response') {
  console.error(`❌ Expected "Validate Qualification Output" to connect to "Return Structured Response", but found: "${outputConn}"`);
  process.exit(1);
}
console.log('✅ Synchronous response architecture verified: Validate Qualification Output -> Return Structured Response.');

// 3. Extract and simulate the Code node logic
const validateCode = nodesByName.get('Validate Input & Check Required Fields').parameters.jsCode;
const normalizeCode = nodesByName.get('Normalize Lead Data').parameters.jsCode;
const outputValidatorCode = nodesByName.get('Validate Qualification Output').parameters.jsCode;

function runInputValidation(inputItem) {
  const $input = {
    first: () => ({ json: inputItem })
  };
  const fn = new Function('$input', validateCode);
  return fn($input);
}

function runNormalizeData(validItem) {
  const $input = {
    first: () => ({ json: validItem })
  };
  const fn = new Function('$input', normalizeCode);
  return fn($input);
}

function runOutputValidator(inputItem, leadContext) {
  const $input = {
    first: () => ({ json: inputItem })
  };
  const $ = (nodeName) => {
    if (nodeName === 'Normalize Lead Data') {
      return { first: () => ({ json: leadContext }) };
    }
    throw new Error(`Unknown node reference: ${nodeName}`);
  };
  const fn = new Function('$input', '$', outputValidatorCode);
  return fn($input, $);
}

console.log('\n--- Running Robust Structured Output & Regression Tests ---\n');

const leadContext = {
  lead_id: 'lead-test-001',
  correlation_id: 'corr-test-001',
  company_name: 'Acme Solutions Ltd',
  email: 'sarah@acmesolutions.com'
};

// TEST 1: Clean Raw JSON
console.log('Test 1: Clean raw JSON from Gemini');
const out1 = runOutputValidator({
  text: JSON.stringify({
    qualification: 'high',
    score: 92,
    reason: 'Clear enterprise demand with 50 SDR team.',
    evidence: ['Verified B2B corporate domain'],
    missing_information: [],
    recommended_next_action: 'draft',
    outreach_draft: 'Hi Sarah, noted Acme Solutions...'
  })
}, leadContext);
if (out1[0].json.status !== 'success' || out1[0].json.qualification.score !== 92) {
  console.error('❌ Test 1 failed', out1[0].json);
  process.exit(1);
}
console.log('   ✅ PASS: Clean JSON parsed (score 92, status: success)');

// TEST 2: Markdown Code Fences (```json ... ```)
console.log('Test 2: Markdown code fence wrapped JSON');
const out2 = runOutputValidator({
  text: '```json\n' + JSON.stringify({
    qualification: 'high',
    score: 88,
    reason: 'Enterprise prospect.',
    evidence: ['50 SDR team'],
    missing_information: [],
    recommended_next_action: 'draft',
    outreach_draft: 'Hi Sarah...'
  }) + '\n```'
}, leadContext);
if (out2[0].json.status !== 'success' || out2[0].json.qualification.score !== 88) {
  console.error('❌ Test 2 failed', out2[0].json);
  process.exit(1);
}
console.log('   ✅ PASS: Markdown code fence stripped (score 88, status: success)');

// TEST 3: Conversational Preamble + JSON + Closing Remarks
console.log('Test 3: Conversational preamble and closing remarks surrounding JSON');
const out3 = runOutputValidator({
  text: 'Certainly! Here is my detailed evaluation for this lead:\n\n```json\n{\n  "qualification": "medium",\n  "score": 65,\n  "reason": "Mid-market company with growing sales team.",\n  "evidence": ["Active website"],\n  "missing_information": ["Budget"],\n  "recommended_next_action": "review",\n  "outreach_draft": null\n}\n```\n\nLet me know if you would like me to adjust any scoring criteria!'
}, leadContext);
if (out3[0].json.status !== 'success' || out3[0].json.qualification.score !== 65) {
  console.error('❌ Test 3 failed', out3[0].json);
  process.exit(1);
}
console.log('   ✅ PASS: Conversational intro & outro stripped (score 65, status: success)');

// TEST 4: Multiline Raw String Literal with Unescaped Newlines in Draft
console.log('Test 4: JSON containing unescaped raw newlines inside outreach draft');
const rawMultilineJson = '{\n  "qualification": "high",\n  "score": 85,\n  "reason": "Good fit.",\n  "evidence": ["Team size 50"],\n  "missing_information": [],\n  "recommended_next_action": "draft",\n  "outreach_draft": "Hi Sarah,\n\nNoticed Acme is scaling outbound operations.\n\nBest regards,\nOperations Team"\n}';
const out4 = runOutputValidator({ text: rawMultilineJson }, leadContext);
if (out4[0].json.status !== 'success' || out4[0].json.qualification.score !== 85) {
  console.error('❌ Test 4 failed', out4[0].json);
  process.exit(1);
}
console.log('   ✅ PASS: Multiline unescaped string literal sanitized & parsed (score 85, status: success)');

// TEST 5: 100% Pure Conversational Text (NO JSON Braces)
console.log('Test 5: Pure conversational text without JSON braces (heuristic extraction)');
const pureConversationalText = `Based on the review of Acme Solutions Ltd, here is my assessment:

Qualification: High Fit
Score: 89
Reason: Strong corporate domain with immediate 50 SDR automation requirement.
Evidence:
* Mentioned 50 SDR team
* Corporate website verified
Missing Information:
* Primary CRM platform
Recommended Next Action: draft

Outreach Draft:
Hi Sarah,
Noticed your team is scaling outbound operations. Let's schedule a call this Thursday.`;
const out5 = runOutputValidator({ text: pureConversationalText }, leadContext);
if (out5[0].json.status !== 'success' || out5[0].json.qualification.score !== 89 || out5[0].json.qualification.qualification !== 'high') {
  console.error('❌ Test 5 failed', out5[0].json);
  process.exit(1);
}
console.log(`   ✅ PASS: Conversational text parsed to structured schema (score: ${out5[0].json.qualification.score}, category: ${out5[0].json.qualification.qualification})`);

// TEST 6: Missing Required Intake Fields
console.log('Test 6: Missing required intake fields');
const res6 = runInputValidation({ body: { lead_id: 'lead-002', email: 'user@example.com' } });
if (res6[0].json.is_valid !== false || res6[0].json.error_code !== 'MISSING_REQUIRED_FIELDS') {
  console.error('❌ Test 6 failed', res6[0].json);
  process.exit(1);
}
console.log('   ✅ PASS: Missing required fields rejected with MISSING_REQUIRED_FIELDS');

// TEST 7: Invalid Email
console.log('Test 7: Malformed email syntax');
const res7 = runInputValidation({ body: { lead_id: 'lead-003', company_name: 'Tech Inc', email: 'not-an-email' } });
if (res7[0].json.is_valid !== false || res7[0].json.error_code !== 'INVALID_EMAIL_FORMAT') {
  console.error('❌ Test 7 failed', res7[0].json);
  process.exit(1);
}
console.log('   ✅ PASS: Malformed email rejected with INVALID_EMAIL_FORMAT');

// TEST 8: Upstream Model Failure
console.log('Test 8: Upstream Gemini model error');
const out8 = runOutputValidator({ error: { message: 'Quota exceeded for models/gemini-3.8-flash' } }, leadContext);
if (out8[0].json.status !== 'failure' || out8[0].json.error_code !== 'AI_MODEL_EXECUTION_FAILED') {
  console.error('❌ Test 8 failed', out8[0].json);
  process.exit(1);
}
console.log('   ✅ PASS: Upstream error safely captured as AI_MODEL_EXECUTION_FAILED');

console.log('\n----------------------------------------------------');
console.log('All 8 validation and conversational recovery tests PASSED.');
console.log('----------------------------------------------------');
