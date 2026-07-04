/**
 * Promote a user to super_admin.
 *
 * Usage:
 *   bun run backend/src/scripts/promote-admin.ts [email protected]
 *
 * Or with tsx:
 *   tsx backend/src/scripts/promote-admin.ts [email protected]
 *
 * Idempotent — running twice is safe.
 */
import 'dotenv/config';
import mongoose from 'mongoose';
import { env } from '../config/env.js';
import { User } from '../models/User.js';

async function main() {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email) {
    // eslint-disable-next-line no-console
    console.error('Usage: tsx promote-admin.ts <email>');
    process.exit(1);
  }

  await mongoose.connect(env.MONGO_URI);

  const result = await User.updateOne(
    { email },
    { $addToSet: { roles: 'super_admin' } },
  );

  if (result.matchedCount === 0) {
    // eslint-disable-next-line no-console
    console.error(`No user found with email "${email}"`);
    await mongoose.disconnect();
    process.exit(1);
  }

  const user = await User.findOne({ email }).select('email name roles');
  // eslint-disable-next-line no-console
  console.log('OK — user promoted:');
  // eslint-disable-next-line no-console
  console.log({ email: user?.email, name: user?.name, roles: user?.roles });

  await mongoose.disconnect();
}

main().catch((err) => {
  // eslint-disable-next-line no-console
  console.error('Failed:', err);
  process.exit(1);
});
