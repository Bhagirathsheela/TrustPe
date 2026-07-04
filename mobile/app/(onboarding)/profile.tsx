/**
 * Profile setup — first onboarding step after OTP verification.
 *
 * Required fields: city (with autocomplete), occupation category (with farmer
 * option), income band. Optional: occupation detail (with role autocomplete),
 * bio, monthly lending capacity (lenders only).
 *
 * Keyboard handling: Screen sets `softwareKeyboardLayoutMode: resize` on
 * Android and uses KeyboardAvoidingView on iOS so the bio textarea stays
 * visible during typing.
 */
import { useCallback, useEffect, useState } from 'react';
import { Alert, TouchableOpacity, View } from 'react-native';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { router } from 'expo-router';
import {
  formatCity,
  initialProfileSetupSchema,
  searchCities,
  searchRoles,
  type InitialProfileSetupInput,
  type MeProfile,
  type OccupationCategory,
  type IncomeBand,
} from 'trustpe-shared';
import { Screen } from '../../components/Screen';
import { Heading } from '../../components/Heading';
import { BodyText } from '../../components/BodyText';
import { Button } from '../../components/Button';
import { TextInput } from '../../components/TextInput';
import { Select, type SelectOption } from '../../components/Select';
import { AutocompleteInput, type AutocompleteSuggestion } from '../../components/AutocompleteInput';
import { PinCodeLookup } from '../../components/PinCodeLookup';
import { colors, spacing } from '../../constants/theme';
import { useAuth } from '../../lib/auth-context';
import { ApiError } from '../../lib/api';

const OCCUPATION_OPTIONS: SelectOption<OccupationCategory>[] = [
  { value: 'salaried_private', label: 'Salaried — Private Sector' },
  { value: 'salaried_government', label: 'Salaried — Government' },
  { value: 'self_employed_business', label: 'Self-employed — Business owner' },
  { value: 'self_employed_professional', label: 'Self-employed — Professional' },
  {
    value: 'gig_worker',
    label: 'Gig worker',
    description: 'Swiggy, Zomato, Ola, Uber, Urban Company, etc.',
  },
  { value: 'farmer', label: 'Farmer', description: 'Crop, dairy, poultry, or allied agriculture' },
  { value: 'student', label: 'Student' },
  { value: 'homemaker', label: 'Homemaker' },
  { value: 'retired', label: 'Retired' },
  { value: 'other', label: 'Other' },
];

const INCOME_OPTIONS: SelectOption<IncomeBand>[] = [
  { value: 'under_10k', label: 'Under ₹10,000 / month' },
  { value: '10k_25k', label: '₹10,000 – ₹25,000 / month' },
  { value: '25k_50k', label: '₹25,000 – ₹50,000 / month' },
  { value: '50k_1L', label: '₹50,000 – ₹1,00,000 / month' },
  { value: '1L_2L', label: '₹1,00,000 – ₹2,00,000 / month' },
  { value: 'over_2L', label: 'Over ₹2,00,000 / month' },
];

