export const supportUsers = [
  ['Khushi Ray', 'khushi.ray@pulsedesk.example'],
  ['Aisha Sharma', 'aisha.sharma@pulsedesk.example'],
  ['Rohan Mehta', 'rohan.mehta@pulsedesk.example'],
  ['Neha Kapoor', 'neha.kapoor@pulsedesk.example'],
  ['Arjun Rao', 'arjun.rao@pulsedesk.example'],
  ['Vikram Singh', 'vikram.singh@pulsedesk.example'],
].map(([name, email], index) => ({ id: `50000000-0000-4000-8000-${String(index + 1).padStart(12, '0')}`, name, email }));

export function seedSupportUsers(prisma) {
  // Resolve by canonical email, preserving existing identities and profile edits.
  return prisma.$transaction(supportUsers.map((user) => prisma.user.upsert({ where: { email: user.email }, update: {}, create: user })));
}
