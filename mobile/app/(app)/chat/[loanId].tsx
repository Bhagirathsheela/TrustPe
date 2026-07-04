/**
 * Per-loan chat screen.
 *
 * - Real-time via Socket.io (`message:new` events filtered by loanId).
 * - Keyboard handling: KeyboardAvoidingView with `behavior="padding"` for
 *   BOTH platforms — Android's prior `behavior={undefined}` was relying on
 *   `softwareKeyboardLayoutMode: resize` to do all the work, which left the
 *   composer covered when the system bar / nav bar consumed the resize.
 * - Emoji bar: tap the smiley to reveal a quick row of common emojis above
 *   the composer. The system keyboard's built-in emoji panel still works
 *   for anything not in the quick bar.
 */
import { useCallback, useEffect, useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Heading } from '../../../components/Heading';
import { BodyText } from '../../../components/BodyText';
import { BackHeader } from '../../../components/BackHeader';
import { colors, radii, spacing } from '../../../constants/theme';
import { useAuth } from '../../../lib/auth-context';
import { onRealtimeEvent } from '../../../lib/socket';
import { ApiError } from '../../../lib/api';

type Message = {
  id: string;
  loanId: string;
  senderId: string | null;
  senderRole: 'borrower' | 'lender' | 'system';
  kind:
    | 'text'
    | 'system_disbursal'
    | 'system_payment_marked'
    | 'system_payment_attested'
    | 'system_loan_signed'
    | 'system_loan_closed';
  content: string;
  metadata: unknown;
  createdAt: string;
};

type LoanLite = {
  id: string;
  borrowerSnapshot: { name: string };
  lenderSnapshot: { name: string };
  borrowerId: string;
  lenderId: string;
};

/**
 * Quick-access emoji row. Covers the most-used reactions in a loan
 * conversation context (acknowledgement, money, time, hands). The system
 * keyboard's emoji panel still works for everything else.
 */
const QUICK_EMOJIS = [
  '👍',
  '🙏',
  '❤️',
  '😊',
  '😂',
  '✅',
  '❌',
  '⏰',
  '📅',
  '💰',
  '💸',
  '💳',
  '🏦',
  '📝',
  '🤝',
  '🎉',
  '😅',
  '🙂',
  '😢',
  '😡',
  '🤔',
  '👋',
  '👌',
  '🔥',
];

