/**
 * PinCodeLookup — bottom sheet for finding a village / town via India PIN code.
 *
 * Strategy (in order):
 *   1. Try India Post's api.postalpincode.in (richer data: name + district + state)
 *   2. If that fails, try api.zippopotam.us (more reliable globally; lacks district)
 *   3. If both fail, fall through to manual entry — user types village/area,
 *      district, and state directly. This guarantees the flow always completes
 *      even on restrictive networks (corporate Wi-Fi, ISP-level blocks, etc.).
 *
 * All API errors are logged to the Metro console with the URL + status, so
 * "Network request failed" stays diagnosable.
 */
import { useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  TextInput as RNTextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { colors, radii, spacing, typography } from '../constants/theme';
import { BodyText } from './BodyText';
import { Button } from './Button';
import { Heading } from './Heading';

/** Unified shape both upstream APIs are normalized into. */
type LocationResult = {
  name: string;
  district?: string;
  state: string;
  country: string;
  pincode: string;
};

type PostOfficeApiEnvelope = {
  Message: string;
  Status: 'Success' | 'Error' | '404';
  PostOffice:
    | Array<{
        Name: string;
        BranchType?: string;
        District: string;
        State: string;
        Country: string;
        Pincode: string;
      }>
    | null;
};

type ZippopoEnvelope = {
  'post code': string;
  country: string;
  'country abbreviation': string;
  places: Array<{
    'place name': string;
    state: string;
    'state abbreviation': string;
  }>;
};

const FETCH_TIMEOUT_MS = 10_000;

function cleanName(name: string): string {
  return name.replace(/\s+(B\.O\.?|S\.O\.?|H\.O\.?|GPO|HPO)$/i, '').trim();
}

async function fetchWithTimeout(url: string): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': 'TrustPe-Mobile/0.1 (Expo)',
      },
      signal: controller.signal,
    });
    return res;
  } finally {
    clearTimeout(timeoutId);
  }
}

/** Try India Post's official API. */
async function tryPostalPincode(pin: string): Promise<LocationResult[]> {
  const url = `https://api.postalpincode.in/pincode/${pin}`;
  // eslint-disable-next-line no-console
  console.log('[PinCodeLookup] GET', url);
  const res = await fetchWithTimeout(url);
  // eslint-disable-next-line no-console
  console.log('[PinCodeLookup] postalpincode response:', res.status);
  if (!res.ok) throw new Error(`postalpincode.in returned HTTP ${res.status}`);
  const text = await res.text();
  let data: PostOfficeApiEnvelope[];
  try {
    data = JSON.parse(text);
  } catch {
    throw new Error('postalpincode.in returned non-JSON response');
  }
  const envelope = Array.isArray(data) ? data[0] : null;
  if (!envelope) throw new Error('postalpincode.in returned empty response');
  if (envelope.Status !== 'Success') {
    throw new Error(envelope.Message || `postalpincode.in: ${envelope.Status}`);
  }
  return (envelope.PostOffice ?? []).map((po) => ({
    name: cleanName(po.Name),
    district: po.District,
    state: po.State,
    country: po.Country,
    pincode: po.Pincode,
  }));
}

/** Fallback to zippopotam.us (less detail — no district — but more reachable). */
async function tryZippopotam(pin: string): Promise<LocationResult[]> {
  const url = `https://api.zippopotam.us/in/${pin}`;
  // eslint-disable-next-line no-console
  console.log('[PinCodeLookup] GET (fallback)', url);
  const res = await fetchWithTimeout(url);
  // eslint-disable-next-line no-console
  console.log('[PinCodeLookup] zippopotam response:', res.status);
  if (res.status === 404) throw new Error('No locations found for this PIN code');
  if (!res.ok) throw new Error(`zippopotam.us returned HTTP ${res.status}`);
  const data = (await res.json()) as ZippopoEnvelope;
  return (data.places ?? []).map((p) => ({
    name: p['place name'],
    state: p.state,
    country: 'India',
    pincode: data['post code'],
  }));
}

