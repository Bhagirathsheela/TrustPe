/**
 * Lender browse — list of open loan requests.
 *
 * UX layout:
 *   - Sticky header: back, title, result count
 *   - Compact filter bar: [Filters · N] [Sort ▼] buttons
 *   - Filter button opens a bottom-sheet modal with Purpose + Borrower Trust;
 *     count badge shows non-default selections
 *   - Sort button opens a smaller sheet with radio options
 *   - Loan request cards fill the rest of the viewport
 *
 * Server already excludes the caller's own requests, so lenders won't see
 * their own posts here.
 */
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Modal,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LOAN_PURPOSE_LABELS, type LoanPurpose } from 'trustpe-shared';
import { Heading } from '../../../components/Heading';
import { BodyText } from '../../../components/BodyText';
import { BackHeader } from '../../../components/BackHeader';
import { LoanRequestCard, type LoanRequestSummary } from '../../../components/LoanRequestCard';
import { EmptyState } from '../../../components/EmptyState';
import { SkeletonList } from '../../../components/Skeleton';
import { colors, radii, spacing } from '../../../constants/theme';
import { useAuth } from '../../../lib/auth-context';

type SortKey = 'newest' | 'oldest' | 'amount_asc' | 'amount_desc';

const SORT_LABEL: Record<SortKey, string> = {
  newest: 'Newest first',
  oldest: 'Oldest first',
  amount_asc: 'Amount: low → high',
  amount_desc: 'Amount: high → low',
};

const PURPOSE_CHIPS: Array<{ value: LoanPurpose | 'all'; label: string }> = [
  { value: 'all', label: 'All purposes' },
  ...(Object.entries(LOAN_PURPOSE_LABELS) as Array<[LoanPurpose, string]>).map(
    ([value, label]) => ({ value, label }),
  ),
];

const TRUST_CHIPS: Array<{ value: number | undefined; label: string }> = [
  { value: undefined, label: 'Any trust' },
  { value: 550, label: 'Fair+' },
  { value: 650, label: 'Good+' },
  { value: 750, label: 'Very Good+' },
];