function timeOnly(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export default function ChatScreen() {
  const params = useLocalSearchParams<{ loanId: string }>();
  const loanId = params.loanId;
  const { apiCall, user } = useAuth();
  const [loan, setLoan] = useState<LoanLite | null>(null);
  const [messages, setMessages] = useState<Message[]>([]); // newest at index 0
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [sending, setSending] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);

  const upsertMessage = useCallback((msg: Message) => {
    setMessages((prev) => {
      if (prev.some((m) => m.id === msg.id)) return prev;
      return [msg, ...prev];
    });
  }, []);

  useEffect(() => {
    if (!loanId) return;
    (async () => {
      try {
        const [loanRes, msgsRes] = await Promise.all([
          apiCall<LoanLite>({ path: `/loans/${loanId}` }),
          apiCall<{ items: Message[] }>({ path: `/loans/${loanId}/messages?limit=50` }),
        ]);
        setLoan(loanRes);
        setMessages(msgsRes.items);
      } catch (err) {
        Alert.alert("Couldn't load chat", err instanceof Error ? err.message : 'Unknown error');
      } finally {
        setLoading(false);
      }
    })();
  }, [apiCall, loanId]);

  useEffect(() => {
    if (!loanId) return;
    const off = onRealtimeEvent<Message>('message:new', (msg) => {
      if (msg.loanId === loanId) upsertMessage(msg);
    });
    return off;
  }, [loanId, upsertMessage]);

  const onSend = useCallback(async () => {
    const text = input.trim();
    if (!text || sending) return;
    setSending(true);
    setInput('');
    setEmojiOpen(false);
    try {
      const sent = await apiCall<Message>({
        path: `/loans/${loanId}/messages`,
        method: 'POST',
        body: { content: text },
      });
      upsertMessage(sent);
    } catch (err) {
      setInput(text);
      Alert.alert("Couldn't send", err instanceof ApiError ? err.message : 'Try again.');
    } finally {
      setSending(false);
    }
  }, [apiCall, input, loanId, sending, upsertMessage]);

  const insertEmoji = useCallback((emoji: string) => {
    setInput((prev) => prev + emoji);
  }, []);

  if (loading) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.accent} />
        </View>
      </SafeAreaView>
    );
  }
  if (!loan) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.center}>
          <BodyText variant="bodyMuted">Loan not found.</BodyText>
        </View>
      </SafeAreaView>
    );
  }

  const isBorrower = user?.id === loan.borrowerId;
  const counterparty = isBorrower ? loan.lenderSnapshot.name : loan.borrowerSnapshot.name;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <View style={styles.header}>
        <BackHeader fallback={`/loans/${loanId}`} />
        <Heading level="h3">Chat with {counterparty}</Heading>
        <BodyText variant="caption" color={colors.inkMuted}>
          Coordinate disbursal, EMI payments, and questions about this loan.
        </BodyText>
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'padding'}
        keyboardVerticalOffset={Platform.OS === 'ios' ? 88 : 0}
      >
        <FlatList
          data={messages}
          inverted
          keyExtractor={(m) => m.id}
          contentContainerStyle={styles.listContent}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          renderItem={({ item }) => <MessageBubble msg={item} viewerId={user?.id} />}
          ListEmptyComponent={
            <View style={styles.emptyChat}>
              <BodyText variant="bodyMuted" align="center">
                No messages yet. Say hello — payment updates will also appear here automatically.
              </BodyText>
            </View>
          }
        />

        {emojiOpen ? (
          <View style={styles.emojiBar}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.emojiRow}
            >
              {QUICK_EMOJIS.map((e) => (
                <Pressable
                  key={e}
                  onPress={() => insertEmoji(e)}
                  style={({ pressed }) => [styles.emojiPill, pressed && { opacity: 0.6 }]}
                  hitSlop={6}
                >
                  <BodyText style={styles.emojiText}>{e}</BodyText>
                </Pressable>
              ))}
            </ScrollView>
          </View>
        ) : null}

        <View style={styles.composer}>
          <Pressable
            onPress={() => setEmojiOpen((v) => !v)}
            style={({ pressed }) => [
              styles.emojiToggle,
              emojiOpen && styles.emojiToggleActive,
              pressed && { opacity: 0.6 },
            ]}
            hitSlop={8}
            accessibilityLabel="Toggle emoji bar"
          >
            <BodyText style={{ fontSize: 22 }}>{emojiOpen ? '⌨️' : '😊'}</BodyText>
          </Pressable>

          <TextInput
            style={styles.composerInput}
            value={input}
            onChangeText={setInput}
            placeholder={`Message ${counterparty}…`}
            placeholderTextColor={colors.inkSubtle}
            multiline
            maxLength={2000}
            editable={!sending}
          />
          <Pressable
            onPress={onSend}
            disabled={!input.trim() || sending}
            style={({ pressed }) => [
              styles.sendButton,
              (!input.trim() || sending) && styles.sendButtonDisabled,
              pressed && { opacity: 0.85 },
            ]}
          >
            <BodyText style={styles.sendButtonText}>Send</BodyText>
          </Pressable>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function MessageBubble({ msg, viewerId }: { msg: Message; viewerId?: string }) {
  if (msg.senderRole === 'system') {
    return (
      <View style={styles.systemRow}>
        <View style={styles.systemPill}>
          <BodyText variant="caption" color={colors.inkMuted}>
            {msg.content} · {timeOnly(msg.createdAt)}
          </BodyText>
        </View>
      </View>
    );
  }

  const byMe = msg.senderId === viewerId;
  return (
    <View style={[styles.bubbleRow, byMe ? styles.bubbleRowRight : styles.bubbleRowLeft]}>
      <View style={[styles.bubble, byMe ? styles.bubbleMe : styles.bubbleThem]}>
        <BodyText style={{ color: byMe ? colors.white : colors.ink }}>{msg.content}</BodyText>
        <BodyText
          variant="caption"
          style={{
            marginTop: 4,
            textAlign: 'right',
            color: byMe ? 'rgba(255,255,255,0.7)' : colors.inkMuted,
          }}
        >
          {timeOnly(msg.createdAt)}
        </BodyText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.paper },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing.xl },

  header: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.lg,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
    backgroundColor: colors.paper,
  },

  listContent: {
    padding: spacing.lg,
    flexGrow: 1,
  },
  emptyChat: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xxl,
    transform: [{ scaleY: -1 }],
  },

  bubbleRow: { marginVertical: spacing.xs, flexDirection: 'row' },
  bubbleRowLeft: { justifyContent: 'flex-start' },
  bubbleRowRight: { justifyContent: 'flex-end' },
  bubble: {
    maxWidth: '80%',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
  },
  bubbleMe: { backgroundColor: colors.accent, borderBottomRightRadius: spacing.xs },
  bubbleThem: {
    backgroundColor: colors.white,
    borderWidth: 1,
    borderColor: colors.border,
    borderBottomLeftRadius: spacing.xs,
  },

  systemRow: { alignItems: 'center', marginVertical: spacing.md },
  systemPill: {
    backgroundColor: '#F1F5F9',
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.xs,
    borderRadius: radii.pill,
  },

  emojiBar: {
    backgroundColor: colors.paper,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  emojiRow: { paddingHorizontal: spacing.sm, paddingVertical: spacing.sm, gap: 4 },
  emojiPill: {
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radii.md,
    minWidth: 40,
    alignItems: 'center',
  },
  emojiText: { fontSize: 26, lineHeight: 32 },

  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: spacing.sm,
    paddingHorizontal: spacing.md,
    paddingTop: spacing.sm,
    paddingBottom: Platform.OS === 'android' ? spacing.md : spacing.lg,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
    backgroundColor: colors.white,
  },
  emojiToggle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emojiToggleActive: { backgroundColor: '#EFF6FF' },
  composerInput: {
    flex: 1,
    minHeight: 40,
    maxHeight: 120,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    fontSize: 15,
    color: colors.ink,
    backgroundColor: colors.paper,
    borderRadius: radii.md,
  },
  sendButton: {
    paddingHorizontal: spacing.lg,
    height: 40,
    backgroundColor: colors.accent,
    borderRadius: radii.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  sendButtonDisabled: { backgroundColor: colors.border },
  sendButtonText: { color: colors.white, fontWeight: '700' },
});