async function lookupPin(pin: string): Promise<{ results: LocationResult[]; source: string }> {
  // Zippopotam first — it's reliably reachable and its TLS cert is valid.
  // postalpincode.in is technically richer (returns District too) but their
  // cert has been intermittently expired; when it's healthy it serves as a
  // refinement fallback. Roles swap automatically if/when they fix it.
  let firstError: unknown = null;
  try {
    const results = await tryZippopotam(pin);
    if (results.length > 0) return { results, source: 'Zippopotam' };
    throw new Error('No locations found for this PIN code');
  } catch (err) {
    firstError = err;
    // eslint-disable-next-line no-console
    console.warn('[PinCodeLookup] primary (zippopotam) failed, trying fallback:', err);
  }
  try {
    const results = await tryPostalPincode(pin);
    if (results.length > 0) return { results, source: 'India Post' };
    throw new Error('No locations found for this PIN code');
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[PinCodeLookup] fallback (postalpincode.in) failed:', err);
    const primaryMsg = firstError instanceof Error ? firstError.message : String(firstError);
    const fallbackMsg = err instanceof Error ? err.message : String(err);
    throw new Error(`${primaryMsg} (fallback: ${fallbackMsg})`);
  }
}

type Props = {
  visible: boolean;
  onClose: () => void;
  onSelect: (formattedCity: string) => void;
};

type Mode = 'lookup' | 'manual';

