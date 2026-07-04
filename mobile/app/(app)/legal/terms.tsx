import { LegalPage } from '../../../components/LegalPage';
import { TERMS } from '../../../lib/legal/terms';

export default function TermsScreen() {
  return <LegalPage title="Terms & Conditions" doc={TERMS} backFallback="/settings" />;
}