export default function ProfileSetup() {
  const { apiCall, refreshMe } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [initialLoading, setInitialLoading] = useState(true);
  const [pinSheetOpen, setPinSheetOpen] = useState(false);

  const {
    control,
    handleSubmit,
    reset,
    setValue,
    formState: { errors },
  } = useForm<InitialProfileSetupInput>({
    resolver: zodResolver(initialProfileSetupSchema),
    defaultValues: {
      city: '',
      occupationCategory: undefined,
      occupationDetail: '',
      declaredMonthlyIncome: undefined,
    },
    mode: 'onBlur',
  });

  // Prefill if profile already partially saved.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const profile = await apiCall<MeProfile>({ path: '/me/profile' });
        if (!cancelled && profile) {
          reset({
            city: profile.city ?? '',
            occupationCategory: profile.occupationCategory as OccupationCategory | undefined,
            occupationDetail: profile.occupationDetail ?? '',
            declaredMonthlyIncome: profile.declaredMonthlyIncome as IncomeBand | undefined,
            monthlyLendingCapacityPaise: profile.monthlyLendingCapacityPaise,
          });
        }
      } catch {
        // first-time: no profile yet — keep defaults
      } finally {
        if (!cancelled) setInitialLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiCall, reset]);

  // Stable getters for the autocomplete components — wrapped in useCallback so
  // AutocompleteInput's useMemo dependency stays referentially stable.
  const getCitySuggestions = useCallback((query: string): AutocompleteSuggestion[] => {
    return searchCities(query, 6).map((c) => ({
      key: `${c.city}-${c.state}-${c.country}`,
      value: formatCity(c),
      subtitle: `${c.state}, ${c.country}`,
    }));
  }, []);

  const getRoleSuggestions = useCallback((query: string): AutocompleteSuggestion[] => {
    return searchRoles(query, 6).map((r) => ({ key: r, value: r }));
  }, []);

  const onSubmit = async (data: InitialProfileSetupInput) => {
    setSubmitting(true);
    try {
      const payload: Record<string, unknown> = { ...data };
      if (!payload.occupationDetail) delete payload.occupationDetail;
      if (!payload.monthlyLendingCapacityPaise) delete payload.monthlyLendingCapacityPaise;

      await apiCall({ path: '/me/profile', method: 'PATCH', body: payload });
      await refreshMe();
      router.replace('/home');
    } catch (err) {
      if (err instanceof ApiError) {
        Alert.alert("Couldn't save profile", err.message);
      } else {
        Alert.alert('Something went wrong', 'Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (initialLoading) {
    return (
      <Screen centered>
        <BodyText variant="bodyMuted">Loading…</BodyText>
      </Screen>
    );
  }

  return (
    <Screen scroll>
      <View style={{ marginBottom: spacing.xl }}>
        <Heading>About you</Heading>
        <BodyText variant="bodyMuted" style={{ marginTop: spacing.sm }}>
          A few quick details so lenders know who they're matching with. You can update any of
          this later from your profile.
        </BodyText>
      </View>

      <Controller
        control={control}
        name="city"
        render={({ field: { value, onChange, onBlur } }) => (
          <View>
            <AutocompleteInput
              label="City"
              value={value}
              onChange={onChange}
              onBlur={onBlur}
              getSuggestions={getCitySuggestions}
              autoCapitalize="words"
              placeholder="Start typing your city or district"
              error={errors.city?.message}
            />
            <TouchableOpacity
              onPress={() => setPinSheetOpen(true)}
              style={{ marginTop: -spacing.md, marginBottom: spacing.lg }}
              accessibilityRole="button"
              accessibilityLabel="Search by PIN code"
            >
              <BodyText variant="caption" color={colors.accent}>
                Can't find your village or area? Search by PIN code →
              </BodyText>
            </TouchableOpacity>
          </View>
        )}
      />

      <Controller
        control={control}
        name="occupationCategory"
        render={({ field: { value, onChange } }) => (
          <Select
            label="Occupation"
            value={value}
            options={OCCUPATION_OPTIONS}
            onChange={onChange}
            placeholder="Choose your occupation"
            error={errors.occupationCategory?.message}
            title="Your occupation"
          />
        )}
      />

      <Controller
        control={control}
        name="occupationDetail"
        render={({ field: { value, onChange, onBlur } }) => (
          <AutocompleteInput
            label="Role / Company (optional)"
            value={value ?? ''}
            onChange={onChange}
            onBlur={onBlur}
            getSuggestions={getRoleSuggestions}
            placeholder="e.g. Software Engineer at Infosys"
            error={errors.occupationDetail?.message}
          />
        )}
      />

      <Controller
        control={control}
        name="declaredMonthlyIncome"
        render={({ field: { value, onChange } }) => (
          <Select
            label="Monthly income"
            value={value}
            options={INCOME_OPTIONS}
            onChange={onChange}
            placeholder="Choose your income band"
            error={errors.declaredMonthlyIncome?.message}
            title="Your monthly income"
          />
        )}
      />


      <View style={{ marginTop: spacing.md, marginBottom: spacing.xl }}>
        <Button onPress={handleSubmit(onSubmit)} loading={submitting}>
          Save and continue
        </Button>
      </View>

      <BodyText
        variant="caption"
        color={colors.inkMuted}
        align="center"
        style={{ lineHeight: 18 }}
      >
        Next step after this: KYC capture (Aadhaar, PAN, selfie) and your UPI ID. The TrustPe
        team reviews each one personally during the closed pilot.
      </BodyText>

      <PinCodeLookup
        visible={pinSheetOpen}
        onClose={() => setPinSheetOpen(false)}
        onSelect={(formatted) => {
          setValue('city', formatted, { shouldValidate: true, shouldDirty: true });
          setPinSheetOpen(false);
        }}
      />
    </Screen>
  );
}
