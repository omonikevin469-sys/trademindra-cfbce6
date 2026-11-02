import type { ReactNode } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  ScrollView,
  View,
  type KeyboardTypeOptions,
} from 'react-native';
import {
  Button,
  FieldError,
  Input,
  Label,
  TextArea,
  TextField,
  useThemeColor,
} from 'heroui-native';
import { router } from 'expo-router';
import { ArrowDownLeft, ArrowUpRight, ChevronRight, NotebookPen } from 'lucide-react-native';
import { SafeAreaView } from '@/components/ui/primitives/SafeAreaView';
import { Text } from '@/components/JournalText';
import { useReadingScale } from '@/lib/readingPreferences';
import { money, pnl, selection, type Trade } from '@/lib/journal';
export function Page({ children, footer }: { children: ReactNode; footer?: ReactNode }) {
  return (
    <SafeAreaView className="bg-background flex-1" edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}
      >
        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={{
            paddingHorizontal: 22,
            paddingTop: 16,
            paddingBottom: 32,
            gap: 24,
          }}
        >
          <View className="w-full max-w-2xl gap-6 self-center">{children}</View>
        </ScrollView>
        {footer ? (
          <View className="border-border bg-background pb-safe-or-4 border-t px-5 pt-3">
            {footer}
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
export function Heading({ title, action }: { title: string; action?: ReactNode }) {
  return (
    <View className="flex-row flex-wrap items-center justify-between gap-3">
      <Text
        className="text-journal-heading flex-1 text-3xl"
        style={{ fontFamily: 'Inter_700Bold', textDecorationLine: 'underline' }}
      >
        {title}
      </Text>
      {action}
    </View>
  );
}
export function Section({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  action?: ReactNode;
}) {
  return (
    <View className="gap-3">
      <View className="flex-row items-center justify-between gap-2">
        <Text
          className="text-journal-heading flex-1 text-lg"
          style={{ fontFamily: 'Inter_700Bold', textDecorationLine: 'underline' }}
        >
          {title}
        </Text>
        {action}
      </View>
      {children}
    </View>
  );
}
export function Action({
  label,
  onPress,
  secondary = false,
  disabled = false,
}: {
  label: string;
  onPress: () => void;
  secondary?: boolean;
  disabled?: boolean;
}) {
  const scale = useReadingScale();
  return (
    <Button
      onPress={onPress}
      variant={secondary ? 'secondary' : 'primary'}
      isDisabled={disabled}
      className="h-auto min-h-12 max-w-full rounded-xl px-4 py-3"
    >
      <Button.Label
        className="web:wrap-anywhere"
        style={{ fontSize: 16 * scale, lineHeight: 23 * scale, flexShrink: 1, textAlign: 'center' }}
      >
        {label}
      </Button.Label>
    </Button>
  );
}
export function Field({
  label,
  value,
  onChange,
  placeholder,
  keyboardType,
  multiline = false,
  readOnly = false,
  error,
}: {
  label: string;
  value: string;
  onChange?: (text: string) => void;
  placeholder?: string;
  keyboardType?: KeyboardTypeOptions;
  multiline?: boolean;
  readOnly?: boolean;
  error?: string;
}) {
  const scale = useReadingScale();
  const textStyle = { fontSize: 16 * scale, lineHeight: 24 * scale };
  return (
    <TextField isInvalid={Boolean(error)}>
      <Label>
        <Label.Text style={textStyle}>{label}</Label.Text>
      </Label>
      {multiline ? (
        <TextArea
          editable={!readOnly}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          style={{ ...textStyle, minHeight: 100 * scale }}
          className="border-field-border rounded-xl border"
        />
      ) : (
        <Input
          style={{ ...textStyle, height: undefined, minHeight: 48 * scale, paddingVertical: 12 }}
          className="border-field-border h-auto rounded-xl border"
          editable={!readOnly}
          value={value}
          onChangeText={onChange}
          placeholder={placeholder}
          keyboardType={keyboardType}
        />
      )}
      <FieldError styles={{ text: { fontSize: 14 * scale, lineHeight: 20 * scale } }}>
        {error}
      </FieldError>
    </TextField>
  );
}
export function Options({
  label,
  options,
  value,
  onChange,
}: {
  label?: string;
  options: string[];
  value: string;
  onChange: (value: string) => void;
}) {
  const scale = useReadingScale();
  return (
    <View className="gap-2">
      {label ? (
        <Text className="text-foreground text-sm" style={{ fontFamily: 'Inter_500Medium' }}>
          {label}
        </Text>
      ) : null}
      <View className="flex-row flex-wrap gap-2">
        {options.map((option) => (
          <Button
            key={option}
            size="sm"
            variant={value === option ? 'primary' : 'secondary'}
            onPress={() => {
              if (option !== value) {
                selection();
                onChange(option);
              }
            }}
            className="h-auto max-w-full rounded-lg px-3 py-2"
          >
            <Button.Label
              numberOfLines={1}
              style={{
                fontSize: Math.max(11, 14 * scale),
                lineHeight: Math.max(16, 20 * scale),
                flexShrink: 1,
              }}
            >
              {option}
            </Button.Label>
          </Button>
        ))}
      </View>
    </View>
  );
}
export function Empty({
  text,
  action,
  onPress,
}: {
  text: string;
  action: string;
  onPress: () => void;
}) {
  const muted = useThemeColor('muted');
  return (
    <View className="border-border items-center gap-4 rounded-2xl border p-7">
      <NotebookPen size={28} color={muted} strokeWidth={1.7} />
      <Text className="text-muted text-center">{text}</Text>
      <Action label={action} onPress={onPress} secondary />
    </View>
  );
}
export function Message({ text }: { text: string }) {
  return (
    <View className="bg-danger/10 rounded-xl p-3">
      <Text className="text-danger">{text}</Text>
    </View>
  );
}
export function RiskWarning({ saved = false }: { saved?: boolean }) {
  return (
    <View accessibilityRole="text" className="border-border gap-1 rounded-xl border p-3">
      <Text className="text-foreground" style={{ fontFamily: 'Inter_600SemiBold' }}>
        Above the 2% risk guideline
      </Text>
      <Text className="text-foreground">
        {saved
          ? 'The risk check was recorded as not met.'
          : 'Reduce your declared risk to 2% or less before saving.'}
      </Text>
    </View>
  );
}
export function TradeRow({ trade }: { trade: Trade }) {
  const [accent, muted, danger] = useThemeColor(['accent', 'muted', 'danger']);
  const amount = pnl(trade);
  const scale = useReadingScale();
  const Icon = trade.direction === 'Long' ? ArrowUpRight : ArrowDownLeft;
  return (
    <Button
      onPress={() => router.push({ pathname: '/trade/[id]', params: { id: trade.id } })}
      variant="ghost"
      className="border-border h-auto justify-start rounded-none border-b px-0 py-4"
      style={{
        flexDirection: scale > 1 ? 'column' : 'row',
        alignItems: scale > 1 ? 'stretch' : 'center',
      }}
    >
      <Icon
        size={21}
        color={trade.exit === undefined ? accent : amount >= 0 ? accent : danger}
        strokeWidth={1.7}
      />
      <View className="flex-1 gap-1">
        <Text className="text-foreground text-base" style={{ fontFamily: 'Inter_600SemiBold' }}>
          {trade.instrument} <Text className="text-muted text-sm">{trade.direction}</Text>
        </Text>
        <Text className="text-muted text-xs" numberOfLines={1}>
          {trade.setup}
        </Text>
      </View>
      <View
        className="gap-1"
        style={{ alignItems: scale > 1 ? 'flex-start' : 'flex-end', flexShrink: 1 }}
      >
        <Text
          className={
            trade.exit === undefined ? 'text-accent' : amount >= 0 ? 'text-accent' : 'text-danger'
          }
          style={{ fontFamily: 'Inter_600SemiBold' }}
        >
          {trade.exit === undefined ? 'Open' : money(amount)}
        </Text>
        <Text className="text-muted text-xs">
          {trade.exit === undefined
            ? new Date(trade.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
            : trade.closedAt
              ? `Closed ${new Date(trade.closedAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}`
              : 'Close date not recorded'}
        </Text>
      </View>
      <ChevronRight size={16} color={muted} />
    </Button>
  );
}
export function Metric({ label, value }: { label: string; value: string }) {
  const scale = useReadingScale();
  return (
    <View className="flex-1 gap-1" style={{ minWidth: scale > 1 ? 130 : 75 }}>
      <Text className="text-foreground text-xl" style={{ fontFamily: 'Inter_600SemiBold' }}>
        {value}
      </Text>
      <Text className="text-muted text-xs">{label}</Text>
    </View>
  );
}
