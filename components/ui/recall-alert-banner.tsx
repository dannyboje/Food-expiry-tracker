import { useState } from 'react';
import { Alert, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { Brand } from '@/constants/theme';
import type { RecallMatch } from '@/utils/recall-checker';

interface Props {
  alerts: RecallMatch[];
  onDismiss: (pairId: string) => void;
  onDismissAll: () => void;
}

export function RecallAlertBanner({ alerts, onDismiss, onDismissAll }: Props) {
  const [expanded, setExpanded] = useState(true);

  if (alerts.length === 0) return null;

  function confirmDismissAll() {
    Alert.alert(
      'Dismiss all recall alerts?',
      "These alerts won't appear again unless a new recall check finds a match.",
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Dismiss all', style: 'destructive', onPress: onDismissAll },
      ],
    );
  }

  return (
    <View style={styles.container}>
      {/* Header row */}
      <TouchableOpacity style={styles.header} onPress={() => setExpanded((v) => !v)} activeOpacity={0.8}>
        <View style={styles.headerLeft}>
          <IconSymbol name="exclamationmark.triangle.fill" size={16} color="#fff" />
          <Text style={styles.headerTitle}>
            Food Safety Alert — {alerts.length} item{alerts.length !== 1 ? 's' : ''} recalled
          </Text>
        </View>
        <View style={styles.headerRight}>
          <TouchableOpacity onPress={confirmDismissAll} hitSlop={8} style={styles.dismissAllBtn}>
            <Text style={styles.dismissAllText}>Dismiss all</Text>
          </TouchableOpacity>
          <IconSymbol
            name={expanded ? 'chevron.up' : 'chevron.down'}
            size={12}
            color="rgba(255,255,255,0.8)"
          />
        </View>
      </TouchableOpacity>

      {/* Expanded list */}
      {expanded && (
        <View style={styles.list}>
          {alerts.map((alert) => (
            <View key={alert.pairId} style={styles.alertRow}>
              <View style={styles.alertLeft}>
                <View style={styles.sourceTag}>
                  <Text style={styles.sourceText}>{alert.recall.source}</Text>
                </View>
                <View style={styles.alertInfo}>
                  <Text style={styles.itemName}>{alert.pantryItemName}</Text>
                  <Text style={styles.reason} numberOfLines={2}>
                    {alert.recall.reason || alert.recall.productDescription}
                  </Text>
                </View>
              </View>
              <TouchableOpacity onPress={() => onDismiss(alert.pairId)} style={styles.dismissBtn} hitSlop={8}>
                <IconSymbol name="xmark.circle.fill" size={20} color="rgba(255,255,255,0.6)" />
              </TouchableOpacity>
            </View>
          ))}

          <Text style={styles.safetyNote}>
            Discard recalled products safely — do not consume.
          </Text>
        </View>
      )}
    </View>
  );
}

const BG = '#B91C1C';
const BG_LIGHT = '#DC2626';

const styles = StyleSheet.create({
  container: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 2,
    borderRadius: 12,
    backgroundColor: BG,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 6,
    elevation: 4,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 14,
    paddingVertical: 11,
    backgroundColor: BG_LIGHT,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  headerTitle: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 13,
    flex: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  dismissAllBtn: {
    paddingHorizontal: 2,
  },
  dismissAllText: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '500',
  },
  list: {
    paddingBottom: 10,
  },
  alertRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: 'rgba(255,255,255,0.15)',
    gap: 10,
  },
  alertLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
    gap: 10,
  },
  sourceTag: {
    backgroundColor: 'rgba(0,0,0,0.25)',
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginTop: 1,
  },
  sourceText: {
    color: 'rgba(255,255,255,0.9)',
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  alertInfo: {
    flex: 1,
  },
  itemName: {
    color: '#fff',
    fontWeight: '700',
    fontSize: 14,
  },
  reason: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  dismissBtn: {
    padding: 2,
  },
  safetyNote: {
    color: 'rgba(255,255,255,0.65)',
    fontSize: 11,
    textAlign: 'center',
    fontStyle: 'italic',
    paddingTop: 4,
    paddingHorizontal: 14,
  },
});
