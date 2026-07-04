/**
 * Create a loan request — fixed-rate model.
 *
 * Borrower commits to a single ROI at creation. Form shows the borrower's
 * state ROI cap as the binding ceiling (lower of TrustPe's 36% and the
 * state's statute). Server re-validates on submit.
 */
import { useEffect, useMemo, useState } from 'react';
import { Alert, View } from 'react-native';
import { router } from 'expo-router';
import { Controller, useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  createLoanRequestSchema,
  type CreateLoanRequestInput,
  LOAN_PURPOSE_LABELS,
  type LoanPurpose,
  MAX_LOAN_AMOUNT_PAISE,
  MAX_LOAN_ROI_PERCENT,
  MAX_LOAN_TENURE_MONTHS,
  MIN_LOAN_AMOUNT_PAISE,
  MIN_LOAN_TENURE_MONTHS,
  type MeProfile,
  getStateRoiCap,
} from 'trustpe-shared';
import { Screen } from '../../../components/Screen';
import { Heading } from '../../../components/Heading';
import { BodyText } from '../../../components/BodyText';
import { Button } from '../../../components/Button';
import { TextInput } from '../../../components/TextInput';
import { Select, type SelectOption } from '../../../components/Select';
import { colors, spacing } from '../../../constants/theme';
import { useAuth } from '../../../lib/auth-context';
import { ApiError } from '../../../lib/api';

const PURPOSE_OPTIONS: SelectOption<LoanPurpose>[] = (
  Object.entries(LOAN_PURPOSE_LABELS) as Array<[LoanPurpose, string]>
).map(([value, label]) => ({ value, label }));

const TENURE_OPTIONS: SelectOption<number>[] = Array.from(
  { length: MAX_LOAN_TENURE_MONTHS - MIN_LOAN_TENURE_MONTHS + 1 },
  (_, i) => {
    const months = MIN_LOAN_TENURE_MONTHS + i;
    return { value: months, label: `${months} month${months > 1 ? 's' : ''}` };
  },
);

type FormShape = {
  amountRupees: string;
  tenureMonths: number;
  roiPercent: string;
  purpose: LoanPurpose;
  purposeDetail: string;
};

