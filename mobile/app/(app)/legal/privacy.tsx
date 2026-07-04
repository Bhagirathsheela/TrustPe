import { LegalPage } from '../../../components/LegalPage';
import { PRIVACY_POLICY } from '../../../lib/legal/privacy-policy';

export default function PrivacyPolicyScreen() {
  return <LegalPage title="Privacy Policy" doc={PRIVACY_POLICY} backFallback="/settings" />;
}