export function PinCodeLookup({ visible, onClose, onSelect }: Props) {
  const [mode, setMode] = useState<Mode>('lookup');
  const [pin, setPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [results, setResults] = useState<LocationResult[]>([]);
  const [source, setSource] = useState<string>('');

  // Manual entry state
  const [manualName, setManualName] = useState('');
  const [manualDistrict, setManualDistrict] = useState('');
  const [manualState, setManualState] = useState('');

  const reset = () => {
    setPin('');
    setResults([]);
    setSource('');
    setError(null);
    setLoading(false);
    setMode('lookup');
    setManualName('');
    setManualDistrict('');
    setManualState('');
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const handleChange = (text: string) => {
    const digits = text.replace(/\D/g, '').slice(0, 6);
    setPin(digits);
    if (error) setError(null);
  };

  const handleLookup = async () => {
    if (pin.length !== 6) {
      setError('Enter the 6-digit PIN code');
      return;
    }
    setLoading(true);
    setError(null);
    setResults([]);
    setSource('');
    try {
      const { results: r, source: s } = await lookupPin(pin);
      setResults(r);
      setSource(s);
      if (r.length === 0) setError('No locations found for this PIN code');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Lookup failed.');
    } finally {
      setLoading(false);
    }
  };

  const handlePick = (r: LocationResult) => {
    const parts = [r.name, r.district, r.state, r.country].filter(Boolean);
    const formatted = parts.join(', ');
    onSelect(formatted);
    reset();
  };

  const handleManualSubmit = () => {
    if (!manualName.trim() || !manualState.trim()) {
      setError('Village/area name and state are required');
      return;
    }
    const parts = [manualName.trim(), manualDistrict.trim(), manualState.trim(), 'India'].filter(
      Boolean,
    );
    onSelect(parts.join(', '));
    reset();
  };

  return (
    <Modal animationType="slide" visible={visible} transparent onRequestClose={handleClose}>
      <Pressable style={styles.backdrop} onPress={handleClose} />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <Heading level="h3">
            {mode === 'lookup' ? 'Find your location' : 'Enter location manually'}
          </Heading>
          <TouchableOpacity onPress={handleClose} accessibilityRole="button">
            <BodyText color={colors.accent}>Close</BodyText>
          </TouchableOpacity>
        </View>

        {mode === 'lookup' ? (
          <>
            <BodyText variant="bodyMuted" style={styles.helpText}>
              Enter your 6-digit PIN code (printed on any utility bill or postal mail).
            </BodyText>

            <View style={styles.inputRow}>
              <RNTextInput
                value={pin}
                onChangeText={handleChange}
                keyboardType="number-pad"
                placeholder="6-digit PIN"
                placeholderTextColor={colors.inkSubtle}
                maxLength={6}
                style={[styles.input, error ? styles.inputError : null]}
                autoFocus
                onSubmitEditing={handleLookup}
              />
              <View style={{ width: 110 }}>
                <Button onPress={handleLookup} loading={loading} disabled={pin.length !== 6}>
                  Search
                </Button>
              </View>
            </View>

            {error ? (
              <View>
                <BodyText variant="caption" color={colors.danger} style={styles.error}>
                  {error}
                </BodyText>
                <TouchableOpacity onPress={() => setMode('manual')}>
                  <BodyText variant="caption" color={colors.accent}>
                    Enter your village / area details manually →
                  </BodyText>
                </TouchableOpacity>
              </View>
            ) : null}

            {loading ? (
              <View style={styles.center}>
                <ActivityIndicator color={colors.accent} />
              </View>
            ) : null}

            {results.length > 0 ? (
              <>
                <BodyText variant="caption" color={colors.inkMuted} style={{ marginTop: spacing.md }}>
                  {results.length} result{results.length === 1 ? '' : 's'} from {source}
                </BodyText>
                <FlatList
                  style={styles.results}
                  data={results}
                  keyExtractor={(r, i) => `${r.name}-${r.pincode}-${i}`}
                  renderItem={({ item }) => (
                    <TouchableOpacity style={styles.row} onPress={() => handlePick(item)}>
                      <View style={{ flex: 1 }}>
                        <BodyText>{item.name}</BodyText>
                        <BodyText variant="caption" color={colors.inkMuted}>
                          {[item.district, item.state].filter(Boolean).join(', ')} · PIN {item.pincode}
                        </BodyText>
                      </View>
                      <BodyText color={colors.accent}>›</BodyText>
                    </TouchableOpacity>
                  )}
                  ItemSeparatorComponent={() => <View style={styles.separator} />}
                />
              </>
            ) : null}

            {!loading && !error && results.length === 0 ? (
              <TouchableOpacity
                onPress={() => setMode('manual')}
                style={{ marginTop: spacing.lg }}
              >
                <BodyText variant="caption" color={colors.accent} align="center">
                  Or enter your village / area details manually →
                </BodyText>
              </TouchableOpacity>
            ) : null}
          </>
        ) : (
          // Manual entry mode
          <>
            <BodyText variant="bodyMuted" style={styles.helpText}>
              Type your village or area name, then district and state.
            </BodyText>

            <RNTextInput
              value={manualName}
              onChangeText={setManualName}
              placeholder="Village / area (e.g., Bhadra)"
              placeholderTextColor={colors.inkSubtle}
              style={styles.manualInput}
              autoCapitalize="words"
              autoFocus
            />
            <RNTextInput
              value={manualDistrict}
              onChangeText={setManualDistrict}
              placeholder="District (e.g., Hanumangarh)"
              placeholderTextColor={colors.inkSubtle}
              style={styles.manualInput}
              autoCapitalize="words"
            />
            <RNTextInput
              value={manualState}
              onChangeText={setManualState}
              placeholder="State (e.g., Rajasthan)"
              placeholderTextColor={colors.inkSubtle}
              style={styles.manualInput}
              autoCapitalize="words"
            />

            {error ? (
              <BodyText variant="caption" color={colors.danger} style={styles.error}>
                {error}
              </BodyText>
            ) : null}

            <View style={{ marginTop: spacing.md }}>
              <Button onPress={handleManualSubmit}>Use this location</Button>
            </View>

            <TouchableOpacity onPress={() => setMode('lookup')} style={{ marginTop: spacing.md }}>
              <BodyText variant="caption" color={colors.accent} align="center">
                ← Back to PIN code search
              </BodyText>
            </TouchableOpacity>
          </>
        )}

        <BodyText variant="caption" color={colors.inkMuted} align="center" style={styles.footer}>
          {mode === 'lookup'
            ? 'PIN lookup via Zippopotam (with India Post fallback)'
            : 'No internet needed — manual entry'}
        </BodyText>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(15, 23, 42, 0.4)' },
  sheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.paper,
    borderTopLeftRadius: radii.lg,
    borderTopRightRadius: radii.lg,
    maxHeight: '85%',
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  helpText: { marginBottom: spacing.lg },
  inputRow: {
    flexDirection: 'row',
    gap: spacing.md,
    alignItems: 'center',
    marginBottom: spacing.md,
  },
  input: {
    flex: 1,
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.ink,
    minHeight: 48,
    letterSpacing: 4,
  },
  manualInput: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radii.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontSize: typography.body.fontSize,
    color: colors.ink,
    minHeight: 48,
    marginBottom: spacing.md,
  },
  inputError: { borderColor: colors.danger },
  error: { marginBottom: spacing.sm },
  center: { alignItems: 'center', paddingVertical: spacing.xl },
  results: {
    marginTop: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radii.md,
    overflow: 'hidden',
    maxHeight: 320,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  separator: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.border,
  },
  footer: { marginTop: spacing.lg },
});
