import { spawn } from 'node:child_process';

const rounds = process.env.NKN_DEMO_ROUNDS ?? '6';
const rttSamples = process.env.NKN_DEMO_RTT_SAMPLES ?? '10';

const command = process.platform === 'win32' ? 'node.exe' : 'node';
const args = ['src/integration/live-nkn-consensus.js'];

console.log('\n╔══════════════════════════════════════════════════════════════╗');
console.log('║              NKN VERIFIABLE AGENT NETWORK                  ║');
console.log('╚══════════════════════════════════════════════════════════════╝\n');
console.log('Question: can independent agents reach a verifiable result');
console.log('          over NKN without a centralized broker?\n');
console.log('Scenario');
console.log('  3 independent market observers + 1 Byzantine observer');
console.log('  signed evidence → quorum → adversarial filtering → resilience\n');
console.log('Starting live NKN network...\n');

const child = spawn(command, args, {
  env: {
    ...process.env,
    NKN_INTEGRATION_ROUNDS: rounds,
    NKN_RTT_SAMPLES: rttSamples,
  },
  stdio: ['inherit', 'pipe', 'pipe'],
});

let report = null;
let output = '';

const handleLine = (line) => {
  const trimmed = line.trim();
  if (!trimmed) return;
  output += `${trimmed}\n`;
  try {
    const event = JSON.parse(trimmed);
    if (event.phase === 'ready') {
      console.log('✓ NKN agents connected');
      console.log(`  Coordinator: ${event.coordinator}`);
      for (const worker of event.workers) console.log(`  ${worker.source.padEnd(12)} ${worker.address}`);
      console.log('');
    } else if (event.phase === 'consensus') {
      const decision = event.decision;
      const labels = event.observations.map((item) => {
        if (item.error) return `${item.source}=ERROR`;
        return `${item.source}=${item.price}`;
      }).join(' | ');
      console.log(`Round ${event.round}: ${labels}`);
      console.log(`  quorum=${decision.quorum} sources=${decision.sourceCount ?? 0} outliers=${(decision.outliers ?? []).join(',') || 'none'}`);
    } else if (event.phase === 'result') {
      report = event.report;
    }
  } catch {
    console.log(trimmed);
  }
};

child.stdout.on('data', (chunk) => chunk.toString().split('\n').forEach(handleLine));
child.stderr.on('data', (chunk) => process.stderr.write(chunk));

child.on('close', (code, signal) => {
  if (code !== 0) {
    console.error(`\n✗ Demo failed (exit=${code ?? 'null'} signal=${signal ?? 'none'})`);
    process.exitCode = code ?? 1;
    return;
  }

  if (!report) {
    console.error('\n✗ Demo completed without a final report');
    process.exitCode = 1;
    return;
  }

  const nkn = report.latencyMs.nkn;
  const central = report.latencyMs.centralizedLocalHttp;
  console.log('\n──────────────────────────────────────────────────────────────');
  console.log('VERIFICATION RESULT');
  console.log(`  Packet transport       ${report.protocol.packet ? '✓' : '✗'}`);
  console.log(`  Session transport      ${report.protocol.session ? '✓' : '✗'}`);
  console.log(`  Byzantine rejected     ${report.resilience.adversaryRejected ? '✓' : '✗'}`);
  console.log(`  Quorum survived loss   ${report.resilience.quorumSurvivedAdversaryFailure ? '✓' : '✗'}`);
  console.log(`  Unsafe quorum rejected ${report.resilience.quorumFailureDetected ? '✓' : '✗'}`);
  console.log('\nLATENCY (same live run)');
  console.log(`  NKN        p50=${nkn.p50}ms p95=${nkn.p95}ms p99=${nkn.p99}ms`);
  console.log(`  Local HTTP p50=${central.p50}ms p95=${central.p95}ms p99=${central.p99}ms`);
  console.log('\nInterpretation');
  console.log('  NKN is not presented as a latency winner.');
  console.log('  The demonstrated value is decentralized peer communication');
  console.log('  combined with independently verifiable agent consensus.\n');
});

child.on('error', (error) => {
  console.error(`\n✗ Unable to start demo: ${error.message}`);
  process.exitCode = 1;
});

process.on('SIGINT', () => child.kill('SIGINT'));
process.on('SIGTERM', () => child.kill('SIGTERM'));