export default function BrowseLoanRequests() {
  const { apiCall } = useAuth();
  const [items, setItems] = useState<LoanRequestSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  // Applied filters (drive the network query)
  const [purpose, setPurpose] = useState<LoanPurpose | 'all'>('all');
  const [minTrustScore, setMinTrustScore] = useState<number | undefined>(undefined);
  const [sort, setSort] = useState<SortKey>('newest');

  // Modal state
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [sortOpen, setSortOpen] = useState(false);

  const activeFilterCount = useMemo(() => {
    let n = 0;
    if (purpose !== 'all') n++;
    if (minTrustScore !== undefined) n++;
    return n;
  }, [purpose, minTrustScore]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const query: Record<string, string | number> = { limit: 30, sort };
      if (purpose !== 'all') query.purpose = purpose;
      if (minTrustScore !== undefined) query.minTrustScore = minTrustScore;
      const qs = new URLSearchParams(
        Object.entries(query).map(([k, v]) => [k, String(v)]),
      ).toString();

      const data = await apiCall<{ items: LoanRequestSummary[]; nextCursor: string | null }>({
        path: `/loan-requests?${qs}`,
      });
      setItems(data.items);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  }, [apiCall, purpose, minTrustScore, sort]);

  useEffect(() => {
    void load();
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header — sticky-feeling because it's outside the scroll */}
      <View style={styles.header}>
        <BackHeader fallback="/home" />
        <Heading>Browse loan requests</Heading>
        <BodyText variant="bodyMuted" style={{ marginTop: spacing.xs }}>
          {loading
            ? 'Loading…'
            : `${items.length} ${items.length === 1 ? 'open request' : 'open requests'}`}
        </BodyText>

        {/* Compact filter bar */}
        <View style={styles.filterBar}>
          <ToolbarButton
            label={activeFilterCount > 0 ? `Filters · ${activeFilterCount}` : 'Filters'}
            active={activeFilterCount > 0}
            icon="filter"
            onPress={() => setFiltersOpen(true)}
          />
          <ToolbarButton
            label={SORT_LABEL[sort]}
            active={sort !== 'newest'}
            icon="sort"
            onPress={() => setSortOpen(true)}
          />
        </View>
      </View>

      {/* List */}
      <FlatList
        data={items}
        keyExtractor={(r) => r.id}
        renderItem={({ item }) => (
          <LoanRequestCard
            item={item}
            variant="browse"
            onPress={() => router.push(`/loan-requests/${item.id}`)}
          />
        )}
        contentContainerStyle={styles.listContent}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} />
        }
        ListEmptyComponent={
          loading ? (
            <View style={{ padding: spacing.xl }}>
              <SkeletonList count={3} rows={3} />
            </View>
          ) : (
            <EmptyState
              icon={activeFilterCount > 0 ? '🔍' : '✨'}
              title={activeFilterCount > 0 ? 'No matching requests' : 'No open requests'}
              subtitle={
                activeFilterCount > 0
                  ? 'Try clearing some filters, or check back later as more requests come in.'
                  : 'New requests appear here as friends in your circle need funds. Pull down to refresh.'
              }
            />
          )
        }
      />

      {/* Filter sheet */}
      <BottomSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filters">
        <Section label="Purpose">
          <ChipRow
            items={PURPOSE_CHIPS}
            getValue={(c) => String(c.value)}
            getLabel={(c) => c.label}
            isSelected={(c) => purpose === c.value}
            onPress={(c) => setPurpose(c.value)}
          />
        </Section>

        <Section label="Borrower trust">
          <ChipRow
            items={TRUST_CHIPS}
            getValue={(c) => String(c.value ?? 'any')}
            getLabel={(c) => c.label}
            isSelected={(c) => minTrustScore === c.value}
            onPress={(c) => setMinTrustScore(c.value)}
          />
        </Section>

        <View style={styles.sheetFooter}>
          <Pressable
            style={({ pressed }) => [
              styles.footerButton,
              styles.footerGhost,
              pressed && { opacity: 0.7 },
            ]}
            onPress={() => {
              setPurpose('all');
              setMinTrustScore(undefined);
            }}
          >
            <BodyText style={{ color: colors.inkMuted, fontWeight: '600' }}>Clear all</BodyText>
          </Pressable>
          <Pressable
            style={({ pressed }) => [
              styles.footerButton,
              styles.footerPrimary,
              pressed && { opacity: 0.85 },
            ]}
            onPress={() => setFiltersOpen(false)}
          >
            <BodyText style={{ color: colors.white, fontWeight: '700' }}>
              {loading
                ? 'Loading…'
                : `Show ${items.length} ${items.length === 1 ? 'result' : 'results'}`}
            </BodyText>
          </Pressable>
        </View>
      </BottomSheet>

      {/* Sort sheet */}
      <BottomSheet open={sortOpen} onClose={() => setSortOpen(false)} title="Sort by">
        {(Object.keys(SORT_LABEL) as SortKey[]).map((key) => (
          <Pressable
            key={key}
            onPress={() => {
              setSort(key);
              setSortOpen(false);
            }}
            style={({ pressed }) => [styles.sortRow, pressed && { backgroundColor: colors.paper }]}
          >
            <View style={[styles.radio, sort === key && styles.radioOn]}>
              {sort === key ? <View style={styles.radioDot} /> : null}
            </View>
            <BodyText style={{ fontSize: 16, fontWeight: sort === key ? '700' : '500' }}>
              {SORT_LABEL[key]}
            </BodyText>
          </Pressable>
        ))}
      </BottomSheet>
    </SafeAreaView>
  );
}

// ----------------------------------------------------------------------------
// Local building blocks
// ----------------------------------------------------------------------------

