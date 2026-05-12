import jwt from 'jsonwebtoken';

const SECRET = process.env.AUTH_JWT_SECRET ?? 'dev-secret-change-me';

const tokens = [
  { sub: 'pd-001', role: 'project_director', kind: 'ocs' },
  { sub: 'ops-001', role: 'operations', kind: 'ocs' },
  { sub: 'contrib-001', role: 'contributor', kind: 'ocs' },
  { sub: 'mobile-001', role: null, kind: 'mobile' },
  { sub: 'mobile-002', role: null, kind: 'mobile' },
];

console.log('=== Demo Tokens (valid 30 days) ===\n');
for (const payload of tokens) {
  const token = jwt.sign(payload, SECRET, { expiresIn: '30d' });
  const label = payload.kind === 'ocs' ? `OCS/${payload.role}` : `Mobile/${payload.sub}`;
  console.log(`${label}:`);
  console.log(`  Bearer ${token}\n`);
}