export default function NewLoanRequest() {
  const { apiCall } = useAuth();
  const [submitting, setSubmitting] = useState(false);
  const [profile, setProfile] = useState<MeProfile | null>(null);

  const {
    control,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormShape>({
    defaultValues: {
      amountRupees: '',
      tenureMonths: 3,
      roiPercent: '18',
      purpose: 'medical',
      purposeDetail: '',
    },
    mode: 'onBlur',
  });

  const purpose = watch('purpose');

  // Resolve the state ROI cap from the user's profile city so we can show
  // a relevant ceiling. Default cap applies until the profile loads.
  useEffect(() => {
    (async () => {
      try {
        const p = await apiCall<MeProfile>({ path: '/me/profile' });
        setProfile(p);
      } catch {
        // ignore — we'll fall back to the global cap
      }
    })();
  }, [apiCall]);

  const stateCap = useMemo(() => getStateRoiCap(profile?.city), [profile?.city]);
  const effectiveCap = Math.min(stateCap.cap, MAX_LOAN_ROI_PERCENT);

  const onSubmit = async (form: FormShape) => {
    const amountPaise = Math.round(Number(form.amountRupees) * 100);
    const roiPercent = Number(form.roiPercent);

    const payload: CreateLoanRequestInput = {
      amountPaise,
      tenureMonths: form.tenureMonths,
      roiPercent,
      purpose: form.purpose,
      purposeDetail: form.purposeDetail.trim() || undefined,
    };

    const parsed = createLoanRequestSchema.safeParse(payload);
    if (!parsed.success) {
      Alert.alert("Couldn't submit", parsed.error.issues[0]?.message ?? 'Please check the form.');
      return;
    }
    if (roiPercent > effectiveCap) {
      Alert.alert(
        'Rate above your state cap',
        stateCap.hasExplicitCap
          ? `${stateCap.state} caps moneylender interest at ${stateCap.cap}% p.a. Reduce the rate.`
          : `The maximum allowed rate is ${effectiveCap}% p.a.`,
      );
      return;
    }

    setSubmitting(true);
    try {
      await apiCall({ path: '/loan-requests', method: 'POST', body: parsed.data });
      router.replace('/loan-requests/mine');
    } catch (err) {
      const message =
        err instanceof ApiError
          ? err.message
          : err instanceof Error
            ? err.message
            : 'Something went wrong. Please try again.';
      Alert.alert("Couldn't submit", message);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen scroll>
      <Heading>Request a loan</Heading>
      <BodyText variant="bodyMuted" style={{ marginTop: spacing.sm, marginBottom: spacing.xl }}>
        Pick your amount, tenure, and the interest rate you&apos;ll pay. Lenders in your circle see
        the request — first to fund wins, no negotiation. You stay in control: cancel anytime
        before someone funds.
      </BodyText>

      <Controller
        control={control}
        name="amountRupees"
        rules={{
          validate: (v) => {
            const n = Number(v);
            if (!v || Number.isNaN(n)) return 'Enter an amount';
            if (n * 100 < MIN_LOAN_AMOUNT_PAISE) return `Minimum is ₹${MIN_LOAN_AMOUNT_PAISE / 100}`;
            if (n * 100 > MAX_LOAN_AMOUNT_PAISE) return `Maximum is ₹${MAX_LOAN_AMOUNT_PAISE / 100}`;
            return true;
          },
        }}
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            label="Amount"
            value={value}
            onChangeText={(t) => onChange(t.replace(/[^\d]/g, ''))}
            onBlur={onBlur}
            keyboardType="number-pad"
            placeholder={`₹${MIN_LOAN_AMOUNT_PAISE / 100} – ₹${MAX_LOAN_AMOUNT_PAISE / 100}`}
            error={errors.amountRupees?.message}
            hint="Your TrustScore tier may cap this lower."
          />
        )}
      />

      <Controller
        control={control}
        name="tenureMonths"
        render={({ field: { value, onChange } }) => (
          <Select
            label="Repay over"
            value={value}
            options={TENURE_OPTIONS}
            onChange={onChange}
            placeholder="Choose tenure"
            error={errors.tenureMonths?.message}
            title="Choose tenure"
          />
        )}
      />

      <Controller
        control={control}
        name="roiPercent"
        rules={{
          validate: (v) => {
            const n = Number(v);
            if (!v || Number.isNaN(n)) return 'Enter an interest rate';
            if (n < 0) return 'Cannot be negative';
            if (n > effectiveCap)
              return stateCap.hasExplicitCap
                ? `${stateCap.state} cap is ${stateCap.cap}% p.a.`
                : `Cap is ${effectiveCap}% p.a.`;
            return true;
          },
        }}
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            label="Interest rate (% p.a.)"
            value={value}
            onChangeText={(t) => onChange(t.replace(/[^\d.]/g, ''))}
            onBlur={onBlur}
            keyboardType="decimal-pad"
            placeholder="e.g. 18"
            error={errors.roiPercent?.message}
            hint={
              stateCap.hasExplicitCap
                ? `${stateCap.state} caps moneylender interest at ${stateCap.cap}% p.a. TrustPe's overall cap is ${MAX_LOAN_ROI_PERCENT}%.`
                : `RBI / TrustPe cap is ${MAX_LOAN_ROI_PERCENT}% p.a. for unsecured personal loans.`
            }
          />
        )}
      />

      <Controller
        control={control}
        name="purpose"
        render={({ field: { value, onChange } }) => (
          <Select
            label="Purpose"
            value={value}
            options={PURPOSE_OPTIONS}
            onChange={onChange}
            placeholder="Choose a purpose"
            error={errors.purpose?.message}
            title="What's this for?"
          />
        )}
      />

      <Controller
        control={control}
        name="purposeDetail"
        rules={{
          validate: (v) => {
            if (purpose === 'other' && (!v || v.trim().length < 10)) {
              return 'Describe your purpose (at least 10 characters)';
            }
            if (v && v.length > 500) return 'Keep it under 500 characters';
            return true;
          },
        }}
        render={({ field: { value, onChange, onBlur } }) => (
          <TextInput
            label={`Details ${purpose === 'other' ? '' : '(optional)'}`}
            value={value}
            onChangeText={onChange}
            onBlur={onBlur}
            placeholder={
              purpose === 'other'
                ? 'Briefly describe your purpose'
                : 'Add context for lenders (optional)'
            }
            multiline
            error={errors.purposeDetail?.message}
            hint="Lenders read this to decide. Specifics build trust."
          />
        )}
      />

      <View style={{ marginTop: spacing.lg }}>
        <Button onPress={handleSubmit(onSubmit)} loading={submitting}>
          Publish request
        </Button>
        <View style={{ height: spacing.md }} />
        <Button variant="ghost" onPress={() => router.back()} disabled={submitting}>
          Cancel
        </Button>
      </View>

      <BodyText
        variant="caption"
        color={colors.inkMuted}
        align="center"
        style={{ marginTop: spacing.lg, lineHeight: 18 }}
      >
        One active request per borrower. Requests auto-expire after 30 days if no one funds.
      </BodyText>
    </Screen>
  );
}