function ToolbarButton({
  label,
  active,
  icon,
  onPress,
}: {
  label: string;
  active: boolean;
  icon: 'filter' | 'sort';
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [
        styles.toolbarButton,
        active && styles.toolbarButtonActive,
        pressed && { opacity: 0.75 },
      ]}
      hitSlop={8}
    >
      <BodyText style={{ marginRight: spacing.xs, fontSize: 16 }}>
        {icon === 'filter' ? '⚙' : '↕'}
      </BodyText>
      <BodyText
        style={{
          color: active ? colors.accent : colors.ink,
          fontWeight: '600',
          fontSize: 14,
        }}
        numberOfLines={1}
      >
        {label}
      </BodyText>
    </Pressable>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View style={{ marginBottom: spacing.lg }}>
      <BodyText
        variant="caption"
        color={colors.inkMuted}
        style={{ marginBottom: spacing.sm, letterSpacing: 0.5 }}
      >
        {label.toUpperCase()}
      </BodyText>
      {children}
    </View>
  );
}

function ChipRow<T>({
  items,
  getValue,
  getLabel,
  isSelected,
  onPress,
}: {
  items: T[];
  getValue: (item: T) => string;
  getLabel: (item: T) => string;
  isSelected: (item: T) => boolean;
  onPress: (item: T) => void;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false}>
      <View style={{ flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' }}>
        {items.map((item) => {
          const selected = isSelected(item);
          return (
            <Pressable
              key={getValue(item)}
              onPress={() => onPress(item)}
              style={({ pressed }) => [
                styles.chip,
                selected && styles.chipSelected,
                pressed && { opacity: 0.75 },
              ]}
            >
              <BodyText
                style={{
                  color: selected ? colors.white : colors.ink,
                  fontWeight: '600',
                  fontSize: 13,
                }}
              >
                {getLabel(item)}
              </BodyText>
            </Pressable>
          );
        })}
      </View>
    </ScrollView>
  );
}

function BottomSheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <Modal visible={open} transparent animationType="slide" onRequestClose={onClose}>
      <View style={styles.modalRoot}>
        <Pressable style={styles.backdrop} onPress={onClose} />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.sheetHandle} />
          <View style={styles.sheetHeader}>
            <BodyText style={{ fontSize: 17, fontWeight: '700' }}>{title}</BodyText>
            <Pressable onPress={onClose} hitSlop={16} style={({ pressed }) => [{ opacity: pressed ? 0.6 : 1 }]}>
              <BodyText style={{ fontSize: 22, color: colors.inkMuted }}>✕</BodyText>
            </Pressable>
          </View>
          <ScrollView contentContainerStyle={styles.sheetBody} showsVerticalScrollIndicator={false}>
            {children}
          </ScrollView>
        </SafeAreaView>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },

  // Header
  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    backgroundColor: colors.paper,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  filterBar: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.lg,
  },
  toolbarButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    backgroundColor: colors.white,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 36,
  },
  toolbarButtonActive: {
    borderColor: colors.accent,
    backgroundColor: '#EFF6FF',
  },

  // List
  listContent: { padding: spacing.xl, paddingTop: spacing.md, flexGrow: 1 },
  emptyCard: {
    backgroundColor: colors.white,
    borderRadius: radii.md,
    padding: spacing.xl,
    alignItems: 'flex-start',
    marginTop: spacing.lg,
  },

  // Bottom sheet
  modalRoot: { flex: 1, justifyContent: 'flex-end' },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
  },
  sheet: {
    backgroundColor: colors.white,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: '85%',
  },
  sheetHandle: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    backgroundColor: colors.border,
    borderRadius: 2,
    marginTop: spacing.sm,
  },
  sheetHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.xl,
    paddingVertical: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  sheetBody: { padding: spacing.xl, paddingBottom: spacing.xxl },
  sheetFooter: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.lg,
  },
  footerButton: {
    flex: 1,
    paddingVertical: spacing.lg,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerGhost: {
    backgroundColor: colors.paper,
  },
  footerPrimary: { backgroundColor: colors.accent },

  // Chips inside sheets
  chip: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    backgroundColor: colors.paper,
    borderRadius: radii.pill,
    borderWidth: 1,
    borderColor: colors.border,
    minHeight: 36,
    justifyContent: 'center',
  },
  chipSelected: {
    backgroundColor: colors.accent,
    borderColor: colors.accent,
  },

  // Sort radio rows
  sortRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: spacing.lg,
    paddingHorizontal: spacing.md,
    borderRadius: radii.md,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: spacing.md,
  },
  radioOn: { borderColor: colors.accent },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: colors.accent,
  },
});
